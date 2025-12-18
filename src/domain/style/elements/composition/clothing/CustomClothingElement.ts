/**
 * Custom Clothing Element
 *
 * Contributes custom outfit reference and color matching rules to person generation.
 * Handles garment collage references for outfit transfer.
 *
 * Implements preparation phase to create garment collages asynchronously.
 */

import {
  StyleElement,
  ElementContext,
  ElementContribution,
  type PreparedAsset,
} from '../../base/StyleElement'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { AssetService } from '@/domain/services/AssetService'
import { CostTrackingService } from '@/domain/services/CostTrackingService'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import { getS3BucketName } from '@/lib/s3-client'
import { prisma } from '@/lib/prisma'

export class CustomClothingElement extends StyleElement {
  readonly id = 'custom-clothing'
  readonly name = 'Custom Clothing'
  readonly description = 'Custom outfit reference and color matching for outfit transfer'

  // Clothing only affects person generation, not backgrounds
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no custom clothing configured
    if (!settings.customClothing) {
      return false
    }

    // Skip if no asset or outfit key
    if (!settings.customClothing.assetId && !settings.customClothing.outfitS3Key) {
      return false
    }

    // Only contribute to person generation
    return phase === 'person-generation'
  }

  /**
   * Check if this element needs to prepare assets (garment collage)
   */
  needsPreparation(context: ElementContext): boolean {
    const { settings } = context
    const clothing = settings.customClothing

    if (!clothing) {
      return false
    }

    // Need preparation if we have an asset to process
    return !!(clothing.assetId || clothing.outfitS3Key)
  }

  /**
   * Prepare garment collage in step 0
   *
   * This method:
   * 1. Resolves assetId to S3 key if needed
   * 2. Checks for cached collage
   * 3. Downloads outfit image and logo (if clothing position)
   * 4. Creates garment collage using Gemini
   * 5. Saves collage to S3
   * 6. Returns prepared asset for use in contribute()
   */
  async prepare(context: ElementContext): Promise<PreparedAsset> {
    const { settings, generationContext } = context
    const clothing = settings.customClothing!
    const generationId = generationContext.generationId || 'unknown'

    // Type guard for services - they should be available in preparation phase
    const downloadAsset = generationContext.downloadAsset as
      | ((key: string) => Promise<{ base64: string; mimeType: string } | null>)
      | undefined
    const s3Client = generationContext.s3Client as S3Client | undefined

    if (!downloadAsset || !s3Client) {
      throw new Error('CustomClothingElement.prepare(): downloadAsset and s3Client must be provided in generationContext')
    }

    const bucketName = getS3BucketName()

    Logger.info('[CustomClothingElement] Starting garment collage preparation', {
      generationId,
      hasAssetId: !!clothing.assetId,
      hasOutfitS3Key: !!clothing.outfitS3Key,
      hasCachedCollage: !!clothing.collageS3Key,
    })

    // 1. Resolve assetId to S3 key if needed
    let outfitKey = clothing.outfitS3Key
    if (!outfitKey && clothing.assetId) {
      try {
        const asset = await AssetService.getAsset(clothing.assetId)
        if (asset) {
          outfitKey = asset.s3Key
          Logger.info('[CustomClothingElement] Resolved assetId to S3 key', {
            generationId,
            assetId: clothing.assetId,
            s3Key: outfitKey,
          })
        } else {
          Logger.warn('[CustomClothingElement] Asset not found for assetId', {
            generationId,
            assetId: clothing.assetId,
          })
        }
      } catch (error) {
        Logger.error('[CustomClothingElement] Failed to resolve assetId', {
          generationId,
          assetId: clothing.assetId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (!outfitKey) {
      throw new Error('CustomClothingElement.prepare(): Could not resolve outfit S3 key')
    }

    let collageBase64: string | null = null
    let shouldSaveCollage = false

    // 2. Check for cached collage
    const cachedCollageKey = clothing.collageS3Key
    if (cachedCollageKey) {
      Logger.info('[CustomClothingElement] Checking cached garment collage', {
        cachedCollageKey,
        generationId,
      })
      try {
        const cachedCollage = await downloadAsset(cachedCollageKey)
        if (cachedCollage) {
          collageBase64 = cachedCollage.base64
          Logger.info('[CustomClothingElement] Using cached garment collage', {
            cachedCollageKey,
            generationId,
          })
        } else {
          Logger.warn('[CustomClothingElement] Cached collage not found, will regenerate', {
            cachedCollageKey,
            generationId,
          })
          shouldSaveCollage = true
        }
      } catch (error) {
        Logger.warn('[CustomClothingElement] Failed to load cached collage', {
          cachedCollageKey,
          generationId,
          error: error instanceof Error ? error.message : String(error),
        })
        shouldSaveCollage = true
      }
    } else {
      shouldSaveCollage = true
    }

    // 3. Generate collage if no cache
    if (!collageBase64) {
      // Download outfit image
      const outfitImage = await downloadAsset(outfitKey)
      if (!outfitImage) {
        throw new Error(`CustomClothingElement.prepare(): Failed to download outfit image: ${outfitKey}`)
      }

      // Download logo ONLY if branding is on clothing position
      let logoImage: { base64: string; mimeType: string } | null = null
      if (
        settings.branding?.type === 'include' &&
        settings.branding.logoKey &&
        settings.branding.position === 'clothing'
      ) {
        try {
          logoImage = await downloadAsset(settings.branding.logoKey)
          if (logoImage) {
            Logger.info('[CustomClothingElement] Logo downloaded for clothing branding', {
              generationId,
              position: settings.branding.position,
            })
          } else {
            Logger.warn('[CustomClothingElement] Logo download returned null', {
              logoKey: settings.branding.logoKey,
              generationId,
            })
          }
        } catch (error) {
          Logger.warn('[CustomClothingElement] Failed to download logo, proceeding without', {
            logoKey: settings.branding.logoKey,
            generationId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      // 4. Create garment collage
      const collageResult = await this.createGarmentCollage(
        outfitImage.base64,
        outfitImage.mimeType,
        logoImage,
        generationId
      )

      if (collageResult.success) {
        collageBase64 = collageResult.data.base64

        // 5. Save collage to S3
        if (shouldSaveCollage) {
          try {
            const collageBuffer = Buffer.from(collageBase64, 'base64')
            const collageKey = `collages/${generationId}-${Date.now()}.png`

            await s3Client.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: collageKey,
                Body: collageBuffer,
                ContentType: 'image/png',
              })
            )

            Logger.info('[CustomClothingElement] Saved garment collage to S3', {
              collageKey,
              generationId,
            })

            // Update context with cached collage key
            await this.updateContextWithCollageKey(generationId, collageKey)

            // Save to tmp folder in development
            if (process.env.NODE_ENV === 'development') {
              await this.saveToDevelopmentFolder(generationId, collageBuffer)
            }
          } catch (uploadError) {
            Logger.error('[CustomClothingElement] Failed to save collage to S3', {
              generationId,
              error: uploadError instanceof Error ? uploadError.message : String(uploadError),
            })
          }
        }
      } else {
        // If collage generation failed, fallback to original outfit photo
        Logger.warn('[CustomClothingElement] Collage generation failed, using original outfit', {
          generationId,
          error: collageResult.error,
          code: collageResult.code,
        })
        collageBase64 = outfitImage.base64
      }
    }

    // 6. Return prepared asset
    return {
      elementId: this.id,
      assetType: 'garment-collage',
      data: {
        base64: collageBase64,
        mimeType: 'image/png',
        metadata: {
          outfitKey,
          cachedCollageKey,
          colors: clothing.colors,
        },
      },
    }
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings, generationContext } = context
    const clothing = settings.customClothing!

    // Instructions for wearing the custom clothing
    const instructions = [
      'The person must wear the exact clothing items shown in the garment collage reference image',
      'Match all visible clothing details: style, fit, patterns, and textures',
      'Ensure all garments are worn appropriately and naturally',
    ]

    // Strict rules for clothing matching
    const mustFollow = [
      'All garments from the collage must be present and visible on the person',
      'Clothing must fit naturally on the person\'s body',
      'No duplicate accessories - only include items from collage once',
      'Maintain clothing colors as specified in the reference',
      'Do not add clothing items that are not in the reference',
    ]

    // Build metadata with clothing information
    const metadata: Record<string, unknown> = {
      hasCustomClothing: true,
      assetId: clothing.assetId,
      outfitS3Key: clothing.outfitS3Key,
    }

    // Include color information if available
    if (clothing.colors) {
      metadata.clothingColors = clothing.colors
      instructions.push(
        'Reference the clothing colors data provided in metadata for accurate color matching'
      )
    }

    // Include description if available
    if (clothing.description) {
      metadata.description = clothing.description
    }

    // Get prepared collage from context (if available)
    const preparedAssets = generationContext.preparedAssets
    const collageAsset = preparedAssets?.get(`${this.id}-garment-collage`)

    // Add reference image if collage was prepared
    const referenceImages = []
    if (collageAsset?.data.base64) {
      referenceImages.push({
        url: `data:${collageAsset.data.mimeType || 'image/png'};base64,${collageAsset.data.base64}`,
        description: 'GARMENT COLLAGE - Dress the person in these exact clothing items. Match the style, fit, and details shown in each garment precisely. Use the specified clothing_colors from metadata for accurate color rendering. This is professional attire - ensure proper fit and styling.',
        type: 'clothing' as const,
      })

      Logger.info('[CustomClothingElement] Added garment collage to contribution', {
        generationId: generationContext.generationId,
        fromCache: !!collageAsset.data.metadata?.cachedCollageKey,
      })
    }

    return {
      instructions,
      mustFollow,
      metadata,
      referenceImages,
    }
  }

  /**
   * Create garment collage using Gemini
   */
  private async createGarmentCollage(
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

${
  logo
    ? `LOGO PLACEMENT (MANDATORY):
- You MUST place the provided logo on the primary top garment (Shirt/T-shirt/Hoodie).
- If there is an outer layer (Jacket), place the logo on the inner layer (Shirt) if visible, otherwise on the Jacket.
- Position the logo naturally on the chest area.
- It should look like it is printed or embroidered on the fabric.`
    : ''
}

Style: Clean, commercial product photography.`

      // Build reference images
      const images = [
        {
          mimeType: outfitMimeType,
          base64: outfitImageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
          description: 'Outfit image to extract garments from',
        },
      ]

      // Add logo if provided
      if (logo) {
        images.push({
          mimeType: logo.mimeType,
          base64: logo.base64.replace(/^data:image\/[a-z]+;base64,/, ''),
          description: 'Logo to place on garments',
        })
      }

      // Generate collage
      const result = await generateWithGemini(
        prompt,
        images,
        '1:1', // Square aspect ratio
        undefined,
        { temperature: 0.2 }
      )

      if (!result.images || result.images.length === 0) {
        Logger.warn('[CustomClothingElement] Gemini did not return collage image', {
          generationId,
          provider: result.providerUsed,
        })
        return { success: false, error: 'No image generated', code: 'NO_IMAGE' }
      }

      const imageBuffer = result.images[0]
      const base64Image = imageBuffer.toString('base64')

      // Track cost
      await CostTrackingService.trackCall({
        generationId,
        provider: result.providerUsed || 'unknown',
        model: 'gemini-2.5-flash-image',
        inputTokens: result.usage.inputTokens || 0,
        outputTokens: result.usage.outputTokens || 0,
        imagesGenerated: 1,
        reason: 'outfit_collage_creation',
        result: 'success',
        durationMs: Date.now() - startTime,
      })

      Telemetry.increment('outfit.collage.success')
      Telemetry.timing('outfit.collage.duration', Date.now() - startTime)

      return {
        success: true,
        data: { base64: base64Image },
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
        },
      }
    } catch (error) {
      Logger.error('[CustomClothingElement] Gemini collage generation failed', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Track failed cost
      await CostTrackingService.trackCall({
        generationId,
        provider: 'gemini-rest',
        model: 'gemini-2.5-flash-image',
        inputTokens: 0,
        outputTokens: 0,
        reason: 'outfit_collage_creation',
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
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

  /**
   * Update context with collage S3 key for future caching
   */
  private async updateContextWithCollageKey(generationId: string, collageKey: string): Promise<void> {
    try {
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { contextId: true },
      })

      if (generation?.contextId) {
        const existingContext = await prisma.context.findUnique({
          where: { id: generation.contextId },
          select: { settings: true },
        })

        if (existingContext?.settings) {
          const settings = existingContext.settings as Record<string, unknown>
          await prisma.context.update({
            where: { id: generation.contextId },
            data: {
              settings: {
                ...settings,
                customClothing: {
                  ...(settings.customClothing as Record<string, unknown>),
                  collageS3Key: collageKey,
                },
              } as Parameters<typeof prisma.context.update>[0]['data']['settings'],
            },
          })
          Logger.info('[CustomClothingElement] Updated context with collage S3 key', {
            contextId: generation.contextId,
            collageKey,
          })
        }
      }
    } catch (error) {
      Logger.warn('[CustomClothingElement] Failed to update context with collage key', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Save collage to tmp folder in development
   */
  private async saveToDevelopmentFolder(generationId: string, collageBuffer: Buffer): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')

      const tmpDir = path.join(process.cwd(), 'tmp', 'collages')
      await fs.mkdir(tmpDir, { recursive: true })

      await fs.writeFile(path.join(tmpDir, `${generationId}-collage.png`), collageBuffer)

      Logger.info('[CustomClothingElement] Saved collage to tmp folder', {
        path: `tmp/collages/${generationId}-collage.png`,
      })
    } catch (error) {
      Logger.warn('[CustomClothingElement] Failed to save collage to tmp folder', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Validate custom clothing settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const clothing = settings.customClothing

    if (!clothing) {
      return errors
    }

    // Must have either assetId or outfitS3Key
    if (!clothing.assetId && !clothing.outfitS3Key) {
      errors.push('Custom clothing requires either assetId or outfitS3Key')
    }

    return errors
  }

  // High priority - clothing should be established early, before accessories
  get priority(): number {
    return 50
  }
}

// Export singleton instance
export const customClothingElement = new CustomClothingElement()
export default customClothingElement
