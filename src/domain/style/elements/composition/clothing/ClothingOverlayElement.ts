/**
 * Clothing Overlay Element
 *
 * Pre-generates clothing overlays with logos in Step 0 for improved logo placement accuracy.
 * Creates flat-lay product photography of garments with logos correctly positioned,
 * then uses these as visual templates during person generation.
 *
 * Uses the Asset system for caching overlays:
 * - Stores overlays as Asset records with type='intermediate', subType='clothing_overlay'
 * - Uses StyleFingerprintService for deterministic cache keys
 * - Tracks parent-child relationships via parentAssetIds (links to prepared logo Asset)
 * - Enables cost tracking and reuse analytics
 *
 * This element:
 * 1. Checks if clothing overlay is needed (branding on clothing enabled)
 * 2. Generates overlay in Step 0 (or loads from Asset cache)
 * 3. Provides overlay as reference image in person-generation phase
 * 4. Coordinates with BrandingElement to avoid duplicate logo placement
 */

import {
  StyleElement,
  ElementContext,
  ElementContribution,
  type PreparedAsset,
} from '../../base/StyleElement'
import { isUserChoice, hasValue } from '../../base/element-types'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { CostTrackingService } from '@/domain/services/CostTrackingService'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getColorHex, type ColorValue } from '../../clothing-colors/types'
import type { S3Client } from '@aws-sdk/client-s3'
import { getS3BucketName } from '@/lib/s3-client'
import type { BrandingSettings, BrandingValue } from '../../branding/types'
import type { ClothingValue } from '../../clothing/types'
import { WARDROBE_DETAILS, generateWardrobePrompt } from '../../clothing/prompt'
import type { KnownClothingStyle } from '../../clothing/config'
import { AssetService } from '@/domain/services/AssetService'
import { StyleFingerprintService } from '@/domain/services/StyleFingerprintService'
import type { Asset } from '@prisma/client'

interface ClothingTemplate {
  description: string
  layers: string[]
  logoLayer: string
  logoPosition: string
  logoStyle: string
  isLayered: boolean
}

export class ClothingOverlayElement extends StyleElement {
  readonly id = 'clothing-overlay'
  readonly name = 'Clothing Overlay'
  readonly description = 'Pre-generates clothing with logos for all clothing styles'

  // CRITICAL: Depends on branding element to prepare logo in Step 0
  get dependsOn(): string[] {
    return ['branding']
  }

  /**
   * Check if this element is relevant for the current phase
   * Relevant when: branding on clothing is enabled AND phase is person-generation
   */
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Only for person-generation phase
    if (phase !== 'person-generation') return false

    // Only when branding on clothing is enabled
    if (!hasValue(settings.branding)) return false
    if (settings.branding.value.type !== 'include') return false
    if (settings.branding.value.position !== 'clothing') return false

    // For ALL clothing styles when branding on clothing is enabled
    // (regardless of mode - user-choice with value should still contribute)
    const clothing = settings.clothing
    if (!clothing || !hasValue(clothing)) return false

