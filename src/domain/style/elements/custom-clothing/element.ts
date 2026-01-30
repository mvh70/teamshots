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
} from '../base/StyleElement'
import { hasValue } from '../base/element-types'
import { Logger } from '@/lib/logger'
import { STAGE_MODEL } from '@/queue/workers/generate-image/config'
import { Telemetry } from '@/lib/telemetry'
import { AssetService } from '@/domain/services/AssetService'
import { CostTrackingService } from '@/domain/services/CostTrackingService'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import { getS3BucketName } from '@/lib/s3-client'
import { prisma } from '@/lib/prisma'
import { autoRegisterElement } from '../composition/registry'

/**
 * Structured description of garments in the collage
 */
export interface GarmentItem {
  category: 'outerwear' | 'top' | 'bottom' | 'footwear' | 'accessory'
  type: string
  color: {
    primary: string
    secondary?: string | null
    pattern: 'solid' | 'striped' | 'checkered' | 'patterned' | 'textured'
  }
  material?: string | null
  style: string
  fit?: string | null
  details: string[]
}

export interface GarmentDescription {
  items: GarmentItem[]
  overallStyle: string
  colorPalette: string[]
  layering: string
  hasLogo: boolean
  logoDescription?: string | null
}

export class CustomClothingElement extends StyleElement {
  readonly id = 'custom-clothing'
  readonly name = 'Custom Clothing'
  readonly description = 'Custom outfit reference and color matching for outfit transfer'

  // Clothing only affects person generation, not backgrounds
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context
    const clothing = settings.customClothing
    const value = clothing?.value

    // Skip if no custom clothing configured
    if (!clothing) {
      Logger.debug('[CustomClothingElement] isRelevantForPhase: no customClothing settings', { phase })
      return false
    }

    // Skip if no asset or outfit key in value
    if (!value?.assetId && !value?.outfitS3Key) {
      Logger.debug('[CustomClothingElement] isRelevantForPhase: no assetId or outfitS3Key', {
        phase,
        customClothingMode: clothing.mode,
      })
      return false
    }

