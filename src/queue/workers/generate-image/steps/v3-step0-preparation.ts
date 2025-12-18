/**
 * V3 Workflow - Step 0: Asset Preparation
 *
 * This step runs before any generation phases, allowing elements to prepare
 * expensive assets (downloads, collages, etc.) in parallel without blocking
 * prompt building in later steps.
 *
 * Elements implement needsPreparation() and prepare() to participate.
 */

import { Logger } from '@/lib/logger'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { DownloadAssetFn } from '@/types/generation'
import type { S3Client } from '@aws-sdk/client-s3'
import {
  compositionRegistry,
  type ElementContext,
  type PreparedAsset,
} from '@/domain/style/elements/composition'

export interface V3Step0Input {
  styleSettings: PhotoStyleSettings
  downloadAsset: DownloadAssetFn
  s3Client: S3Client
  generationId: string
  personId: string
  teamId?: string
  selfieS3Keys: string[]
  debugMode: boolean
}

export interface V3Step0Output {
  preparedAssets: Map<string, PreparedAsset>
  preparationErrors: Array<{ elementId: string; error: string }>
}

/**
 * Execute Step 0: Prepare all element assets in parallel
 *
 * This step:
 * 1. Creates preparation context for elements
 * 2. Filters elements that need preparation
 * 3. Executes prepare() on each element in parallel
 * 4. Returns prepared assets map for use in later steps
 *
 * @param input - Step 0 input parameters
 * @returns Prepared assets map and any errors
 */
export async function executeStep0Preparation(
  input: V3Step0Input
): Promise<V3Step0Output> {
  const {
    styleSettings,
    downloadAsset,
    s3Client,
    generationId,
    personId,
    teamId,
    selfieS3Keys,
    debugMode,
  } = input

  Logger.info('V3 Step 0: Starting asset preparation', {
    generationId,
    personId,
    teamId,
  })

  // Create preparation context
  const prepContext: ElementContext = {
    phase: 'preparation',
    settings: styleSettings,
    generationContext: {
      selfieS3Keys,
      userId: personId,
      teamId,
      generationId,
      // Pass services for elements to use
      downloadAsset,
      s3Client,
    },
    existingContributions: [],
  }

  // Get all elements from registry
  const allElements = compositionRegistry.getAll()

  // Filter elements that need preparation
  const elementsNeedingPrep = allElements.filter((element) => {
    if (!element.needsPreparation) {
      return false
    }
    try {
      return element.needsPreparation(prepContext)
    } catch (error) {
      Logger.error(`V3 Step 0: Error checking needsPreparation for ${element.id}`, {
        error: error instanceof Error ? error.message : String(error),
        elementId: element.id,
        generationId,
      })
      return false
    }
  })

  Logger.info('V3 Step 0: Elements requiring preparation', {
    count: elementsNeedingPrep.length,
    elementIds: elementsNeedingPrep.map((e) => e.id),
    generationId,
  })

  // Prepare assets in parallel
  const preparedAssets = new Map<string, PreparedAsset>()
  const preparationErrors: Array<{ elementId: string; error: string }> = []

  if (elementsNeedingPrep.length > 0) {
    const prepPromises = elementsNeedingPrep.map(async (element) => {
      try {
        Logger.debug(`V3 Step 0: Preparing assets for ${element.id}`, {
          generationId,
        })

        const startTime = Date.now()
        const asset = await element.prepare!(prepContext)
        const duration = Date.now() - startTime

        Logger.info(`V3 Step 0: Asset prepared for ${element.id}`, {
          elementId: element.id,
          assetType: asset.assetType,
          durationMs: duration,
          generationId,
        })

        return { success: true as const, elementId: element.id, asset }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        Logger.error(`V3 Step 0: Failed to prepare asset for ${element.id}`, {
          error: errorMessage,
          elementId: element.id,
          generationId,
        })
        return {
          success: false as const,
          elementId: element.id,
          error: errorMessage,
        }
      }
    })

    // Wait for all preparations to complete
    const results = await Promise.all(prepPromises)

    // Process results
    results.forEach((result) => {
      if (result.success) {
        const key = `${result.elementId}-${result.asset.assetType}`
        preparedAssets.set(key, result.asset)
        if (debugMode) {
          Logger.debug(`V3 Step 0: Stored prepared asset`, {
            key,
            elementId: result.elementId,
            assetType: result.asset.assetType,
            generationId,
          })
        }
      } else {
        preparationErrors.push({
          elementId: result.elementId,
          error: result.error,
        })
      }
    })
  }

  Logger.info('V3 Step 0: Asset preparation complete', {
    preparedCount: preparedAssets.size,
    errorCount: preparationErrors.length,
    preparedAssetKeys: Array.from(preparedAssets.keys()),
    generationId,
  })

  return {
    preparedAssets,
    preparationErrors,
  }
}
