import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { getPackageConfig } from '@/domain/style/packages'

interface JobData {
  generationId: string;
  personId: string;
  userId: string | undefined;
  selfieS3Key: string;
  styleSettings: Record<string, unknown>;
  prompt: string;
  providerOptions: {
    model: string;
    numVariations: number;
  };
  creditSource: 'team';
  selfieId: string;
}

export async function POST(request: NextRequest) {
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
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Find the person by email from the invite
    const person = await prisma.person.findFirst({
      where: {
        email: invite.email,
        teamId: invite.teamId
      }
    })

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const body = await request.json()
    const { generationId } = body

    if (!generationId) {
      return NextResponse.json({ error: 'Generation ID is required' }, { status: 400 })
    }

    // Get the generation to regenerate from
    const sourceGeneration = await prisma.generation.findFirst({
      where: {
        id: generationId,
        personId: person.id
      },
      include: {
        context: true
      }
    })

    if (!sourceGeneration || !sourceGeneration.selfieId) {
      return NextResponse.json({ error: 'Generation or selfie not found' }, { status: 404 })
    }

    // Find the original generation in the group to check remaining regenerations
    let originalGeneration = sourceGeneration
    if (!sourceGeneration.isOriginal && sourceGeneration.generationGroupId) {
      const foundOriginal = await prisma.generation.findFirst({
        where: {
          generationGroupId: sourceGeneration.generationGroupId,
          isOriginal: true
        },
        include: {
          context: true
        }
      })
      if (foundOriginal) {
        originalGeneration = foundOriginal
      }
    }

    // Check if regeneration is allowed
    if (originalGeneration.remainingRegenerations <= 0) {
      return NextResponse.json({ error: 'No regenerations left' }, { status: 400 })
    }

    // Find the latest groupIndex in this generation group
    const latestInGroup = await prisma.generation.findFirst({
      where: { generationGroupId: sourceGeneration.generationGroupId },
      orderBy: { groupIndex: 'desc' },
      select: { groupIndex: true },
    })
    const nextGroupIndex = (latestInGroup?.groupIndex ?? 0) + 1

    // Get style settings from source generation (includes user customizations)
    // Use the source generation's saved styleSettings (most accurate)
    let finalStyleSettings: Record<string, unknown> = {}
    if (sourceGeneration.styleSettings && typeof sourceGeneration.styleSettings === 'object' && !Array.isArray(sourceGeneration.styleSettings)) {
      finalStyleSettings = sourceGeneration.styleSettings as Record<string, unknown>
      Logger.debug('Using styleSettings from source generation for team regeneration')
    } else if (sourceGeneration.context?.settings) {
      // Fallback to context settings if generation doesn't have saved styleSettings
      finalStyleSettings = sourceGeneration.context.settings as Record<string, unknown>
      Logger.debug('Using context settings from source generation for team regeneration (fallback)')
    }

    // Serialize style settings for storage
    const packageId = (finalStyleSettings['packageId'] as string) || 'headshot1'
    const pkg = getPackageConfig(packageId)
    const serializedStyleSettingsBase = pkg.persistenceAdapter.serialize(finalStyleSettings)
    // Try to reuse stored selfie keys from the source generation
    const storedSelfieKeys = (sourceGeneration.styleSettings as unknown as { inputSelfies?: { keys?: string[] } } | null)?.inputSelfies?.keys
    const serializedStyleSettings = {
      ...serializedStyleSettingsBase,
      inputSelfies: { keys: Array.isArray(storedSelfieKeys) ? storedSelfieKeys : [] }
    } as Record<string, unknown>

    // Create new generation record
    const generation = await prisma.generation.create({
      data: {
        personId: person.id,
        uploadedPhotoKey: sourceGeneration.uploadedPhotoKey,
        contextId: sourceGeneration.contextId,
        selfieId: sourceGeneration.selfieId,
        // generationType removed - now derived from person.teamId (single source of truth)
        status: 'pending',
        maxRegenerations: 0, // Regenerations cannot be regenerated
        remainingRegenerations: 0,
        generationGroupId: sourceGeneration.generationGroupId,
        isOriginal: false,
        groupIndex: nextGroupIndex,
        creditsUsed: 0, // Regenerations don't cost credits
        creditSource: 'team',
        styleSettings: serializedStyleSettings as unknown as Parameters<typeof prisma.generation.create>[0]['data']['styleSettings'],
      },
    })

    // Update the original generation's remaining regenerations
    await prisma.generation.update({
      where: { id: originalGeneration.id },
      data: {
        remainingRegenerations: originalGeneration.remainingRegenerations - 1
      }
    })
    
    const jobData: JobData = {
      generationId: generation.id,
      personId: person.id,
      userId: person.userId || undefined,
      selfieS3Key: sourceGeneration.uploadedPhotoKey,
      styleSettings: finalStyleSettings,
      prompt: 'Professional headshot with same style as original',
      providerOptions: {
        model: Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'),
        numVariations: 4,
      },
      creditSource: 'team',
      selfieId: sourceGeneration.selfieId,
    }

    // If we have multiple stored selfie keys, add them to the job as selfieS3Keys
    if (Array.isArray(storedSelfieKeys) && storedSelfieKeys.length > 1) {
      ;(jobData as unknown as { selfieS3Keys?: string[] }).selfieS3Keys = storedSelfieKeys
    }

    // Lazy import to avoid build-time issues
    const { imageGenerationQueue } = await import('@/queue')
    
    const job = await imageGenerationQueue.add('generate', jobData, {
      priority: 1, // Higher priority for team generations
      jobId: `gen-${generation.id}`,
    })

    Logger.info('Team regeneration job queued', { jobId: job.id })

    return NextResponse.json({
      success: true,
      generationId: generation.id,
      jobId: job.id
    })

  } catch (error) {
    Logger.error('Team regeneration error', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Failed to start regeneration' },
      { status: 500 }
    )
  }
}
