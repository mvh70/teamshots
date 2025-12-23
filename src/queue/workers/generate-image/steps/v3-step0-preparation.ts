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
  type StyleElement,
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
 * Build dependency batches for element preparation
 *
 * This function analyzes element dependencies and organizes elements into batches
 * that can be executed in order. Elements within a batch can run in parallel,
 * but batches must run sequentially to respect dependencies.
 *
 * @param elements - Elements that need preparation
 * @returns Batches of elements and any dependency errors
 */
function buildDependencyBatches(elements: StyleElement[]) {
  const batches: StyleElement[][] = []
  const errors: Array<{ elementId: string; error: string }> = []
  const processed = new Set<string>()
  const elementMap = new Map(elements.map((e) => [e.id, e]))

  // Keep building batches until all elements are processed or we detect a deadlock
  let remainingElements = [...elements]
  let previousCount = remainingElements.length

  while (remainingElements.length > 0) {
    // Find elements whose dependencies are satisfied
    const currentBatch = remainingElements.filter((element) => {
      const deps = element.dependsOn || []

      // Check if all dependencies are satisfied
      const allDepsProcessed = deps.every((depId) => {
        // Dependency must either be processed or not in the preparation list
        return processed.has(depId) || !elementMap.has(depId)
      })

      return allDepsProcessed
    })

    // If no elements can be processed, we have a circular dependency or missing dependency
    if (currentBatch.length === 0) {
      remainingElements.forEach((element) => {
        const deps = element.dependsOn || []
        const unsatisfiedDeps = deps.filter(
          (depId) => !processed.has(depId) && elementMap.has(depId)
        )
        errors.push({
          elementId: element.id,
          error: `Circular or unsatisfied dependencies: ${unsatisfiedDeps.join(', ')}`,
        })
      })
      break
    }

    // Add batch and mark elements as processed
    batches.push(currentBatch)
    currentBatch.forEach((element) => processed.add(element.id))

    // Remove processed elements from remaining
    remainingElements = remainingElements.filter((e) => !processed.has(e.id))

    // Detect infinite loop (should not happen with correct logic)
    if (remainingElements.length === previousCount) {
      remainingElements.forEach((element) => {
        errors.push({
          elementId: element.id,
          error: 'Failed to resolve dependencies (infinite loop detected)',
        })
      })
      break
    }
    previousCount = remainingElements.length
  }

  return { batches, errors }
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

  // Prepare assets respecting dependencies
  const preparedAssets = new Map<string, PreparedAsset>()
  const preparationErrors: Array<{ elementId: string; error: string }> = []

  if (elementsNeedingPrep.length > 0) {
    // Build dependency graph and execute in topological order
    const { batches, errors: graphErrors } = buildDependencyBatches(elementsNeedingPrep)

    // Add any dependency errors
    graphErrors.forEach((error) => {
      preparationErrors.push(error)
      Logger.error('V3 Step 0: Dependency graph error', {
        error: error.error,
        elementId: error.elementId,
        generationId,
      })
    })

    // Execute batches sequentially (elements within a batch run in parallel)
    for (const [batchIndex, batch] of batches.entries()) {
      Logger.info(`V3 Step 0: Executing batch ${batchIndex + 1}/${batches.length}`, {
        elementIds: batch.map((e) => e.id),
        generationId,
      })

      // Update context with accumulated prepared assets
      const currentContext: ElementContext = {
        ...prepContext,
        generationContext: {
          ...prepContext.generationContext,
          preparedAssets,
        },
      }

      const batchPromises = batch.map(async (element) => {
        try {
          Logger.debug(`V3 Step 0: Preparing assets for ${element.id}`, {
            generationId,
          })

          const startTime = Date.now()
          const asset = await element.prepare!(currentContext)
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

      // Wait for all elements in this batch to complete
      const batchResults = await Promise.all(batchPromises)

      // Process batch results and add to prepared assets
      batchResults.forEach((result) => {
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
