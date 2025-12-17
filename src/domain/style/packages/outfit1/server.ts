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
import { PutObjectCommand } from '@aws-sdk/client-s3'
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
import { prisma } from '@/lib/prisma'

export type Outfit1ServerPackage = typeof outfit1Base & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

export const outfit1Server: Outfit1ServerPackage = {
  ...outfit1Base,
  buildGenerationPayload: async ({
    generationId,
    styleSettings,
    selfieKeys,
    processedSelfies,
    options
  }: GenerationContext): Promise<GenerationPayload> => {
    // DEBUG: Log incoming styleSettings
    Logger.info('[DEBUG] buildGenerationPayload called', {
      generationId,
      hasCustomClothing: !!styleSettings.customClothing,
      customClothingType: styleSettings.customClothing?.type,
      customClothingOutfitS3Key: styleSettings.customClothing?.outfitS3Key,
      customClothingAssetId: styleSettings.customClothing?.assetId,
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
      customClothingType: effectiveSettings.customClothing?.type,
      customClothingOutfitS3Key: effectiveSettings.customClothing?.outfitS3Key,
      customClothingAssetId: effectiveSettings.customClothing?.assetId,
      fullCustomClothing: JSON.stringify(effectiveSettings.customClothing),
      visibleCategories: outfit1Base.visibleCategories
    })

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

    // Apply custom clothing if outfit is set (either user-choice or predefined with outfit)
    // DEBUG: Log custom clothing data before processing
    Logger.info('[DEBUG] Custom clothing check', {
      generationId,
      hasCustomClothingObject: !!effectiveSettings.customClothing,
      customClothingType: effectiveSettings.customClothing?.type,
      hasOutfitS3Key: !!effectiveSettings.customClothing?.outfitS3Key,
      hasAssetId: !!effectiveSettings.customClothing?.assetId,
      outfitS3Key: effectiveSettings.customClothing?.outfitS3Key,
      assetId: effectiveSettings.customClothing?.assetId,
      hasCachedCollage: !!effectiveSettings.customClothing?.collageS3Key,
      fullCustomClothingObject: JSON.stringify(effectiveSettings.customClothing)
    })

    const hasCustomOutfit = effectiveSettings.customClothing &&
      (effectiveSettings.customClothing.outfitS3Key || effectiveSettings.customClothing.assetId)

    Logger.info('[DEBUG] hasCustomOutfit result', { generationId, hasCustomOutfit })

    if (hasCustomOutfit && effectiveSettings.customClothing) {
      Logger.info('[DEBUG] Entering custom clothing block', { generationId })
      const customClothingPrompt = customClothing.buildCustomClothingPrompt(effectiveSettings.customClothing)
      Logger.info('[DEBUG] Custom clothing prompt built', {
        generationId,
        hasPrompt: !!customClothingPrompt,
        promptLength: customClothingPrompt?.length,
        prompt: customClothingPrompt
      })

      if (customClothingPrompt) {
        // Add outfit description to the subject prompt
        if (typeof context.payload.subject !== 'object' || context.payload.subject === null) {
          context.payload.subject = {}
        }
        (context.payload.subject as Record<string, unknown>).outfit = customClothingPrompt
        Logger.info('[DEBUG] Added outfit to context.payload.subject', {
          generationId,
          subjectPayload: JSON.stringify(context.payload.subject)
        })
      }

      // Add garment reference to referenceImages
      const outfitKey = effectiveSettings.customClothing.outfitS3Key
      const cachedCollageKey = effectiveSettings.customClothing.collageS3Key

      if (outfitKey) {
        try {
          let collageBase64: string | null = null
          let shouldSaveCollage = false

          // Check if we have a cached collage
          if (cachedCollageKey) {
            Logger.info('Using cached garment collage', { cachedCollageKey, generationId })
            const cachedCollage = await downloadAssetAsBase64({ bucketName, s3Client, key: cachedCollageKey })
            if (cachedCollage) {
              collageBase64 = cachedCollage.base64
            } else {
              Logger.warn('Cached collage not found, will regenerate', { cachedCollageKey, generationId })
              shouldSaveCollage = true
            }
          } else {
            shouldSaveCollage = true
          }

          // If no cached collage, generate a new one
          if (!collageBase64) {
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
              collageBase64 = collageResult.data.base64

              // Save collage to S3 if needed
              if (shouldSaveCollage) {
                try {
                  const collageBuffer = Buffer.from(collageBase64, 'base64')
                  const collageKey = `collages/${generationId}-${Date.now()}.png`

                  await s3Client.send(
                    new PutObjectCommand({
                      Bucket: bucketName,
                      Key: collageKey,
                      Body: collageBuffer,
                      ContentType: 'image/png'
                    })
                  )

                  Logger.info('Saved garment collage to S3', { collageKey, generationId })

                  // Update context with cached collage key (separate try-catch to not block tmp save)
                  // Get contextId from generation record
                  const generation = await prisma.generation.findUnique({
                    where: { id: generationId },
                    select: { contextId: true }
                  })

                  if (generation?.contextId) {
                    try {
                      await prisma.context.update({
                        where: { id: generation.contextId },
                        data: {
                          settings: {
                            ...effectiveSettings,
                            customClothing: {
                              ...effectiveSettings.customClothing,
                              collageS3Key: collageKey
                            }
                          } as unknown as Parameters<typeof prisma.context.update>[0]['data']['settings']
                        }
                      })
                      Logger.info('Updated context with collage S3 key', { contextId: generation.contextId, collageKey })
                    } catch (contextError) {
                      Logger.warn('Failed to update context with collage key', {
                        contextId: generation.contextId,
                        error: contextError instanceof Error ? contextError.message : String(contextError)
                      })
                    }
                  }

                  // Save to tmp folder in development
                  if (process.env.NODE_ENV === 'development') {
                    try {
                      const fs = await import('fs/promises')
                      const path = await import('path')

                      const tmpDir = path.join(process.cwd(), 'tmp', 'collages')
                      await fs.mkdir(tmpDir, { recursive: true })

                      await fs.writeFile(
                        path.join(tmpDir, `${generationId}-collage.png`),
                        collageBuffer
                      )

                      Logger.info('Saved collage to tmp folder', {
                        path: `tmp/collages/${generationId}-collage.png`
                      })
                    } catch (tmpError) {
                      Logger.warn('Failed to save collage to tmp folder', {
                        error: tmpError instanceof Error ? tmpError.message : String(tmpError)
                      })
                    }
                  }
                } catch (uploadError) {
                  Logger.error('Failed to save collage to S3', {
                    generationId,
                    error: uploadError instanceof Error ? uploadError.message : String(uploadError)
                  })
                }
              }
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
          }

          // Add collage to reference images (whether cached or newly generated)
          if (collageBase64) {
            if (!payload.referenceImages) {
              payload.referenceImages = []
            }

            payload.referenceImages.push({
              base64: collageBase64,
              mimeType: 'image/png',
              description: 'Garment collage - dress the person using these exact clothing items and style. Match the colors, fit, and details shown in each garment.'
            })

            Logger.info('Added garment collage to reference images', {
              generationId,
              fromCache: !!cachedCollageKey
            })
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
    const { generateWithGemini } = await import('@/queue/workers/generate-image/gemini')

    const prompt = `Ultra-realistic 8K flat-lay photo in strict knolling style. Top-down 90º shot of the clothing objects from the attached image, fully disassembled into 8–12 key parts and arranged in a clean grid or radial pattern on a minimalist wooden or matte gray table. Even spacing, perfect alignment, no overlaps, no extra objects. Soft, diffused multi-source lighting with subtle shadows, neutral color balance and crisp focus across the whole frame. Highly detailed real-world materials (fabric textures, buttons, zippers, stitching). For every part, add a thin white rectangular frame and a short, sharp English label in clean sans-serif text, placed beside the component without covering it; annotations must be legible but unobtrusive.

Key clothing items to display from the reference image:
- Shirt/top (main upper garment)
- Jacket/blazer (if present)
- Pants/trousers
- Shoes (if visible)
- Accessories (belt, tie, pocket square, etc. if present)

${logo ? `LOGO PLACEMENT: If a logo image is provided, place it naturally on the shirt or jacket as if embroidered or printed on the fabric.` : ''}

Style: Professional product photography, sharp focus, minimal aesthetic.`

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
        temperature: 0.3
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