    // Overlay applies to all clothing styles with a value
    return true
  }

  /**
   * Check if this element needs to prepare assets (clothing overlay)
   * NOTE: This is called during 'preparation' phase, not 'person-generation' phase
   */
  needsPreparation(context: ElementContext): boolean {
    const { settings } = context

    // Only when branding on clothing is enabled
    if (!hasValue(settings.branding)) return false
    if (settings.branding.value.type !== 'include') return false
    if (settings.branding.value.position !== 'clothing') return false

    // For ALL clothing styles when branding on clothing is enabled
    // (regardless of mode - user-choice with value should still contribute)
    const clothing = settings.clothing
    if (!clothing || !hasValue(clothing)) return false

    // Overlay applies to all predefined clothing styles
    return true
  }

  /**
   * Prepare clothing overlay in Step 0
   *
   * This method:
   * 1. Generates fingerprint from clothing + branding settings + logo Asset ID
   * 2. Checks Asset table for cached overlay using fingerprint
   * 3. Gets prepared logo from BrandingElement
   * 4. Generates clothing overlay using Gemini (or loads from cache)
   * 5. Uploads overlay to S3 and creates Asset record
   * 6. Returns prepared asset for use in contribute()
   */
  async prepare(context: ElementContext): Promise<PreparedAsset> {
    const startTime = Date.now()
    const { settings, generationContext } = context
    const clothing = settings.clothing!
    const clothingValue = clothing.value!
    const branding = settings.branding!.value!
    const generationId = generationContext.generationId || 'unknown'

    // Type guard for services
    const downloadAsset = generationContext.downloadAsset as
      | ((key: string) => Promise<{ base64: string; mimeType: string } | null>)
      | undefined
    const s3Client = generationContext.s3Client as S3Client | undefined

    if (!downloadAsset || !s3Client) {
      throw new Error('ClothingOverlayElement.prepare(): downloadAsset and s3Client must be provided in generationContext')
    }

    // Extract owner context for Asset creation
    const teamId = generationContext.teamId as string | undefined
    const personId = generationContext.personId as string | undefined
    const ownerContext = { teamId, personId }

    if (!teamId && !personId) {
      throw new Error('ClothingOverlayElement.prepare(): Either teamId or personId must be provided in generationContext')
    }

    const bucketName = getS3BucketName()

    Logger.info('[ClothingOverlayElement] Starting clothing overlay preparation', {
      generationId,
      style: clothingValue.style,
      details: clothingValue.details,
      brandingPosition: branding.position,
    })

    // Get prepared logo from BrandingElement (Step 0) - already has SVG conversion
    const preparedLogo = generationContext.preparedAssets?.get('branding-logo')
    if (!preparedLogo?.data.base64) {
      throw new Error(
        'ClothingOverlayElement.prepare(): Prepared logo asset not found. ' +
        'BrandingElement must run before ClothingOverlayElement in Step 0.'
      )
    }

    // Extract logo Asset ID from prepared branding metadata
    const logoAssetId = preparedLogo.data.metadata?.assetId as string | undefined

    // 1. Generate fingerprint using Asset-based approach
    const clothingColors = settings.clothingColors && hasValue(settings.clothingColors) ? settings.clothingColors.value : undefined
    const fingerprint = this.getFingerprint(clothingValue, branding, logoAssetId, clothingColors)
    Logger.debug('[ClothingOverlayElement] Generated fingerprint', {
      fingerprint,
      generationId,
      logoAssetId,
      clothingColors,
    })

    // 2. Check Asset table for cached overlay
    let overlayBase64: string | null = null
    let s3Key: string | null = null
    let fromCache = false
    let reusedAsset: Asset | null = null

    const cachedAsset = await this.findCachedOverlay(fingerprint, ownerContext)
    if (cachedAsset) {
      Logger.info('[ClothingOverlayElement] Found cached overlay Asset', {
        fingerprint,
        assetId: cachedAsset.id,
        s3Key: cachedAsset.s3Key,
        generationId,
      })

      // Try to download cached overlay
      try {
        const downloadedOverlay = await downloadAsset(cachedAsset.s3Key)
        if (downloadedOverlay) {
          overlayBase64 = downloadedOverlay.base64
          s3Key = cachedAsset.s3Key
          fromCache = true
          reusedAsset = cachedAsset

          Logger.info('[ClothingOverlayElement] Using cached clothing overlay', {
            fingerprint,
            assetId: cachedAsset.id,
            s3Key: cachedAsset.s3Key,
            generationId,
          })

          // Track cost savings from reuse
          await CostTrackingService.trackReuse({
            generationId,
            model: 'gemini-2.5-flash-image',
            reason: 'clothing_overlay_creation',
            reusedAssetId: cachedAsset.id,
          })
        } else {
          Logger.warn('[ClothingOverlayElement] Cached overlay not found in S3, will regenerate', {
            fingerprint,
            assetId: cachedAsset.id,
            s3Key: cachedAsset.s3Key,
            generationId,
          })
        }
      } catch (error) {
        Logger.warn('[ClothingOverlayElement] Failed to load cached overlay', {
          fingerprint,
          generationId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // 3. Generate overlay if no cache
    if (!overlayBase64) {
      const logoData = {
        base64: preparedLogo.data.base64,
        mimeType: preparedLogo.data.mimeType || 'image/png'
      }

      Logger.info('[ClothingOverlayElement] Using prepared logo for overlay generation', {
        generationId,
        logoKey: preparedLogo.data.s3Key,
        logoAssetId,
        mimeType: logoData.mimeType,
      })

      // 4. Generate clothing overlay with logo
      const overlayResult = await this.generateClothingOverlay({
        clothing: clothingValue,
        branding,
        logoData,
        generationId,
        clothingColors,
      })

      if (overlayResult.success) {
        overlayBase64 = overlayResult.data.base64

        // 4.5. Save to tmp for debugging
        await this.saveTmpOverlay(overlayBase64, fingerprint, generationId)

        // 5. Upload to S3
        s3Key = await this.uploadOverlay(overlayBase64, fingerprint, s3Client, bucketName, generationId)

        // 6. Create Asset record
        const overlayAsset = await this.createOverlayAsset({
          s3Key,
          fingerprint,
          clothing: clothingValue,
          branding,
          logoAssetId,
          ownerContext,
          generationId,
          clothingColors,
        })

        Logger.info('[ClothingOverlayElement] Generated and cached new clothing overlay', {
          fingerprint,
          assetId: overlayAsset.id,
          s3Key,
          generationId,
        })
      } else {
        throw new Error(`ClothingOverlayElement.prepare(): Overlay generation failed: ${overlayResult.error}`)
      }
    }

    // 7. Return prepared asset
    const expectedKey = `${this.id}-overlay`
    Logger.info('[ClothingOverlayElement] Returning prepared overlay asset', {
      generationId,
      elementId: this.id,
      assetType: 'overlay',
      expectedKey,
      fromCache,
      s3Key,
    })

    return {
      elementId: this.id,
      assetType: 'overlay',
      data: {
        base64: overlayBase64!,
        mimeType: 'image/png',
        s3Key: s3Key!,
        metadata: {
          clothingStyle: `${clothingValue.style}-${clothingValue.details}`,
          brandingPosition: branding.position,
          fingerprint,
          fromCache,
          reusedAssetId: reusedAsset?.id,
        },
      },
    }
  }

  /**
   * Contribute clothing overlay as reference image to person generation
   */
  async contribute(context: ElementContext): Promise<ElementContribution> {
    // Get prepared overlay from Step 0
    const preparedAssets = context.generationContext.preparedAssets
    const overlay = preparedAssets?.get(`${this.id}-overlay`)

    // Always provide instructions/mustFollow (like CustomClothingElement does)
    // Reference image is only added if overlay was successfully prepared
    const mustFollow = [
      'Use the clothing overlay as the PRIMARY reference for all garment styling and details.',
      'Replicate the EXACT appearance of the clothing shown in the overlay - colors, patterns, logos, and all visible details are already correctly applied.',
      'CRITICAL: The base layer garment in the overlay has a logo on it - preserve this logo exactly as shown when dressing the person.',
      'When layering outer garments (jackets, blazers) over the base layer, it is NATURAL and EXPECTED for the outer layer to partially cover or obscure parts of the logo.',
      'DO NOT attempt to move, relocate, or "save" the logo from being covered - realistic fabric layering means logos can be partially hidden by outer garments.',
      'The logo belongs to the base layer fabric - let outer layers fall naturally over it as they would in real clothing.',
      'Maintain the layering relationship shown in the overlay (base layer with logo underneath, outer layer on top with natural overlap).',
      'The clothing in the overlay is complete and final - do not modify, reinterpret, or add any elements.',
      'DO NOT use any other reference images for clothing, branding, or logo information - the overlay contains everything needed.',
    ]

    const freedom = [
      'The clothing overlay shows ONLY the core garments in a flat-lay arrangement - it does NOT show the person.',
      'All facial features and personal accessories (glasses, earrings, watches, jewelry) come from the SELFIE references, NOT from the clothing overlay.',
      'If the selfies show the person wearing glasses, you MUST include those same glasses in the generated image.',
    ]

    const metadata: Record<string, unknown> = {
      hasClothingOverlay: true,
      suppressWardrobeBranding: true, // Don't add branding from wardrobe
      suppressLogoReference: true, // Don't add separate logo reference
    }

    // Add reference image if overlay was successfully prepared (following CustomClothingElement pattern)
    const referenceImages = []
    if (overlay?.data.base64) {
      referenceImages.push({
        url: `data:${overlay.data.mimeType};base64,${overlay.data.base64}`,
        description: 'CLOTHING TEMPLATE - Complete clothing reference showing all garments with accurate colors, patterns, branding, and styling. Use this as the definitive source for how the person should be dressed.',
        type: 'clothing' as const,
      })

      metadata.overlayS3Key = overlay.data.s3Key
      metadata.clothingStyle = overlay.data.metadata?.clothingStyle

      Logger.info('[ClothingOverlayElement] Added clothing overlay to contribution', {
        generationId: context.generationContext.generationId,
        fromCache: overlay.data.metadata?.fromCache,
      })
    } else {
      Logger.warn('[ClothingOverlayElement] No prepared overlay found, providing instructions without reference image', {
        generationId: context.generationContext.generationId,
        availableKeys: Array.from(preparedAssets?.keys() || []),
        expectedKey: `${this.id}-overlay`,
      })
      metadata.overlayMissing = true
    }

    return {
      mustFollow,
      freedom,
      referenceImages,
      metadata,
    }
  }

  /**
   * Generate clothing overlay using Gemini
   */
  private async generateClothingOverlay(params: {
    clothing: ClothingValue
    branding: BrandingValue
    logoData: { base64: string; mimeType: string }
    generationId?: string
    clothingColors?: { baseLayer?: string | ColorValue; topLayer?: string | ColorValue; bottom?: string | ColorValue; shoes?: string | ColorValue }
  }): Promise<
    | { success: true; data: { base64: string }; usage?: { inputTokens: number; outputTokens: number } }
    | { success: false; error: string; code?: string }
  > {
    const { clothing, branding, logoData, generationId, clothingColors } = params
    const startTime = Date.now()

    try {
      const { generateWithGemini } = await import('@/queue/workers/generate-image/gemini')

      // Build prompt for clothing overlay generation
      // Get shot type from settings if available
      const shotType = (clothing as any).shotType || 'medium-shot'
      const prompt = this.buildOverlayPrompt(clothing, branding, shotType, clothingColors)

      Logger.info('[ClothingOverlayElement] Generated overlay prompt', {
        generationId,
        style: clothing.style,
        details: clothing.details,
        clothingColors,
        promptPreview: prompt.substring(0, 5000) + '...'
      })

      // Generate with Gemini
      const result = await generateWithGemini(
        prompt,
        [
          {
            mimeType: logoData.mimeType,
            base64: logoData.base64.replace(/^data:image\/[a-z]+;base64,/, ''),
            description: 'Logo to place on clothing',
          },
        ],
        '3:4', // Portrait aspect ratio for clothing
        undefined,
        { temperature: 0.2 }
      )

      if (!result.images || result.images.length === 0) {
        Logger.warn('[ClothingOverlayElement] Gemini did not return overlay image', {
          generationId,
          provider: result.providerUsed,
        })
        return { success: false, error: 'No image generated', code: 'NO_IMAGE' }
      }

      const imageBuffer = result.images[0]
      const base64Image = imageBuffer.toString('base64')

      // Track cost
      await CostTrackingService.trackCall({
        generationId: generationId || 'unknown',
        provider: result.providerUsed || 'unknown',
        model: 'gemini-2.5-flash-image',
        inputTokens: result.usage.inputTokens || 0,
        outputTokens: result.usage.outputTokens || 0,
        imagesGenerated: 1,
        reason: 'clothing_overlay_creation',
        result: 'success',
        durationMs: Date.now() - startTime,
      })

      Telemetry.increment('clothing_overlay.success')
      Telemetry.timing('clothing_overlay.duration', Date.now() - startTime)

      return {
        success: true,
        data: { base64: base64Image },
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
        },
      }
    } catch (error) {
      Logger.error('[ClothingOverlayElement] Gemini overlay generation failed', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Track failed cost
      await CostTrackingService.trackCall({
        generationId: generationId || 'unknown',
        provider: 'gemini-rest',
        model: 'gemini-2.5-flash-image',
        inputTokens: 0,
        outputTokens: 0,
        reason: 'clothing_overlay_creation',
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      })

      Telemetry.increment('clothing_overlay.error')

      if (error instanceof Error) {
        if (error.message.includes('RATE_LIMIT')) {
          return { success: false, error: 'Rate limit exceeded', code: 'RATE_LIMIT' }
        }
        if (error.message.includes('SAFETY')) {
          return { success: false, error: 'Content policy violation', code: 'SAFETY' }
        }
      }

      return { success: false, error: 'Overlay generation failed', code: 'GEMINI_ERROR' }
    }
  }

  /**
   * Build prompt for overlay generation
   */
  private buildOverlayPrompt(
    clothing: ClothingValue,
    branding: BrandingValue,
    shotType: string = 'medium-shot',
    clothingColors?: { baseLayer?: string | ColorValue; topLayer?: string | ColorValue; bottom?: string | ColorValue; shoes?: string | ColorValue }
  ): string {
    // CRITICAL: Use the SAME wardrobe generation logic as ClothingElement
    // This ensures 100% consistency between overlay generation and regular person generation
    const wardrobeResult = generateWardrobePrompt({
      clothing,
      clothingColors: clothingColors ? { mode: 'predefined', value: clothingColors } : undefined,
      shotType: shotType as any
    })

    const { styleKey, detailKey, descriptor, wardrobe } = wardrobeResult

    // Get clothing-specific template for logo placement
    const template = this.getClothingTemplate(`${styleKey}-${detailKey}`)

    // Determine what items to show based on shot type
    // CRITICAL: medium-shot cuts at waist - do NOT show pants (only full-body and three-quarter show pants)
    const showPants = shotType === 'full-body' || shotType === 'three-quarter' || shotType === 'full-length'
    const showShoes = shotType === 'full-body' || shotType === 'full-length'

    // Build layer descriptions from the wardrobe structure
    const layerDescriptions: string[] = []

    // Determine if this is a single-layer garment (no outer layer)
    const isSingleLayer = !descriptor.outerLayer

    // Extract the actual garment descriptions from wardrobe
    if (wardrobe.top_layer) {
      const layerName = isSingleLayer ? 'Main garment' : 'Outer layer'
      layerDescriptions.push(`${layerName}: ${wardrobe.top_layer}`)
    }

    if (wardrobe.base_layer && !isSingleLayer) {
      layerDescriptions.push(`Base layer: ${wardrobe.base_layer}`)
    }

    // Add color specifications from the color_palette (generated by generateWardrobePrompt)
    const colorPalette = wardrobe.color_palette as string[] | undefined
    if (colorPalette && colorPalette.length > 0) {
      layerDescriptions.push(`\nCOLOR SPECIFICATIONS:`)
      colorPalette.forEach(colorSpec => {
        layerDescriptions.push(`- ${colorSpec}`)
      })
    }

    if (showPants) {
      const bottomColor = clothingColors?.bottom || 'coordinating neutral color'
      layerDescriptions.push(
        `\nPants: Professional ${styleKey === 'business' ? 'dress pants or trousers' : 'casual pants or chinos'} in ${bottomColor} color`
      )
    }

    // Check for belt in inherent accessories - show belt when pants are visible
    const inherentAccessories = wardrobe.inherent_accessories as string[] | undefined
    const showBelt = showPants && inherentAccessories?.includes('belt')
    if (showBelt) {
      layerDescriptions.push(
        `\nBelt: Professional leather belt in a coordinating color (black or brown to match shoes/pants)`
      )
    }

    if (showShoes) {
      const shoesColor = clothingColors?.shoes
      const shoesType = styleKey === 'business' ? 'Professional dress shoes' : 'Clean casual shoes'
      const shoesDescription = shoesColor ? `${shoesType} in ${shoesColor} color` : shoesType
      layerDescriptions.push(`\nShoes: ${shoesDescription}`)
    }

    // Count actual garments (not color specs)
    const garmentCount = (wardrobe.top_layer ? 1 : 0) +
                         (wardrobe.base_layer && !isSingleLayer ? 1 : 0) +
                         (showPants ? 1 : 0) +
                         (showBelt ? 1 : 0) +
                         (showShoes ? 1 : 0)

    // Build layout requirements based on garment structure
    const layoutParts = [`STANDARDIZED LAYOUT REQUIREMENTS:
- Arrange items in a GRID layout on a clean white background with ALL items FULLY SEPARATED
- CRITICAL: NO overlapping - each garment must be completely visible with clear space between items
- CRITICAL: Show EXACTLY ${garmentCount} item(s) total - no more, no less`]

    if (isSingleLayer) {
      // Single-layer garments: only one main garment (hoodie, t-shirt, polo, dress)
      layoutParts.push(`- Main garment (${wardrobe.top_layer}) laid perfectly flat, facing forward, symmetrical, fully spread out, 100% visible`)
    } else {
      // Multi-layer garments: base layer + outer layer (business casual, etc.)
      layoutParts.push(`- Base layer (${wardrobe.base_layer}) in its own space, 100% visible with no obstructions`)
      layoutParts.push(`- Outer layer (${wardrobe.top_layer}) in its own separate space, NOT touching or overlapping the base layer`)
    }

    if (showPants) {
      layoutParts.push(`- Pants in their own separate space below, NOT touching upper garments`)
    }
    if (showBelt) {
      layoutParts.push(`- Belt positioned near/on the pants waistband area, showing buckle and leather strap`)
    }
    if (showShoes) {
      layoutParts.push(`- Shoes in their own separate space at the bottom, NOT touching other items`)
    }

    layoutParts.push(`- Minimum 5cm spacing between ALL items - no parts of any garment should touch`)
    layoutParts.push(`- All items laid perfectly flat, facing forward, symmetrical, fully spread out`)
    layoutParts.push(`- Professional product catalog photography style showing each item individually`)
    layoutParts.push(`- Soft, even studio lighting with minimal shadows`)
    layoutParts.push(`- Each garment should be photographed as if it's a standalone product listing`)

    const layoutInstructions = layoutParts.join('\n')

    return `
CREATE A PROFESSIONAL CLOTHING TEMPLATE WITH LOGO:

You are creating a standardized flat-lay photograph showing clothing items with a company logo.

CLOTHING ITEMS TO SHOW:
${layerDescriptions.map((layer, i) => `${i + 1}. ${layer}`).join('\n')}

${layoutInstructions}

LOGO PLACEMENT - CRITICAL REQUIREMENTS:
TARGET GARMENT: ${template.logoLayer}
POSITION: ${template.logoPosition}
STYLE: ${template.logoStyle}

LOGO REPRODUCTION RULES (MUST FOLLOW EXACTLY):
1. COPY the logo from the reference image with PERFECT ACCURACY - every letter, icon, and element must be included
2. CRITICAL: Include EVERY letter and character visible in the logo - DO NOT skip or omit any text
3. If the logo contains text, reproduce each letter individually and completely - check that all letters are present
4. If the logo contains icons or graphics, reproduce every line, shape, and detail exactly
5. DO NOT modify, stylize, or reinterpret the logo design in any way
6. DO NOT alter logo colors - use the EXACT colors from the reference for each element
7. DO NOT change logo proportions or aspect ratio
8. The logo should appear ${template.logoStyle} on the fabric with all elements intact
9. Size: The logo should be proportional (approx 8-12cm width on the garment)
10. ONLY place the logo on the base layer garment - NEVER on outer layers
11. The logo must be clearly visible and sharp with ALL text/graphics legible
12. Before finalizing, verify that EVERY letter and element from the reference logo is present in your output

CRITICAL QUALITY STANDARDS:
- Photorealistic fabric textures (cotton weave, wool texture, etc.)
- Sharp focus on all garments, especially the logo area
- Consistent, neutral white background (RGB 255,255,255)
- No shadows or gradients on the background
- Professional lighting that shows fabric detail without harsh shadows
- The logo must be the EXACT same as the reference image

FORBIDDEN:
- DO NOT add creative styling or artistic interpretation
- DO NOT modify the logo design in any way
- DO NOT add text labels or annotations
- DO NOT show a person wearing the clothes
- DO NOT use colored or patterned backgrounds
- DO NOT overlap or layer garments on top of each other
- DO NOT arrange items in a way that hides any part of any garment
- DO NOT create an artistic composition - this is a technical product reference

OUTPUT SPECIFICATIONS:
- PNG image with white background
- All items clearly visible and properly colored
- Logo EXACTLY matching the reference image with ALL letters and elements present, correctly positioned on base layer
- Ready for use as a template in AI generation

LOGO REFERENCE: Use the attached logo image as your ONLY source for logo design, colors, and proportions. Copy it EXACTLY with every single letter, character, icon, and graphic element included.

FINAL VERIFICATION BEFORE OUTPUT:
1. Compare your generated logo against the reference image
2. Count the letters/characters in the reference and verify your output has the same count
3. Check that every icon, line, and graphic element from the reference is present
4. Confirm all colors match the reference exactly
5. Only output the image once you've verified 100% accuracy
`.trim()
  }

  /**
   * Get clothing template for specific style
   */
  private getClothingTemplate(styleKey: string): ClothingTemplate {
    const templates: Record<string, ClothingTemplate> = {
      // LAYERED STYLES (Multi-layer clothing)
      'business-casual': {
        description: 'Business casual with jacket over deluxe t-shirt',
        layers: ['Base layer: Deluxe t-shirt (substantial and refined, like Mercerized cotton, Pima cotton, or modal blends, with a tight crew neck)', 'Outer layer: Blazer or suit jacket, worn open'],
        logoLayer: 'Base layer (deluxe t-shirt)',
        logoPosition: 'Center chest, slightly below neckline',
        logoStyle: 'printed or embroidered',
        isLayered: true,
      },

      'business-formal': {
        description: 'Business formal with dress shirt visible',
        layers: ['Base layer: Formal dress shirt', 'Outer layer: Suit jacket, partially open'],
        logoLayer: 'Base layer (dress shirt)',
        logoPosition: 'Upper right chest, where pocket would be',
        logoStyle: 'embroidered crest',
        isLayered: true,
      },

      'business-pantsuit': {
        description: 'Pantsuit with blouse visible',
        layers: ['Base layer: Blouse or dress shirt', 'Outer layer: Suit jacket, partially open'],
        logoLayer: 'Base layer (blouse)',
        logoPosition: 'Upper right chest, where pocket would be',
        logoStyle: 'embroidered crest',
        isLayered: true,
      },

      'business-blouse': {
        description: 'Blouse with blazer',
        layers: ['Base layer: Blouse', 'Outer layer: Blazer, partially open'],
        logoLayer: 'Base layer (blouse)',
        logoPosition: 'Upper right chest',
        logoStyle: 'embroidered',
        isLayered: true,
      },

      'startup-button-down': {
        description: 'Casual button-down over t-shirt',
        layers: ['Base layer: T-shirt', 'Outer layer: Button-down shirt, worn open'],
        logoLayer: 'Base layer (t-shirt)',
        logoPosition: 'Center chest',
        logoStyle: 'screen printed',
        isLayered: true,
      },

      'startup-cardigan': {
        description: 'Cardigan over t-shirt or dress',
        layers: ['Base layer: T-shirt or dress', 'Outer layer: Cardigan, worn open'],
        logoLayer: 'Base layer',
        logoPosition: 'Center chest',
        logoStyle: 'printed',
        isLayered: true,
      },

      // SINGLE-LAYER STYLES (One garment)
      'startup-t-shirt': {
        description: 'Casual t-shirt',
        layers: ['T-shirt'],
        logoLayer: 'T-shirt',
        logoPosition: 'Center chest, slightly below neckline',
        logoStyle: 'screen printed',
        isLayered: false,
      },

      'startup-hoodie': {
        description: 'Casual hoodie',
        layers: ['Hoodie'],
        logoLayer: 'Hoodie chest',
        logoPosition: 'Center chest, slightly below neckline, above hoodie pocket',
        logoStyle: 'screen printed or embroidered',
        isLayered: false,
      },

      'startup-polo': {
        description: 'Polo shirt',
        layers: ['Polo shirt'],
        logoLayer: 'Polo shirt',
        logoPosition: 'Left chest, where traditional polo logo would be',
        logoStyle: 'embroidered, small to medium sized',
        isLayered: false,
      },

      'startup-blouse': {
        description: 'Blouse',
        layers: ['Blouse'],
        logoLayer: 'Blouse',
        logoPosition: 'Center chest or upper left chest',
        logoStyle: 'embroidered',
        isLayered: false,
      },

      'startup-dress': {
        description: 'Dress',
        layers: ['Dress'],
        logoLayer: 'Dress bodice',
        logoPosition: 'Center chest area of bodice',
        logoStyle: 'embroidered or printed',
        isLayered: false,
      },

      'startup-jumpsuit': {
        description: 'Jumpsuit',
        layers: ['Jumpsuit'],
        logoLayer: 'Jumpsuit bodice',
        logoPosition: 'Center chest',
        logoStyle: 'embroidered or printed',
        isLayered: false,
      },

      'business-dress': {
        description: 'Professional dress',
        layers: ['Dress'],
        logoLayer: 'Dress bodice',
        logoPosition: 'Upper left chest as subtle embroidered crest',
        logoStyle: 'tasteful embroidered mark',
        isLayered: false,
      },

      'black-tie-tuxedo': {
        description: 'Tuxedo with dress shirt visible',
        layers: ['Base layer: Dress shirt', 'Outer layer: Tuxedo jacket, partially open'],
        logoLayer: 'Base layer (dress shirt)',
        logoPosition: 'Upper right chest, where pocket would be',
        logoStyle: 'embroidered crest',
        isLayered: true,
      },

      'black-tie-suit': {
        description: 'Formal suit with dress shirt visible',
        layers: ['Base layer: Dress shirt', 'Outer layer: Suit jacket, partially open'],
        logoLayer: 'Base layer (dress shirt)',
        logoPosition: 'Upper right chest, where pocket would be',
        logoStyle: 'embroidered crest',
        isLayered: true,
      },

      'black-tie-dress': {
        description: 'Elegant evening dress',
        layers: ['Gown/dress'],
        logoLayer: 'Gown bodice',
        logoPosition: 'Upper left chest as elegant embroidered crest',
        logoStyle: 'tasteful applique',
        isLayered: false,
      },

      'black-tie-gown': {
        description: 'Formal evening gown',
        layers: ['Gown'],
        logoLayer: 'Gown bodice',
        logoPosition: 'Upper left chest as elegant embroidered crest',
        logoStyle: 'tasteful applique',
        isLayered: false,
      },
    }

    return templates[styleKey] || templates['startup-t-shirt'] // Default fallback
  }

  /**
   * Generate fingerprint from clothing and branding settings
   * Uses StyleFingerprintService for deterministic hashing
   */
  private getFingerprint(
    clothing: ClothingValue,
    branding: BrandingValue,
    logoAssetId?: string,
    clothingColors?: { baseLayer?: string | ColorValue; topLayer?: string | ColorValue; bottom?: string | ColorValue; shoes?: string | ColorValue }
  ): string {
    const colors = clothingColors || {}
    const baseColor = (getColorHex(colors.baseLayer) || '#FFFFFF').toLowerCase()
    const topColor = (getColorHex(colors.topLayer) || '#000000').toLowerCase()
    const bottomColor = (getColorHex(colors.bottom) || 'neutral').toLowerCase()
    const shoesColor = (getColorHex(colors.shoes) || 'default').toLowerCase()

    const styleParams = {
      clothingStyle: clothing.style,
      clothingDetails: clothing.details || 'default',
      brandingPosition: branding.position,
      baseLayerColor: baseColor,
      topLayerColor: topColor,
      bottomColor: bottomColor,
      shoesColor: shoesColor,
    }

    const parentIds = logoAssetId ? [logoAssetId] : []

    return StyleFingerprintService.createFingerprint(
      parentIds,
      styleParams,
      'clothing_overlay'
    )
  }

  /**
   * Find cached overlay from Asset table
   */
  private async findCachedOverlay(
    fingerprint: string,
    ownerContext: { teamId?: string; personId?: string }
  ): Promise<Asset | null> {
    try {
      const result = await AssetService.findReusableAsset(fingerprint, ownerContext)
      if (!result) return null
      
      return result as unknown as Asset
    } catch (error) {
      Logger.warn('[ClothingOverlayElement] Failed to find cached overlay', {
        fingerprint,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Save overlay to tmp/collages for debugging
   */
  private async saveTmpOverlay(
    overlayBase64: string,
    fingerprint: string,
    generationId: string
  ): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')

      const tmpDir = path.join(process.cwd(), 'tmp', 'collages')
      await fs.mkdir(tmpDir, { recursive: true })

      const overlayBuffer = Buffer.from(overlayBase64, 'base64')
      // Use first 8 chars of fingerprint for filename brevity
      const fingerprintShort = fingerprint.substring(0, 8)
      const filename = `${generationId}-overlay-${fingerprintShort}.png`
      await fs.writeFile(path.join(tmpDir, filename), overlayBuffer)

      Logger.info('[ClothingOverlayElement] Saved overlay to tmp folder', {
        path: `tmp/collages/${filename}`,
        generationId,
        fingerprint,
      })
    } catch (error) {
      Logger.warn('[ClothingOverlayElement] Failed to save overlay to tmp folder', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't throw - tmp saving is optional for debugging
    }
  }

  /**
   * Upload overlay to S3
   */
  private async uploadOverlay(
    overlayBase64: string,
    fingerprint: string,
    s3Client: S3Client,
    bucketName: string,
    generationId: string
  ): Promise<string> {
    try {
      const overlayBuffer = Buffer.from(overlayBase64, 'base64')
      // Use first 12 chars of fingerprint for S3 key
      const fingerprintShort = fingerprint.substring(0, 12)
      const s3Key = `clothing-overlays/${fingerprintShort}-${Date.now()}.png`

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: overlayBuffer,
          ContentType: 'image/png',
        })
      )

      Logger.info('[ClothingOverlayElement] Uploaded overlay to S3', {
        s3Key,
        generationId,
        fingerprint,
      })

      return s3Key
    } catch (error) {
      Logger.error('[ClothingOverlayElement] Failed to upload overlay to S3', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Create overlay Asset record
   */
  private async createOverlayAsset(params: {
    s3Key: string
    fingerprint: string
    clothing: ClothingValue
    branding: BrandingValue
    logoAssetId?: string
    ownerContext: { teamId?: string; personId?: string }
    generationId?: string
    clothingColors?: { baseLayer?: string | ColorValue; topLayer?: string | ColorValue; bottom?: string | ColorValue; shoes?: string | ColorValue }
  }): Promise<Asset> {
    const { s3Key, fingerprint, clothing, branding, logoAssetId, ownerContext, generationId, clothingColors } = params

    const colors = clothingColors || {}
    const styleContext = {
      clothingStyle: clothing.style,
      clothingDetails: clothing.details || 'default',
      brandingPosition: branding.position,
      baseLayerColor: getColorHex(colors.baseLayer) || '#FFFFFF',
      topLayerColor: getColorHex(colors.topLayer) || '#000000',
      bottomColor: getColorHex(colors.bottom) || 'neutral',
      shoesColor: getColorHex(colors.shoes) || 'default',
      logoKey: branding.logoKey,
      step: 'clothing_overlay',
      generationId,
    }

    const asset = await AssetService.createAsset({
      s3Key,
      type: 'intermediate',
      subType: 'clothing_overlay',
      mimeType: 'image/png',
      ownerType: ownerContext.teamId ? 'team' : 'person',
      teamId: ownerContext.teamId,
      personId: ownerContext.personId,
      parentAssetIds: logoAssetId ? [logoAssetId] : [],
      styleFingerprint: fingerprint,
      styleContext,
      temporary: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    })

    Logger.info('[ClothingOverlayElement] Created overlay Asset record', {
      assetId: asset.id,
      fingerprint,
      s3Key,
      generationId,
    })

    return asset as unknown as Asset
  }

  /**
   * Validate settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const { clothing, branding } = settings

    // If clothing overlay would be relevant, validate requirements
    if (
      hasValue(branding) &&
      branding.value.type === 'include' &&
      branding.value.position === 'clothing' &&
      clothing &&
      !isUserChoice(clothing) &&
      hasValue(clothing)
    ) {
      if (!branding.value.logoKey) {
        errors.push('Clothing overlay requires logo key when branding on clothing')
      }
    }

    return errors
  }

  // Priority: Execute after clothing (50), before other elements
  get priority(): number {
    return 55
  }
}

// Export singleton instance
export const clothingOverlayElement = new ClothingOverlayElement()
export default clothingOverlayElement

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Elements self-register on import!
 *
 * When this module is imported, the element automatically registers
 * with the composition registry. No manual registration required!
 */
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(clothingOverlayElement)
