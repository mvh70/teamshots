/**
 * Shared helper functions for generation creation endpoints
 * Extracts common logic to reduce duplication between routes
 */

import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { Prisma } from '@/lib/prisma'
import { getPackageConfig } from '@/domain/style/packages'
import { extractFromClassification } from '@/domain/selfie/selfie-types'
import { getDemographicsFromSelfieIds, hasDemographicData, type DemographicProfile } from '@/domain/selfie/selfieDemographics'
import { AssetService } from '@/domain/services/AssetService'
import { CreditService } from '@/domain/services/CreditService'

export interface JobEnqueueOptions {
  generationId: string
  personId: string
  userId: string | undefined
  teamId?: string
  selfieS3Keys: string[]
  selfieAssetIds?: string[] // Asset IDs for fingerprinting and cost tracking
  selfieTypeMap?: Record<string, string> // Map of S3 key to selfie type for split composites
  demographics?: DemographicProfile // Aggregated demographics from selfies
  prompt: string
  workflowVersion: 'v3'
  debugMode: boolean
  stopAfterStep?: string | number
  creditSource: 'individual' | 'team'
  priority?: number
}

export interface SelfieJobEnrichment {
  selfieAssetIds?: string[]
  selfieTypeMap?: Record<string, string>
  demographics?: DemographicProfile
}

