import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { deriveGenerationType } from '@/domain/generation/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Validate the token and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      },
      include: {
        person: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    if (!invite.person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const person = invite.person

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
        selfie: true,
        context: true,
        person: {
          select: {
            teamId: true // Needed to derive generationType
          }
        }
      }
    })

    // Helper function to get job status for processing generations
    const getJobStatus = async (generationId: string, status: string) => {
      if (status !== 'pending' && status !== 'processing') {
        return null
      }
      try {
        const { imageGenerationQueue } = await import('@/queue')
        const job = await imageGenerationQueue.getJob(`gen-${generationId}`)
        if (job) {
          // Handle progress as either number or object { progress: number, message?: string }
          const progressData = typeof job.progress === 'object' && job.progress !== null
            ? job.progress as { progress?: number; message?: string }
            : { progress: job.progress as number }
          return {
            id: job.id,
            progress: typeof progressData === 'object' && 'progress' in progressData && typeof progressData.progress === 'number'
              ? progressData.progress
              : (typeof job.progress === 'number' ? job.progress : 0),
            message: typeof progressData === 'object' && 'message' in progressData && typeof progressData.message === 'string'
              ? progressData.message
              : undefined,
            attemptsMade: job.attemptsMade,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
          }
        }
      } catch (error) {
        Logger.warn('Failed to get job status in team member generations', { error: error instanceof Error ? error.message : String(error) })
      }
      return null
    }

    // Get job status for processing generations in parallel
    const processingGenerations = generations.filter(g => g.status === 'pending' || g.status === 'processing')
    const jobStatusPromises = processingGenerations.map(g => getJobStatus(g.id, g.status))
    const jobStatuses = await Promise.all(jobStatusPromises)
    const jobStatusMap = new Map(processingGenerations.map((g, i) => [g.id, jobStatuses[i]]))

    // Transform the data for the frontend
    const tokenParam = `token=${encodeURIComponent(token)}`

    const transformedGenerations = generations.map(generation => {
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

      const inputSelfieUrls = inputSelfieKeys.map(key => `/api/files/get?key=${encodeURIComponent(key)}&${tokenParam}`)

      return {
        id: generation.id,
        selfieKey: generation.selfie?.key || '',
        selfieUrl: generation.selfie?.key ? `/api/files/get?key=${encodeURIComponent(generation.selfie.key)}&${tokenParam}` : '',
        inputSelfieUrls,
        generatedPhotos: generation.generatedPhotoKeys.map((key, index) => ({
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

    return NextResponse.json({ generations: transformedGenerations })
  } catch (error) {
    Logger.error('Error fetching generations', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
