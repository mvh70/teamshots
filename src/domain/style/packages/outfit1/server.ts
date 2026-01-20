import { outfit1 as outfit1Base } from './index'
import { buildDefaultReferencePayload, buildSplitSelfieComposites } from '@/lib/generation/reference-utils'
import { applyStandardPreset } from '../standard-settings'
import { resolveShotType } from '../../elements/shot-type/config'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { ensureServerDefaults, mergeUserSettings } from '../shared/utils'
import { resolvePackageAspectRatio } from '../shared/aspect-ratio-resolver'
import { downloadAssetAsBase64 } from '@/queue/workers/generate-image/s3-utils'
import { getS3BucketName, createS3Client } from '@/lib/s3-client'
import { compositionRegistry } from '../../elements/composition'
import { hasValue, predefined } from '../../elements/base/element-types'
import type { GenerationContext, GenerationPayload, ReferenceImage } from '@/types/generation'
import { CostTrackingService } from '@/domain/services/CostTrackingService'
import { STAGE_MODEL } from '@/queue/workers/generate-image/config'

import type { ServerStylePackage, PackageMetadata, PackageCapabilities } from '../types'

export type Outfit1ServerPackage = ServerStylePackage

// Package metadata for discovery and compatibility
const outfit1Metadata: PackageMetadata = {
  author: 'TeamShots',
  description: 'Professional outfit transfer package with garment collage generation',
  license: 'Proprietary',
  compatibility: {
    minVersion: '1.0.0',
    requires: [], // No dependencies
  },
  capabilities: {
    supportsCustomClothing: true,
    supportsBranding: true,
    supportsCustomBackgrounds: true,
    supportedWorkflowVersions: ['v3'],
    supportsPose: true,
    supportsExpression: true,
    supportsAspectRatio: true,
  },
}