export interface CreateGenerationWithCreditReservationOptions {
  generationData: Prisma.GenerationUncheckedCreateInput
  reservationUserId: string
  reservationPersonId: string
  requiredCredits: number
  userContext?: Parameters<typeof CreditService.reserveCreditsForGeneration>[3]
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
    selfieTypeMap,
    demographics,
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
      selfieTypeMap, // Pass selfie type map for split composite building
      demographics, // Pass aggregated demographics from selfies
      prompt,
      providerOptions: {
        model: Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'), // Default to flash-image if env not set
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
 * Create generation and reserve credits as one logical operation.
 * Rolls back generation record if reservation fails.
 */
export async function createGenerationWithCreditReservation(
  options: CreateGenerationWithCreditReservationOptions
) {
  const generation = await prisma.generation.create({
    data: options.generationData,
  })

  try {
    const reservationResult = await CreditService.reserveCreditsForGeneration(
      options.reservationUserId,
      options.reservationPersonId,
      options.requiredCredits,
      options.userContext
    )

    if (!reservationResult.success) {
      Logger.error('Credit reservation failed', {
        generationId: generation.id,
        error: reservationResult.error,
      })
      throw new Error(reservationResult.error || 'Credit reservation failed')
    }

    Logger.debug('Credits reserved successfully', {
      generationId: generation.id,
      transactionId: reservationResult.transactionId,
      individualCreditsUsed: reservationResult.individualCreditsUsed,
      teamCreditsUsed: reservationResult.teamCreditsUsed,
    })

    return {
      generation,
      reservationResult,
    }
  } catch (creditError) {
    try {
      await prisma.generation.delete({ where: { id: generation.id } })
    } catch (deleteError) {
      Logger.warn('Failed to delete generation after credit reservation failure', {
        generationId: generation.id,
        error: deleteError instanceof Error ? deleteError.message : String(deleteError),
      })
    }
    throw creditError
  }
}

/**
 * Serialize style settings in a route-agnostic way and persist job selfie keys
 * for regeneration consistency.
 */
export function serializeStyleSettingsForGeneration({
  packageId,
  styleSettings,
  selfieS3Keys,
}: {
  packageId: string
  styleSettings: Record<string, unknown>
  selfieS3Keys: string[]
}): Record<string, unknown> {
  const pkg = getPackageConfig(packageId)
  let serializedStyleSettings = pkg.persistenceAdapter.serialize(styleSettings)

  // Normalize potential UI variants after serialization
  try {
    const clothing = serializedStyleSettings['clothing'] as { colors?: unknown } | undefined
    const clothingColors = serializedStyleSettings['clothingColors'] as
      | Record<string, unknown>
      | null
      | undefined

    // Some UIs may send colors under clothing.colors; lift to clothingColors if present
    if (!clothingColors && clothing && clothing.colors && typeof clothing.colors === 'object') {
      serializedStyleSettings['clothingColors'] = {
        colors: clothing.colors as Record<string, unknown>,
      }
      // Keep clothing.colors for backward compatibility.
    }
  } catch {
    // Best-effort normalization only.
  }

  return {
    ...serializedStyleSettings,
    inputSelfies: { keys: selfieS3Keys },
  } as Record<string, unknown>
}

/**
 * Resolve optional job enrichment data from selfie keys.
 * Failures are intentionally non-fatal so generation can still proceed.
 */
export async function enrichGenerationJobFromSelfies({
  generationId,
  personId,
  selfieS3Keys,
  teamId,
}: {
  generationId: string
  personId: string
  selfieS3Keys: string[]
  teamId?: string
}): Promise<SelfieJobEnrichment> {
  if (!Array.isArray(selfieS3Keys) || selfieS3Keys.length === 0) {
    return {}
  }

  try {
    const selfiesForJob = await prisma.selfie.findMany({
      where: {
        personId,
        key: { in: selfieS3Keys },
      },
      select: {
        id: true,
        key: true,
        classification: true,
      },
    })

    const selfieTypeMap: Record<string, string> = {}
    for (const selfie of selfiesForJob) {
      const classification = extractFromClassification(selfie.classification)
      if (classification.selfieType && classification.selfieType !== 'unknown') {
        selfieTypeMap[selfie.key] = classification.selfieType
      }
    }

    Logger.debug('Selfie classification results', {
      generationId,
      totalSelfies: selfiesForJob.length,
      mappedSelfies: Object.keys(selfieTypeMap).length,
      types: Object.values(selfieTypeMap),
    })

    const selfieAssetIds: string[] = []
    for (const key of selfieS3Keys) {
      const asset = await AssetService.resolveToAsset(key, {
        ownerType: teamId ? 'team' : 'person',
        teamId: teamId ?? undefined,
        personId,
        type: 'selfie',
      })
      selfieAssetIds.push(asset.id)

      const selfie = selfiesForJob.find((s) => s.key === key)
      if (selfie) {
        const selfieRecord = await prisma.selfie.findUnique({
          where: { id: selfie.id },
          select: { assetId: true },
        })
        if (!selfieRecord?.assetId) {
          await AssetService.linkSelfieToAsset(selfie.id, asset.id)
        }
      }
    }

    Logger.debug('Resolved selfie assets for generation', {
      generationId,
      selfieAssetIds,
      selfieS3Keys,
    })

    let demographics: DemographicProfile | undefined
    try {
      const selfieIdsForDemographics = selfiesForJob.map((selfie) => selfie.id)
      const demographicProfile = await getDemographicsFromSelfieIds(selfieIdsForDemographics)
      if (hasDemographicData(demographicProfile)) {
        demographics = demographicProfile
        Logger.debug('Resolved demographics for generation', {
          generationId,
          demographics,
        })
      }
    } catch (demographicsError) {
      Logger.warn('Failed to resolve demographics, continuing without', {
        generationId,
        error: demographicsError instanceof Error ? demographicsError.message : String(demographicsError),
      })
    }

    return {
      selfieAssetIds: selfieAssetIds.length > 0 ? selfieAssetIds : undefined,
      selfieTypeMap: Object.keys(selfieTypeMap).length > 0 ? selfieTypeMap : undefined,
      demographics,
    }
  } catch (error) {
    Logger.warn('Failed to enrich generation job from selfies, continuing without optional fields', {
      generationId,
      personId,
      error: error instanceof Error ? error.message : String(error),
    })
    return {}
  }
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