    const isRelevant = phase === 'person-generation'
    Logger.info('[CustomClothingElement] isRelevantForPhase result', {
      phase,
      isRelevant,
      hasAssetId: !!value.assetId,
      hasOutfitS3Key: !!value.outfitS3Key,
    })
    // Only contribute to person generation
    return isRelevant
  }

  /**
   * Check if this element needs to prepare assets (garment collage)
   */
  needsPreparation(context: ElementContext): boolean {
    const { settings, generationContext } = context
    const clothing = settings.customClothing
    const value = clothing?.value

    if (!clothing) {
      Logger.debug('[CustomClothingElement] needsPreparation: no customClothing settings')
      return false
    }

    // Need preparation if we have an asset to process in value
    const needsPrep = !!(value?.assetId || value?.outfitS3Key)
    Logger.info('[CustomClothingElement] needsPreparation result', {
      generationId: generationContext?.generationId,
      needsPrep,
      hasAssetId: !!value?.assetId,
      hasOutfitS3Key: !!value?.outfitS3Key,
      clothingMode: clothing.mode,
    })
    return needsPrep
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
    const clothingValue = clothing.value!
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
      hasAssetId: !!clothingValue.assetId,
      hasOutfitS3Key: !!clothingValue.outfitS3Key,
      hasCachedCollage: !!clothingValue.collageS3Key,
    })

    // 1. Resolve assetId to S3 key if needed
    let outfitKey = clothingValue.outfitS3Key
    if (!outfitKey && clothingValue.assetId) {
      try {
        const asset = await AssetService.getAsset(clothingValue.assetId)
        if (asset) {
          outfitKey = asset.s3Key
          Logger.info('[CustomClothingElement] Resolved assetId to S3 key', {
            generationId,
            assetId: clothingValue.assetId,
            s3Key: outfitKey,
          })
        } else {
          Logger.warn('[CustomClothingElement] Asset not found for assetId', {
            generationId,
            assetId: clothingValue.assetId,
          })
        }
      } catch (error) {
        Logger.error('[CustomClothingElement] Failed to resolve assetId', {
          generationId,
          assetId: clothingValue.assetId,
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
    const cachedCollageKey = clothingValue.collageS3Key
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
        hasValue(settings.branding) &&
        settings.branding.value.type === 'include' &&
        settings.branding.value.logoKey &&
        settings.branding.value.position === 'clothing'
      ) {
        try {
          logoImage = await downloadAsset(settings.branding.value.logoKey)
          if (logoImage) {
            Logger.info('[CustomClothingElement] Logo downloaded for clothing branding', {
              generationId,
              position: settings.branding.value.position,
            })
          } else {
            Logger.warn('[CustomClothingElement] Logo download returned null', {
              logoKey: settings.branding.value.logoKey,
              generationId,
            })
          }
        } catch (error) {
          Logger.warn('[CustomClothingElement] Failed to download logo, proceeding without', {
            logoKey: settings.branding.value.logoKey,
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

    // 6. Generate structured description of the garment collage
    let garmentDescription: GarmentDescription | undefined
    if (collageBase64) {
      const descriptionResult = await this.describeGarmentCollage(collageBase64, generationId)
      if (descriptionResult.success) {
        garmentDescription = descriptionResult.description
        Logger.info('[CustomClothingElement] Garment description added to prepared asset', {
          generationId,
          itemCount: garmentDescription.items.length,
          overallStyle: garmentDescription.overallStyle,
        })
        // Debug: Output full JSON in development mode
        if (process.env.NODE_ENV === 'development') {
          console.log('\n[DEBUG] Garment Description JSON:')
          console.log(JSON.stringify(garmentDescription, null, 2))
          console.log('')
        }
      } else {
        Logger.warn('[CustomClothingElement] Failed to generate garment description, continuing without', {
          generationId,
          error: descriptionResult.error,
        })
      }
    }

    // 7. Return prepared asset with collage and description
    return {
      elementId: this.id,
      assetType: 'garment-collage',
      data: {
        base64: collageBase64,
        mimeType: 'image/png',
        metadata: {
          outfitKey,
          cachedCollageKey,
          colors: clothingValue.colors,
          garmentDescription, // Structured JSON description of the clothing
        },
      },
    }
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings, generationContext } = context
    const clothing = settings.customClothing!
    const clothingValue = clothing.value

    Logger.info('[CustomClothingElement] contribute() called', {
      generationId: generationContext.generationId,
      hasCustomClothing: !!clothing,
      clothingMode: clothing?.mode,
      hasAssetId: !!clothingValue?.assetId,
      hasOutfitS3Key: !!clothingValue?.outfitS3Key,
      hasPreparedAssets: !!generationContext.preparedAssets,
      preparedAssetKeys: Array.from(generationContext.preparedAssets?.keys() || []),
    })

    // Instructions for wearing the custom clothing
    const instructions = [
      'The person must wear the exact clothing items shown in the garment collage reference image',
      'Match all visible clothing details: style, fit, patterns, and textures',
      'Ensure all garments are worn appropriately and naturally',
    ]

    // Strict rules for clothing matching (aligned with ClothingOverlayElement)
    const mustFollow = [
      'Use the garment collage as the PRIMARY reference for all garment styling and details.',
      'Replicate the EXACT appearance of the clothing shown in the collage - colors, patterns, logos, and all visible details are already correctly applied.',
      'CRITICAL: If garments in the collage have a logo on them, preserve this logo exactly as shown when dressing the person.',
      'When layering outer garments (jackets, blazers) over base layers, it is NATURAL and EXPECTED for the outer layer to partially cover or obscure parts of any logo.',
      'DO NOT attempt to move, relocate, or "save" the logo from being covered - realistic fabric layering means logos can be partially hidden by outer garments.',
      'The logo belongs to the base layer fabric - let outer layers fall naturally over it as they would in real clothing.',
      'The clothing in the collage is complete and final - do not modify, reinterpret, or add any elements.',
      'No duplicate accessories - only include items from collage once.',
      'DO NOT use any other reference images for clothing, branding, or logo information - the collage contains everything needed.',
    ]

    // Build metadata with clothing information
    const metadata: Record<string, unknown> = {
      hasCustomClothing: true,
      assetId: clothingValue?.assetId,
      outfitS3Key: clothingValue?.outfitS3Key,
    }

    // Include color information if available
    if (clothingValue?.colors) {
      metadata.clothingColors = clothingValue.colors
      instructions.push(
        'Reference the clothing colors data provided in metadata for accurate color matching'
      )
    }

    // Include description if available
    if (clothingValue?.description) {
      metadata.description = clothingValue.description
    }

    // Get prepared collage from context (if available)
    const preparedAssets = generationContext.preparedAssets
    const collageKey = `${this.id}-garment-collage`
    const collageAsset = preparedAssets?.get(collageKey)

    Logger.info('[CustomClothingElement] Looking for garment collage', {
      generationId: generationContext.generationId,
      collageKey,
      foundCollage: !!collageAsset,
      hasBase64: !!collageAsset?.data?.base64,
      base64Length: collageAsset?.data?.base64?.length || 0,
    })

    // Add reference image if collage was prepared
    const referenceImages = []
    if (collageAsset?.data.base64) {
      referenceImages.push({
        url: `data:${collageAsset.data.mimeType || 'image/png'};base64,${collageAsset.data.base64}`,
        description: 'GARMENT COLLAGE - Complete clothing reference showing all garments with accurate colors, patterns, branding, and styling. Use this as the definitive source for how the person should be dressed.',
        type: 'clothing' as const,
      })

      Logger.info('[CustomClothingElement] Added garment collage to contribution', {
        generationId: generationContext.generationId,
        fromCache: !!collageAsset.data.metadata?.cachedCollageKey,
      })
    }

    // Extract garment description from prepared asset metadata
    const garmentDescription = collageAsset?.data.metadata?.garmentDescription as GarmentDescription | undefined

    Logger.info('[CustomClothingElement] Checking for garment description in metadata', {
      generationId: generationContext.generationId,
      hasCollageAsset: !!collageAsset,
      hasMetadata: !!collageAsset?.data?.metadata,
      hasGarmentDescription: !!garmentDescription,
      metadataKeys: collageAsset?.data?.metadata ? Object.keys(collageAsset.data.metadata) : [],
      itemCount: garmentDescription?.items?.length || 0,
    })

    // Debug: Output description in development mode
    if (process.env.NODE_ENV === 'development' && garmentDescription) {
      console.log('\n[DEBUG] Garment Description extracted in contribute():')
      console.log(JSON.stringify(garmentDescription, null, 2))
      console.log('')
    }

    // Build payload for Composition JSON - this tells Gemini what clothing to use
    const payload: Record<string, unknown> = {
      wardrobe: {
        source: 'garment_collage',
        instruction: 'CRITICAL: Dress the person EXACTLY as shown in the GARMENT COLLAGE reference image. The collage shows all clothing items extracted from the original outfit - replicate these items precisely on the person.',
        description: clothingValue?.description || 'Professional outfit as shown in the garment collage reference image',
        colors: clothingValue?.colors ? {
          topLayer: clothingValue.colors.topLayer,
          baseLayer: clothingValue.colors.baseLayer,
          bottom: clothingValue.colors.bottom,
          shoes: clothingValue.colors.shoes,
        } : undefined,
        // Structured garment description from AI analysis
        garmentAnalysis: garmentDescription ? {
          items: garmentDescription.items,
          overallStyle: garmentDescription.overallStyle,
          colorPalette: garmentDescription.colorPalette,
          layering: garmentDescription.layering,
          hasLogo: garmentDescription.hasLogo,
          logoDescription: garmentDescription.logoDescription,
        } : undefined,
      }
    }

    // Add instruction about using the structured garment analysis
    if (garmentDescription) {
      instructions.push(
        'Use the garmentAnalysis data in the wardrobe section for precise clothing details including item types, colors, materials, and layering information'
      )
      mustFollow.push(
        `CLOTHING ITEMS: The outfit consists of: ${garmentDescription.items.map(item => `${item.color.primary} ${item.type} (${item.category})`).join(', ')}.`,
        `LAYERING: ${garmentDescription.layering}`,
        `OVERALL STYLE: ${garmentDescription.overallStyle}`
      )

      Logger.info('[CustomClothingElement] Added garment analysis to payload', {
        generationId: generationContext.generationId,
        itemCount: garmentDescription.items.length,
        overallStyle: garmentDescription.overallStyle,
        hasLogo: garmentDescription.hasLogo,
      })
    }

    Logger.info('[CustomClothingElement] Added wardrobe payload to contribution', {
      generationId: generationContext.generationId,
      hasDescription: !!clothingValue?.description,
      hasColors: !!clothingValue?.colors,
    })

    return {
      instructions,
      mustFollow,
      metadata,
      referenceImages,
      payload,
    }
  }

  /**
   * Describe garment collage using Gemini vision
   *
   * Analyzes the collage image and returns a structured JSON description
   * of all clothing items and accessories visible.
   * Uses the same Vertex AI infrastructure as the evaluation steps.
   */
  private async describeGarmentCollage(
    collageBase64: string,
    generationId: string
  ): Promise<{
    success: true;
    description: GarmentDescription;
    usage?: { inputTokens: number; outputTokens: number };
  } | {
    success: false;
    error: string;
  }> {
    const startTime = Date.now()

    try {
      const { getVertexGenerativeModel } = await import('@/queue/workers/generate-image/gemini')
      const { getModelNameForProvider } = await import('@/queue/workers/generate-image/config')

      // Use GARMENT_ANALYSIS stage model via Vertex AI
      const modelName = getModelNameForProvider(STAGE_MODEL.GARMENT_ANALYSIS, 'vertex') || 'gemini-2.5-flash'

      const model = await getVertexGenerativeModel(modelName)

      const prompt = `Analyze this garment collage image and provide a detailed JSON description of all clothing items and accessories visible.

Return ONLY a valid JSON object with no markdown formatting, no code blocks, just the raw JSON.

The JSON must follow this exact structure:
{
  "items": [
    {
      "category": "outerwear" | "top" | "bottom" | "footwear" | "accessory",
      "type": "string (e.g., blazer, shirt, pants, sneakers, watch)",
      "color": {
        "primary": "string (main color)",
        "secondary": "string | null (accent color if any)",
        "pattern": "solid" | "striped" | "checkered" | "patterned" | "textured"
      },
      "material": "string | null (e.g., cotton, wool, leather, denim)",
      "style": "string (e.g., formal, casual, business-casual, sporty)",
      "fit": "string | null (e.g., slim, regular, loose, tailored)",
      "details": ["array of notable features like buttons, pockets, logos, embroidery"]
    }
  ],
  "overallStyle": "string (e.g., business professional, smart casual, formal)",
  "colorPalette": ["array of dominant colors in the outfit"],
  "layering": "string describing how items layer (e.g., 'blazer over button-up shirt')",
  "hasLogo": boolean,
  "logoDescription": "string | null (describe logo if present)"
}

Be precise and objective. Only describe items that are clearly visible in the collage.`

      // Build parts array with text prompt and image
      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/png',
            data: collageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
          },
        },
      ]

      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent structured output
        },
      })

      const response = result.response
      const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

      // Try to parse the JSON response
      let description: GarmentDescription
      try {
        // Remove any markdown code blocks if present
        const cleanedText = responseText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim()

        description = JSON.parse(cleanedText)
      } catch (parseError) {
        Logger.warn('[CustomClothingElement] Failed to parse garment description JSON', {
          generationId,
          responsePreview: responseText.substring(0, 500),
          error: parseError instanceof Error ? parseError.message : String(parseError),
        })
        return { success: false, error: 'Failed to parse description JSON' }
      }

      const inputTokens = response.usageMetadata?.promptTokenCount || 0
      const outputTokens = response.usageMetadata?.candidatesTokenCount || 0

      // Track cost
      await CostTrackingService.trackCall({
        generationId,
        provider: 'vertex',
        model: 'gemini-2.5-flash',
        inputTokens,
        outputTokens,
        reason: 'garment_description',
        result: 'success',
        durationMs: Date.now() - startTime,
      })

      Logger.info('[CustomClothingElement] Garment description generated', {
        generationId,
        itemCount: description.items?.length || 0,
        overallStyle: description.overallStyle,
        hasLogo: description.hasLogo,
        durationMs: Date.now() - startTime,
      })

      // Debug: Output full JSON in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('\n[DEBUG] Garment Description JSON:')
        console.log(JSON.stringify(description, null, 2))
        console.log('')
      }

      Telemetry.increment('outfit.description.success')

      return {
        success: true,
        description,
        usage: { inputTokens, outputTokens },
      }
    } catch (error) {
      Logger.error('[CustomClothingElement] Garment description failed', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
      })

      Telemetry.increment('outfit.description.error')

      return { success: false, error: 'Description generation failed' }
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
        { temperature: 0.2, stage: 'CLOTHING_COLLAGE' }
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
        model: STAGE_MODEL.CLOTHING_COLLAGE,
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
        model: STAGE_MODEL.CLOTHING_COLLAGE,
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
    const clothingValue = clothing?.value

    if (!clothing) {
      return errors
    }

    // If user-choice mode with a value, must have either assetId or outfitS3Key
    if (clothing.mode === 'user-choice' && clothingValue) {
      if (!clothingValue.assetId && !clothingValue.outfitS3Key) {
        errors.push('Custom clothing requires either assetId or outfitS3Key')
      }
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

autoRegisterElement(customClothingElement)