export const outfit1Server: Outfit1ServerPackage = {
  ...outfit1Base,

  // Enhanced package fields
  featureFlag: 'outfitTransfer',
  metadata: outfit1Metadata,
  requiredElements: ['custom-clothing', 'subject', 'pose'],
  providedElements: [], // Could provide custom elements in the future

  // Lifecycle hooks
  async initialize() {
    Logger.info('[Outfit1Package] Initializing outfit1 package')
    // Perform any one-time setup here
  },

  validate() {
    // Validate package configuration
    return {
      valid: true,
      errors: [],
      warnings: [],
    }
  },

  onRegister() {
    Logger.debug('[Outfit1Package] Package registered')
  },

  onUnregister() {
    Logger.debug('[Outfit1Package] Package unregistered')
  },

  buildGenerationPayload: async ({
    generationId,
    personId,
    styleSettings,
    selfieKeys,
    processedSelfies,
    selfieTypeMap,
    options
  }: GenerationContext): Promise<GenerationPayload> => {
    // DEBUG: Log incoming styleSettings
    Logger.info('[DEBUG] buildGenerationPayload called', {
      generationId,
      hasCustomClothing: !!styleSettings.customClothing,
      customClothingMode: styleSettings.customClothing?.mode,
      customClothingOutfitS3Key: styleSettings.customClothing?.value?.outfitS3Key,
      customClothingAssetId: styleSettings.customClothing?.value?.assetId,
      fullCustomClothing: JSON.stringify(styleSettings.customClothing)
    })

    // Track package usage
    Telemetry.increment(`generation.package.${outfit1Base.id}`)
    Telemetry.increment(`generation.package.${outfit1Base.id}.workflow.${options.workflowVersion}`)

    // Apply correct priority hierarchy:
    // 1. Preset defaults (base layer - CORPORATE_HEADSHOT)
    // 2. Package defaults (middle layer - overwrites ALL categories from preset)
    // 3. User settings (top layer - overwrites only visible categories)

    // 1. Start with preset defaults (base configuration)
    const { settings: presetDefaults } = applyStandardPreset(
      styleSettings.presetId || outfit1Base.defaultPresetId,
      {},  // Empty - get pure preset defaults
      outfit1Base.presets || {}
    )

    // 2. Apply package defaults for ALL categories (package baseline)
    const withPackageDefaults = ensureServerDefaults(outfit1Base, presetDefaults)

    // 3. Apply user settings ONLY for visible categories (user customizations)
    const effectiveSettings = mergeUserSettings(
      withPackageDefaults,
      styleSettings,
      outfit1Base.visibleCategories
    )

    // DEBUG: Log effectiveSettings after merging
    Logger.info('[DEBUG] effectiveSettings after merging', {
      generationId,
      hasCustomClothing: !!effectiveSettings.customClothing,
      customClothingMode: effectiveSettings.customClothing?.mode,
      customClothingOutfitS3Key: effectiveSettings.customClothing?.value?.outfitS3Key,
      customClothingAssetId: effectiveSettings.customClothing?.value?.assetId,
      fullCustomClothing: JSON.stringify(effectiveSettings.customClothing),
      visibleCategories: outfit1Base.visibleCategories
    })

    // Use user's shotType choice if available, otherwise fall back to package default
    const userShotType = effectiveSettings.shotType
    const defaultShotType = outfit1Base.defaultSettings.shotType
    const resolvedShotType = hasValue(userShotType)
      ? userShotType.value.type
      : hasValue(defaultShotType)
        ? defaultShotType.value.type
        : 'medium-shot'
    effectiveSettings.shotType = predefined({ type: resolvedShotType })
    const shotTypeConfig = resolveShotType(resolvedShotType)
    const shotText = shotTypeConfig.id.replace(/-/g, ' ')

    // Resolve aspect ratio using shared logic
    const { ratioConfig, aspectRatio, aspectRatioDescription } = resolvePackageAspectRatio(
      effectiveSettings,
      shotTypeConfig,
      outfit1Base.id
    )

    const getSelfieBuffer = async (key: string): Promise<Buffer> => {
      const buffer = processedSelfies[key]
      if (!buffer) {
        throw new Error(`Selfie buffer not found for key: ${key}. All selfies should be preprocessed before calling buildGenerationPayload.`)
      }
      return buffer
    }

    // V3 workflow always uses composite reference
    const bucketName = getS3BucketName()
    const s3Client = createS3Client({ forcePathStyle: false })

    // Build split composites if selfieTypeMap is available
    let faceComposite: ReferenceImage | undefined
    let bodyComposite: ReferenceImage | undefined
    let selfieComposite: ReferenceImage | undefined

    if (selfieTypeMap && Object.keys(selfieTypeMap).length > 0) {
      Logger.info('Building split selfie composites (face/body)', {
        generationId,
        selfieTypeMap,
        selfieCount: selfieKeys.length
      })

      const splitComposites = await buildSplitSelfieComposites({
        selfieKeys,
        selfieTypeMap,
        getSelfieBuffer,
        generationId
      })

      faceComposite = splitComposites.faceComposite ?? undefined
      bodyComposite = splitComposites.bodyComposite ?? undefined
      selfieComposite = splitComposites.combinedComposite

      Logger.info('Split selfie composites built', {
        generationId,
        hasFaceComposite: !!faceComposite,
        hasBodyComposite: !!bodyComposite,
        hasCombinedComposite: !!selfieComposite
      })
    }

    const payload = await buildDefaultReferencePayload({
      styleSettings: effectiveSettings,
      selfieKeys,
      getSelfieBuffer,
      downloadAsset: (key) => downloadAssetAsBase64({ bucketName, s3Client, key }),
      generationId,
      shotDescription: shotText,
      aspectRatioDescription,
      aspectRatioSize: { width: ratioConfig.width, height: ratioConfig.height },
      workflowVersion: options.workflowVersion
    })
    const referenceImages = payload.referenceImages
    const labelInstruction = payload.labelInstruction

    // Build context to get rules (same logic as buildPrompt but we need the context)
    // Use element composition system to build payload

    const elementContext = {
      phase: 'person-generation' as const,
      settings: effectiveSettings,
      generationContext: {
        selfieS3Keys: selfieKeys,
        userId: personId,
        generationId,
      },
      existingContributions: [],
    }

    const contributions = await compositionRegistry.composeContributions(elementContext)

    // V3 workflow: All custom clothing handling moved to CustomClothingElement.prepare() in step 0
    // V2 legacy code removed

    // Merge contribution reference images (like garment collage) with default references
    // Convert contribution format { url, description, type } to workflow format { base64, mimeType, description }
    const contributionReferenceImages = (contributions.referenceImages || []).map(ref => {
      // Check if it's a data URL (from CustomClothingElement)
      if (ref.url?.startsWith('data:')) {
        const match = ref.url.match(/^data:(.*?);base64,(.*)$/)
        if (match) {
          return {
            base64: match[2],
            mimeType: match[1],
            description: ref.description,
          }
        }
      }
      // Return as-is if it already has base64 format
      return ref as unknown as { base64: string; mimeType: string; description?: string }
    }).filter(ref => ref.base64) // Filter out any that don't have base64

    const allReferenceImages = [...referenceImages, ...contributionReferenceImages]

    Logger.info('[Outfit1Package] Reference images merged', {
      generationId,
      defaultReferenceCount: referenceImages.length,
      contributionReferenceCount: contributionReferenceImages.length,
      totalReferenceCount: allReferenceImages.length,
      hasGarmentCollage: contributionReferenceImages.some(r =>
        r.description?.toLowerCase().includes('garment') ||
        r.description?.toLowerCase().includes('collage')
      ),
    })

    const promptString = JSON.stringify(contributions.payload, null, 2)

    return {
      prompt: promptString,
      mustFollowRules: contributions.mustFollow || [],
      freedomRules: contributions.freedom || [],
      referenceImages: allReferenceImages,
      labelInstruction,
      aspectRatio,
      aspectRatioDescription,
      // Split selfie composites for focused reference
      faceComposite,
      bodyComposite,
      selfieComposite
    }
  }
}

