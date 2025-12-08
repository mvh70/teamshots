import { outfit1 as outfit1Base } from './index'
import { buildDefaultReferencePayload } from '@/lib/generation/reference-utils'
import { applyStandardPreset } from '../standard-settings'
import { resolveShotType } from '../../elements/shot-type/config'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { ensureServerDefaults, mergeUserSettings } from '../shared/utils'
import { resolvePackageAspectRatio } from '../shared/aspect-ratio-resolver'
import { downloadAssetAsBase64 } from '@/queue/workers/generate-image/s3-utils'
import { getS3BucketName, createS3Client } from '@/lib/s3-client'
import { buildStandardPrompt } from '../../prompt-builders/context'
import * as shotTypeElement from '../../elements/shot-type'
import * as cameraSettings from '../../elements/camera-settings'
import * as lighting from '../../elements/lighting'
import * as pose from '../../elements/pose'
import * as backgroundElement from '../../elements/background'
import * as customClothing from '../../elements/custom-clothing'
import * as subjectElement from '../../elements/subject'
import * as branding from '../../elements/branding'
import type { GenerationContext, GenerationPayload } from '@/types/generation'
import { CostTrackingService } from '@/domain/services/CostTrackingService'
import type { Part } from '@google-cloud/vertexai'

export type Outfit1ServerPackage = typeof outfit1Base & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

type GeminiContentPart = Part

