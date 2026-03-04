/**
 * RegenerationService
 * 
 * Handles regeneration of existing generations with proper style settings preservation.
 * Consolidates logic previously duplicated across session-based and token-based endpoints.
 */

import { prisma, Prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { getPackageConfig } from '@/domain/style/packages'
import { extractPackageId } from '@/domain/style/settings-resolver'
import { normalizeClothingSettings } from '@/domain/style/elements/clothing/deserializer'
import { enqueueGenerationJob } from './generation-helpers'
import type { DemographicProfile } from '@/domain/selfie/selfieDemographics'

type Generation = Prisma.GenerationGetPayload<Prisma.GenerationDefaultArgs>
export const NO_REGENERATIONS_REMAINING_ERROR = 'NO_REGENERATIONS_REMAINING'

export interface RegenerateOptions {
  sourceGenerationId: string
  personId: string
  userId?: string
  workflowVersion?: 'v3' // Workflow version to use (defaults to v3)
  debugMode?: boolean
}

export interface RegenerationResult {
  generation: Generation
  jobId: string
}

export class RegenerationService {
  /**
   * Regenerates an existing generation with preserved style settings
   */
  static async regenerate(options: RegenerateOptions): Promise<RegenerationResult> {
    const { sourceGenerationId, personId, userId, workflowVersion, debugMode } = options

    // Get the source generation to regenerate from
    const sourceGeneration = await prisma.generation.findFirst({
      where: {
        id: sourceGenerationId,
        personId: personId
      },
      include: {
        context: true,
        person: {
          select: {
            teamId: true
          }
        }
      }
    })

    if (!sourceGeneration) {
      throw new Error('Generation not found')
    }

    // Extract teamId from person for job enqueuing
    const teamId = sourceGeneration.person?.teamId ?? undefined

    // Find the original generation in the group to check remaining regenerations
    let originalGeneration = sourceGeneration
    if (!sourceGeneration.isOriginal && sourceGeneration.generationGroupId) {
      const foundOriginal = await prisma.generation.findFirst({
        where: {
          generationGroupId: sourceGeneration.generationGroupId,
          isOriginal: true
        },
        include: {
          context: true,
          person: {
            select: {
              teamId: true
            }
          }
        }
      })
      if (foundOriginal) {
        originalGeneration = foundOriginal
      }
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
    let serializedStyleSettings: Record<string, unknown> = {}
    if (sourceGeneration.styleSettings && typeof sourceGeneration.styleSettings === 'object' && !Array.isArray(sourceGeneration.styleSettings)) {
      // styleSettings from DB are already serialized - use them directly
      serializedStyleSettings = sourceGeneration.styleSettings as Record<string, unknown>
      Logger.debug('Using styleSettings from source generation for regeneration')
    } else if (sourceGeneration.context?.settings) {
      // Fallback to context settings if generation doesn't have saved styleSettings
      // Context settings need to be serialized
      const packageId = extractPackageId(sourceGeneration.context.settings as Record<string, unknown>) || 'headshot1'
      const pkg = getPackageConfig(packageId)
      serializedStyleSettings = pkg.persistenceAdapter.serialize(sourceGeneration.context.settings as Record<string, unknown>)
      Logger.debug('Using context settings from source generation for regeneration (fallback)')
    }

    if ('clothing' in serializedStyleSettings) {
      serializedStyleSettings = {
        ...serializedStyleSettings,
        clothing: normalizeClothingSettings(serializedStyleSettings.clothing),
      }
    }

    // Extract stored selfie keys (they're already in the serialized settings)
    const storedInputSelfies = (serializedStyleSettings as {
      inputSelfies?: {
        keys?: string[]
        assetIds?: string[]
        selfieTypeMap?: Record<string, string>
      }
    })?.inputSelfies
    const storedSelfieKeys = storedInputSelfies?.keys
    const storedSelfieAssetIds = storedInputSelfies?.assetIds
    const storedSelfieTypeMap = storedInputSelfies?.selfieTypeMap
    const storedDemographics = (serializedStyleSettings as { demographics?: DemographicProfile })
      ?.demographics
    
    // Ensure inputSelfies are included in the serialized settings
    if (!serializedStyleSettings.inputSelfies || !Array.isArray(storedSelfieKeys) || storedSelfieKeys.length === 0) {
      // If no stored keys, try to get from the serialized settings structure
      const keys = Array.isArray(storedSelfieKeys) ? storedSelfieKeys : []
      serializedStyleSettings = {
        ...serializedStyleSettings,
        inputSelfies: { keys }
      }
    }
    
    // Create new generation + decrement remaining regenerations atomically.
    const generation = await prisma.$transaction(async (tx) => {
      const updated = await tx.generation.updateMany({
        where: {
          id: originalGeneration.id,
          remainingRegenerations: { gt: 0 }
        },
        data: {
          remainingRegenerations: { decrement: 1 }
        }
      })

      if (updated.count === 0) {
        throw new Error(NO_REGENERATIONS_REMAINING_ERROR)
      }

      return tx.generation.create({
        data: {
          personId: personId,
          contextId: sourceGeneration.contextId,
          status: 'pending',
          maxRegenerations: 0, // Regenerations cannot be regenerated
          remainingRegenerations: 0,
          generationGroupId: sourceGeneration.generationGroupId,
          isOriginal: false,
          groupIndex: nextGroupIndex,
          creditsUsed: 0, // Regenerations don't cost credits
          creditSource: 'individual',
          styleSettings: serializedStyleSettings as Prisma.InputJsonValue,
        },
      })
    })
    
    // Queue the generation job
    if (!Array.isArray(storedSelfieKeys) || storedSelfieKeys.length === 0) {
      throw new Error('No selfie keys found in source generation settings')
    }
    const jobSelfieS3Keys = storedSelfieKeys
    const jobSelfieAssetIds = Array.isArray(storedSelfieAssetIds)
      ? storedSelfieAssetIds
      : undefined
    const jobSelfieTypeMap =
      storedSelfieTypeMap && typeof storedSelfieTypeMap === 'object'
        ? storedSelfieTypeMap
        : undefined

    const effectiveDebugMode = debugMode ?? process.env.NODE_ENV !== 'production'

    const job = await enqueueGenerationJob({
      generationId: generation.id,
      personId: personId,
      userId: userId,
      teamId: teamId,
      selfieS3Keys: jobSelfieS3Keys,
      selfieAssetIds: jobSelfieAssetIds,
      selfieTypeMap: jobSelfieTypeMap,
      demographics: storedDemographics,
      prompt: 'Professional headshot with same style as original',
      workflowVersion: workflowVersion || 'v3',
      debugMode: effectiveDebugMode,
      creditSource: 'individual',
      priority: 0,
    })

    return {
      generation,
      jobId: job.id || `gen-${generation.id}`
    }
  }
}
