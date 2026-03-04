/**
 * Shared helper functions for generation creation endpoints
 * Extracts common logic to reduce duplication between routes
 */

import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { Prisma } from '@/lib/prisma'
import { PRICING_CONFIG, getPricingTier } from '@/config/pricing'
import { refundCreditsForFailedGeneration } from '@/domain/credits/credits'
import { getRegenerationCount } from '@/domain/pricing'
import { getPackageConfig } from '@/domain/style/packages'
import { extractFromClassification } from '@/domain/selfie/selfie-types'
import { getDemographicsFromSelfieIds, hasDemographicData, type DemographicProfile } from '@/domain/selfie/selfieDemographics'
import { AssetService } from '@/domain/services/AssetService'
import { CreditService } from '@/domain/services/CreditService'
import { withSerializableRetry } from '@/lib/prisma-retry'
import type { PlanPeriod } from '@/domain/subscription/utils'

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

interface HandleEnqueueFailureOptions {
  generationId: string
  personId: string
  error: unknown
  inviteId?: string
  credits?: number
}

export function getRegenerationLimitForAdmin(
  adminPlanTier: string | null,
  adminPlanPeriod: string | null
): number {
  const period = adminPlanPeriod as PlanPeriod | null
  const pricingTier = getPricingTier(adminPlanTier, period)
  return getRegenerationCount(pricingTier, period)
}

export async function handleEnqueueFailure({
  generationId,
  personId,
  error,
  inviteId,
  credits = PRICING_CONFIG.credits.perGeneration,
}: HandleEnqueueFailureOptions): Promise<never> {
  Logger.error('Failed to enqueue generation job', {
    generationId,
    personId,
    inviteId,
    error: error instanceof Error ? error.message : String(error),
  })

  try {
    await refundCreditsForFailedGeneration(
      personId,
      credits,
      inviteId
        ? `Refund for invite queue failure (generation ${generationId})`
        : `Refund for queue failure (generation ${generationId})`,
      undefined,
      inviteId
    )
  } catch (refundError) {
    Logger.error('Failed to refund credits after enqueue failure', {
      generationId,
      personId,
      inviteId,
      error: refundError instanceof Error ? refundError.message : String(refundError),
    })
  }

  try {
    await prisma.generation.delete({ where: { id: generationId } })
  } catch (cleanupError) {
    Logger.error('Failed to clean up generation after enqueue failure', {
      generationId,
      inviteId,
      error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
    })
  }

  throw new Error('Failed to queue generation job. Credits have been refunded.')
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
  return withSerializableRetry(async () => {
    return prisma.$transaction(
      async (tx) => {
        const reservationResult = await CreditService.reserveCreditsForGeneration(
          options.reservationUserId,
          options.reservationPersonId,
          options.requiredCredits,
          options.userContext,
          tx
        )

        if (!reservationResult.success) {
          Logger.error('Credit reservation failed', {
            personId: options.reservationPersonId,
            error: reservationResult.error,
          })
          throw new Error(reservationResult.error || 'Credit reservation failed')
        }

        const generation = await tx.generation.create({
          data: options.generationData,
        })

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
      },
      {
        isolationLevel: 'Serializable',
        timeout: 10000,
      }
    )
  })
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
  const serializedStyleSettings = pkg.persistenceAdapter.serialize(styleSettings)

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
        assetId: true,
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

    const selfieByKey = new Map(selfiesForJob.map((selfie) => [selfie.key, selfie]))
    const selfieAssetIds = await Promise.all(
      selfieS3Keys.map(async (key) => {
        const asset = await AssetService.resolveToAsset(key, {
          ownerType: teamId ? 'team' : 'person',
          teamId: teamId ?? undefined,
          personId,
          type: 'selfie',
        })

        const selfie = selfieByKey.get(key)
        if (selfie && !selfie.assetId) {
          await AssetService.linkSelfieToAsset(selfie.id, asset.id)
        }

        return asset.id
      })
    )

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