/**
 * Create garment collage using Gemini
 *
 * LEGACY: This function is no longer used.
 * V3 workflow uses CustomClothingElement.prepare() in step 0 preparation phase.
 */
async function createGarmentCollage(
  outfitImageBase64: string,
  outfitMimeType: string,
  logo: { base64: string; mimeType: string } | null,
  generationId: string
): Promise<
  | { success: true; data: { base64: string }; usage?: { inputTokens: number; outputTokens: number } }
  | { success: false; error: string; code?: string }
> {
  const startTime = Date.now()

  try {
    const { generateWithGemini } = await import('@/queue/workers/generate-image/gemini')

    const prompt = `Create a high-quality flat-lay garment collage from the attached outfit image.

GOAL: Extract and display ONLY the actual clothing items and accessories visible in the input image.

LAYOUT INSTRUCTIONS:
- Disassemble the outfit into its individual components.
- Arrange items in a clean, organized grid or knolling pattern on a neutral background (white or light gray).
- Ensure even spacing and no overlaps.
- Each item must be clearly separated.
- Add a subtle drop shadow to give depth.
- Label each item with a clean, sans-serif text label next to it (e.g., "Jacket", "Shirt", "Pants").

CRITICAL RULES (ANTI-HALLUCINATION):
1. NO DUPLICATES: Each physical item from the source image must appear EXACTLY ONCE. Do not show the same shirt twice.
2. ONLY VISIBLE ITEMS: Do not invent items. If the person is not wearing a watch, do not add a watch. If you cannot see shoes, do not add shoes.
3. NO HUMAN PARTS: Do not include hands, feet, heads, or bodies. Only the inanimate clothing/accessories.
4. EXACT MATCH: The extracted items must look identical to the source (same color, pattern, texture, logo).

ITEMS TO EXTRACT (ONLY IF VISIBLE):
- Outerwear (Jacket, Coat, Blazer) - if present
- Tops (Shirt, T-shirt, Sweater, Hoodie)
- Bottoms (Pants, Jeans, Shorts, Skirt)
- Footwear (One pair of shoes/boots) - IF VISIBLE
- Accessories (ONLY IF CLEARLY VISIBLE: Watch, Glasses, Hat, Bag, Belt, Scarf, Jewelry)

${logo ? `LOGO PLACEMENT (MANDATORY):
- You MUST place the provided logo on the primary top garment (Shirt/T-shirt/Hoodie).
- If there is an outer layer (Jacket), place the logo on the inner layer (Shirt) if visible, otherwise on the Jacket.
- Position the logo naturally on the chest area.
- It should look like it is printed or embroidered on the fabric.` : ''}

Style: Clean, commercial product photography.`

    // Build reference images
    const images = [
      {
        mimeType: outfitMimeType,
        base64: outfitImageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
        description: 'Outfit image to extract garments from'
      }
    ]

    // Add logo if provided
    if (logo) {
      images.push({
        mimeType: logo.mimeType,
        base64: logo.base64.replace(/^data:image\/[a-z]+;base64,/, ''),
        description: 'Logo to place on garments'
      })
    }

    Logger.info('[DEBUG] Garment collage prompt:', { prompt: prompt.substring(0, 300) + '...' })

    // Use the existing generation system with fallbacks
    const result = await generateWithGemini(
      prompt,
      images,
      '1:1', // Square aspect ratio for collage
      undefined, // no resolution specified
      {
        temperature: 0.2,
        stage: 'CLOTHING_COLLAGE',
      }
    )

    Logger.info('[DEBUG] Garment collage generation result', {
      generationId,
      hasImages: !!(result.images && result.images.length > 0),
      imageCount: result.images?.length || 0,
      provider: result.providerUsed,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens
    })

    if (!result.images || result.images.length === 0) {
      Logger.warn('Gemini did not return an image for garment collage', {
        generationId,
        provider: result.providerUsed,
        hasImages: !!result.images,
        imageCount: result.images?.length || 0
      })
      return { success: false, error: 'No image generated', code: 'NO_IMAGE' }
    }

    // Convert Buffer to base64
    const imageBuffer = result.images[0]
    const base64Image = imageBuffer.toString('base64')

    Logger.info('[DEBUG] Garment collage created successfully', {
      generationId,
      provider: result.providerUsed,
      imageSizeBytes: imageBuffer.length,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens
    })

    // Track cost using the result data
    await CostTrackingService.trackCall({
      generationId,
      provider: result.providerUsed || 'unknown',
      model: 'gemini-2.5-flash-image',
      inputTokens: result.usage.inputTokens || 0,
      outputTokens: result.usage.outputTokens || 0,
      imagesGenerated: 1,
      reason: 'outfit_collage_creation',
      result: 'success',
      durationMs: Date.now() - startTime
    })

    Telemetry.increment('outfit.collage.success')
    Telemetry.timing('outfit.collage.duration', Date.now() - startTime)

    return {
      success: true,
      data: { base64: base64Image },
      usage: {
        inputTokens: result.usage.inputTokens || 0,
        outputTokens: result.usage.outputTokens || 0
      }
    }

  } catch (error) {
    Logger.error('Gemini garment collage generation failed', {
      generationId,
      error: error instanceof Error ? error.message : String(error)
    })

    // Track failed cost
    await CostTrackingService.trackCall({
      generationId,
      provider: 'gemini-rest', // Default provider for Gemini calls (actual provider unknown on failure)
      model: 'gemini-2.5-flash-image',
      inputTokens: 0,
      outputTokens: 0,
      reason: 'outfit_collage_creation',
      result: 'failure',
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime
    })

    Telemetry.increment('outfit.collage.error')

    if (error instanceof Error) {
      if (error.message.includes('RATE_LIMIT')) {
        return { success: false, error: 'Rate limit exceeded', code: 'RATE_LIMIT' }
      }
      if (error.message.includes('SAFETY')) {
        return { success: false, error: 'Content policy violation', code: 'SAFETY' }
      }
    }

    return { success: false, error: 'Collage generation failed', code: 'GEMINI_ERROR' }
  }
}
