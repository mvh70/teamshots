import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { deriveGenerationType } from '@/domain/generation/utils'
import { resolveInviteAccess } from '@/lib/invite-access'
import { getGenerationJobStatus } from '@/domain/generation/job-status'

// Disable caching for this route - invite generations are polled for live progress updates
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const inviteAccess = await resolveInviteAccess({ token })
    if (!inviteAccess.ok) {
      return NextResponse.json({ error: inviteAccess.error.message }, { status: inviteAccess.error.status })
    }

    const person = inviteAccess.access.person

    // Get generations for the person
    // Exclude failed generations (they show temporarily in UI then disappear)
    const generations = await prisma.generation.findMany({
      where: {
        personId: person.id,
        deleted: false, // Exclude soft-deleted generations
        status: { not: 'failed' }, // Exclude failed generations
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        context: true,
        person: {
          select: {
            teamId: true // Needed to derive generationType
          }
        }
      }
    })

    // Get job status for processing generations in parallel
    type Generation = typeof generations[number];
    const processingGenerations = generations.filter((g: Generation) => g.status === 'pending' || g.status === 'processing')
    const jobStatusPromises = processingGenerations.map((g: Generation) =>
      getGenerationJobStatus({
        generationId: g.id,
        status: g.status,
        logContext: 'team-member-generations-list',
      })
    )
    const jobStatuses = await Promise.all(jobStatusPromises)
    const jobStatusMap = new Map(processingGenerations.map((g: Generation, i: number) => [g.id, jobStatuses[i]]))

    // Transform the data for the frontend
    const tokenParam = `token=${encodeURIComponent(inviteAccess.access.token)}`

    const transformedGenerations = generations.map((generation: Generation) => {
      // Attempt to read input selfie keys from persisted style settings
      let inputSelfieKeys: string[] = []
      try {
        const styles = generation.styleSettings as unknown as Record<string, unknown> | null
        const inputSelfies = styles && typeof styles === 'object' ? (styles['inputSelfies'] as Record<string, unknown> | undefined) : undefined
        const keys = inputSelfies && typeof inputSelfies === 'object' ? (inputSelfies['keys'] as unknown) : undefined
        if (Array.isArray(keys)) {
          inputSelfieKeys = keys.filter((k): k is string => typeof k === 'string')
        }
      } catch {
        // ignore malformed style settings
      }

      const primarySelfieKey = inputSelfieKeys[0] || ''
      const inputSelfieUrls = inputSelfieKeys.map((key: string) => `/api/files/get?key=${encodeURIComponent(key)}&${tokenParam}`)

      return {
        id: generation.id,
        selfieKey: primarySelfieKey,
        selfieUrl: primarySelfieKey ? `/api/files/get?key=${encodeURIComponent(primarySelfieKey)}&${tokenParam}` : '',
        inputSelfieUrls,
        generatedPhotos: generation.generatedPhotoKeys.map((key: string, index: number) => ({
          id: `${generation.id}-${index}`,
          url: `/api/files/get?key=${encodeURIComponent(key)}&${tokenParam}`,
          style: generation.context?.name || 'Freestyle'
        })),
        status: generation.status,
        createdAt: generation.createdAt.toISOString(),
        generationType: deriveGenerationType(generation.person.teamId), // Derived from person.teamId, not stored field
        creditsUsed: generation.creditsUsed,
        maxRegenerations: generation.maxRegenerations,
        remainingRegenerations: generation.remainingRegenerations,
        generationGroupId: generation.generationGroupId,
        isOriginal: generation.isOriginal,
        groupIndex: generation.groupIndex,
        jobStatus: jobStatusMap.get(generation.id) || undefined
      }
    })

    return NextResponse.json(
      { generations: transformedGenerations },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      }
    )
  } catch (error) {
    Logger.error('Error fetching generations', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
