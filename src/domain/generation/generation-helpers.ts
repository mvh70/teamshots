/**
 * Shared helper functions for generation creation endpoints
 * Extracts common logic to reduce duplication between routes
 */

import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { Prisma } from '@/lib/prisma'

export interface JobEnqueueOptions {
  generationId: string
  personId: string
  userId: string | undefined
  teamId?: string
  selfieS3Keys: string[]
  selfieAssetIds?: string[] // Asset IDs for fingerprinting and cost tracking
  prompt: string
  workflowVersion: 'v3'
  debugMode: boolean
  stopAfterStep?: string | number
  creditSource: 'individual' | 'team'
  priority?: number
}

/**
 * Enqueue a generation job with standardized configuration
 */
export async function enqueueGenerationJob(options: JobEnqueueOptions) {
  const { imageGenerationQueue } = await import('@/queue')
  
  const {
    generationId,
    personId,
    userId,
    teamId,
    selfieS3Keys,
    selfieAssetIds,
    prompt,
    workflowVersion,
    debugMode,
    stopAfterStep,
    creditSource,
    priority
  } = options

  const job = await imageGenerationQueue.add(
    'generate',
    {
      generationId,
      personId,
      userId,
      teamId,
      selfieS3Keys,
      selfieAssetIds, // Pass asset IDs for fingerprinting and cost tracking
      prompt,
      providerOptions: {
        model: Env.string('GEMINI_IMAGE_MODEL'),
        numVariations: 4,
        workflowVersion,
        debugMode,
        ...(stopAfterStep && { stopAfterStep }),
      },
      creditSource,
    },
    {
      priority: priority ?? (creditSource === 'team' ? 1 : 0),
      jobId: `gen-${generationId}`,
    }
  )

  Logger.info('Generation job enqueued', {
    generationId,
    jobId: job.id,
    creditSource,
    workflowVersion,
  })

  return job
}

/**
 * Determine the final workflow version from request
 * Defaults to 'v3' (current standard version)
 */
export function determineWorkflowVersion(
  requestVersion?: 'v3'
): 'v3' {
  return requestVersion || 'v3'
}

/**
 * Resolve selfie S3 keys from various input formats
 */
export async function resolveSelfieKeys(
  selfieIds?: string[],
  selfieKeys?: string[]
): Promise<{ primaryKey: string; allKeys: string[] }> {
  // Priority 1: Multiple selfie keys
  if (selfieKeys && selfieKeys.length > 0) {
    return {
      primaryKey: selfieKeys[0],
      allKeys: selfieKeys,
    }
  }

  // Priority 2: Multiple selfie IDs
  if (selfieIds && selfieIds.length > 0) {
    const selfies = await prisma.selfie.findMany({
      where: { id: { in: selfieIds } },
      select: { key: true },
    })

    if (selfies.length === 0) {
      throw new Error('No selfies found for provided IDs')
    }

    type Selfie = typeof selfies[number];
    const keys = selfies.map((s: Selfie) => s.key)
    return {
      primaryKey: keys[0],
      allKeys: keys,
    }
  }

  throw new Error('No selfie information provided')
}

/**
 * Get primary selfie with person data
 */
export async function getPrimarySelfie(selfieId: string) {
  const selfie = await prisma.selfie.findUnique({
    where: { id: selfieId },
    include: {
      person: {
        select: {
          id: true,
          userId: true,
          teamId: true,
        },
      },
    },
  })

  if (!selfie) {
    throw new Error('Primary selfie not found')
  }

  return selfie
}

/**
 * Validate that a person belongs to a team
 */
export async function validatePersonTeamMembership(
  personId: string,
  teamId: string
): Promise<boolean> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { teamId: true },
  })

  return person?.teamId === teamId
}

/**
 * Create generation record with standardized fields
 * Note: This is a minimal helper. Routes may need to add additional fields directly.
 */
export async function createGenerationRecord(data: {
  personId: string
  styleSettings: PhotoStyleSettings | Record<string, unknown>
  creditSource: 'individual' | 'team'
  creditsUsed: number
  contextId?: string
  provider?: string
  maxRegenerations?: number
  remainingRegenerations?: number
}) {
  return await prisma.generation.create({
    data: {
      personId: data.personId,
      generatedPhotoKeys: [],
      styleSettings: data.styleSettings as Prisma.InputJsonValue,
      creditSource: data.creditSource,
      creditsUsed: data.creditsUsed,
      status: 'pending',
      contextId: data.contextId,
      provider: data.provider ?? 'gemini',
      maxRegenerations: data.maxRegenerations ?? 2,
      remainingRegenerations: data.remainingRegenerations ?? 2,
    },
  })
}