export const outfit1Server: Outfit1ServerPackage = {
  ...outfit1Base,
  buildGenerationPayload: async ({
    generationId,
    styleSettings,
    selfieKeys,
    processedSelfies,
    options
  }: GenerationContext): Promise<GenerationPayload> => {
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

    // Use package default shotType (respects package configuration)
    const packageShotType = outfit1Base.defaultSettings.shotType?.type || 'medium-shot'
    effectiveSettings.shotType = { type: packageShotType }
    const shotTypeConfig = resolveShotType(packageShotType)
    const shotText = shotTypeConfig.label

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

    const shouldUseComposite: boolean =
      options.workflowVersion === 'v3' ||
      (options.useCompositeReference &&
        (styleSettings.background?.type === 'custom' ||
          (styleSettings.branding?.type !== 'exclude' && Boolean(styleSettings.branding?.logoKey))))

    const bucketName = getS3BucketName()
    const s3Client = createS3Client({ forcePathStyle: false })

    const payload = await buildDefaultReferencePayload({
      styleSettings: effectiveSettings,
      selfieKeys,
      getSelfieBuffer,
      downloadAsset: (key) => downloadAssetAsBase64({ bucketName, s3Client, key }),
      useCompositeReference: shouldUseComposite,
      generationId,
      shotDescription: shotText,
      aspectRatioDescription,
      aspectRatioSize: { width: ratioConfig.width, height: ratioConfig.height },
      workflowVersion: options.workflowVersion
    })
    const referenceImages = payload.referenceImages
    const labelInstruction = payload.labelInstruction

    // Build context to get rules (same logic as buildPrompt but we need the context)
    const context = buildStandardPrompt({
      settings: effectiveSettings,
      defaultPresetId: outfit1Base.defaultPresetId,
      presets: outfit1Base.presets || {}
    })

    // Apply elements in dependency order (same as buildPrompt)
    shotTypeElement.applyToPayload(context)
    cameraSettings.applyToPayload(context)
    lighting.applyToPayload(context)
    pose.applyToPayload(context)
    backgroundElement.applyToPayload(context)

    // Apply custom clothing if enabled
    if (effectiveSettings.customClothing?.enabled) {
      const customClothingPrompt = customClothing.buildCustomClothingPrompt(effectiveSettings.customClothing)
      if (customClothingPrompt) {
        // Add outfit description to the subject prompt
        if (typeof context.payload.subject !== 'object' || context.payload.subject === null) {
          context.payload.subject = {}
        }
        (context.payload.subject as Record<string, unknown>).outfit = customClothingPrompt
      }

      // Add garment reference to referenceImages
      const outfitKey = effectiveSettings.customClothing.outfitS3Key

      if (outfitKey) {
        try {
          // Download the original outfit image
          const outfitImage = await downloadAssetAsBase64({ bucketName, s3Client, key: outfitKey })
          if (!outfitImage) {
            Logger.warn('Outfit image download returned null', { outfitKey, generationId })
          } else {
            // Download logo if provided (for branding on outfit)
            let logoImage: { base64: string; mimeType: string } | null = null
            if (effectiveSettings.branding?.type !== 'exclude' && effectiveSettings.branding?.logoKey) {
              try {
                logoImage = await downloadAssetAsBase64({ bucketName, s3Client, key: effectiveSettings.branding.logoKey })
                if (!logoImage) {
                  Logger.warn('Logo image download returned null, proceeding without logo', {
                    logoKey: effectiveSettings.branding.logoKey,
                    generationId
                  })
                }
              } catch (error) {
                Logger.warn('Failed to download logo image, proceeding without logo', {
                  logoKey: effectiveSettings.branding.logoKey,
                  generationId,
                  error: error instanceof Error ? error.message : String(error)
                })
              }
            }

            // Generate garment collage using Gemini
            const collageResult = await createGarmentCollage(
              outfitImage.base64,
              outfitImage.mimeType,
              logoImage,
              generationId
            )

            if (!payload.referenceImages) {
              payload.referenceImages = []
            }

            if (collageResult.success) {
              // Use the generated collage
              payload.referenceImages.push({
                base64: collageResult.data.base64,
                mimeType: 'image/png',
                description: 'Garment collage - dress the person using these exact clothing items and style. Match the colors, fit, and details shown in each garment.'
              })

              Logger.info('Added garment collage to reference images', {
                generationId,
                hasLogo: !!logoImage
              })
            } else {
              // Fallback to original outfit photo
              payload.referenceImages.push({
                base64: outfitImage.base64,
                mimeType: outfitImage.mimeType,
                description: 'Reference outfit - match the clothing style shown in this image'
              })

              Logger.warn('Garment collage generation failed, using original outfit photo', {
                generationId,
                error: collageResult.error,
                code: collageResult.code
              })
            }
          }
        } catch (error) {
          Logger.error('Failed to process outfit image', {
            outfitKey,
            generationId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }

    subjectElement.applyToPayload(context)
    branding.applyToPayload(context)

    const promptString = JSON.stringify(context.payload, null, 2)

    return {
      prompt: promptString,
      mustFollowRules: context.mustFollowRules,
      freedomRules: context.freedomRules,
      referenceImages,
      labelInstruction,
      aspectRatio,
      aspectRatioDescription
    }
  }
}

/**
 * Create garment collage using Gemini
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
    const { VertexAI } = await import('@google-cloud/vertexai')

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'teamshots'
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'

    const vertexAI = new VertexAI({ project: projectId, location })
    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      }
    })

    const prompt = `You are a professional clothing stylist creating a garment collage for a headshot photoshoot.

TASK: Analyze this outfit photo and create a neat collage showing the individual clothing items extracted from this outfit.

STEPS:
1. Identify and extract these garment items (if visible):
   - Shirt/top (the main upper garment)
   - Jacket/blazer (outer layer, if present)
   - Pants/trousers (lower garment)
   - Shoes (if visible in the photo)

2. For each garment:
   - Isolate it from the person
   - Show it as if laid flat or on a mannequin
   - Maintain the original colors, textures, and style
   - Keep details like collars, cuffs, buttons clearly visible

3. Arrange the items in a clean grid layout:
   - Use a 2x2 grid if 4 items are present
   - Use a 1x3 vertical layout if 3 items
   - Use a 1x2 horizontal layout if 2 items
   - Clean white or light gray background
   - Each garment clearly separated and labeled

${logo ? `
4. LOGO PLACEMENT (IMPORTANT):
   - A logo image is provided separately
   - Place this logo naturally on the appropriate garment(s)
   - Typically position on the chest area of the shirt or jacket
   - Make it look like it's embroidered or printed on the fabric
   - Ensure logo is clearly visible but proportional
   - Logo should follow the contours of the fabric naturally
` : ''}

REQUIREMENTS:
- Remove the person completely - show only the clothing items
- Maintain professional presentation
- Each garment should be clearly identifiable
- Colors and patterns must match the original exactly
- Professional studio-quality presentation

OUTPUT: Generate a single collage image showing all extracted garments.`

    // Build the request parts
    const parts: GeminiContentPart[] = [
      {
        inlineData: {
          mimeType: outfitMimeType,
          data: outfitImageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
        }
      }
    ]

    // Add logo if provided
    if (logo) {
      parts.push({
        inlineData: {
          mimeType: logo.mimeType,
          data: logo.base64.replace(/^data:image\/[a-z]+;base64,/, '')
        }
      })
    }

    // Add text prompt
    parts.push({ text: prompt })

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts
      }]
    })

    const response = result.response

    // Extract generated image from response
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part: { inlineData?: { mimeType: string; data: string } }) =>
        part.inlineData?.mimeType?.startsWith('image/')
    )

    if (!imagePart?.inlineData?.data) {
      Logger.warn('Gemini did not return an image for garment collage', {
        generationId,
        response: JSON.stringify(response)
      })
      return { success: false, error: 'No image generated', code: 'NO_IMAGE' }
    }

    // Extract usage metadata
    const usage = {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0
    }

    // Track cost (no personId/teamId available in this context, will be tracked at generation level)
    await CostTrackingService.trackCall({
      generationId,
      provider: 'vertex',
      model: 'gemini-2.5-flash-image',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      imagesGenerated: 1,
      reason: 'outfit_collage_creation',
      result: 'success',
      durationMs: Date.now() - startTime
    })

    Telemetry.increment('outfit.collage.success')
    Telemetry.timing('outfit.collage.duration', Date.now() - startTime)

    return {
      success: true,
      data: { base64: imagePart.inlineData.data },
      usage
    }

  } catch (error) {
    Logger.error('Gemini garment collage generation failed', {
      generationId,
      error: error instanceof Error ? error.message : String(error)
    })

    // Track failed cost
    await CostTrackingService.trackCall({
      generationId,
      provider: 'vertex',
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
