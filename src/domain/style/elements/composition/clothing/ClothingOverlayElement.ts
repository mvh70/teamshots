/**
 * Clothing Overlay Element
 *
 * Pre-generates clothing overlays with logos in Step 0 for improved logo placement accuracy.
 * Creates flat-lay product photography of garments with logos correctly positioned,
 * then uses these as visual templates during person generation.
 *
 * This element:
 * 1. Checks if clothing overlay is needed (branding on clothing enabled)
 * 2. Generates overlay in Step 0 (or loads from cache)
 * 3. Provides overlay as reference image in person-generation phase
 * 4. Coordinates with BrandingElement to avoid duplicate logo placement
 */

import {
  StyleElement,
  ElementContext,
  ElementContribution,
  type PreparedAsset,
} from '../../base/StyleElement'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { CostTrackingService } from '@/domain/services/CostTrackingService'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import { getS3BucketName } from '@/lib/s3-client'
import { prisma } from '@/lib/prisma'
import type { ClothingSettings, BrandingSettings } from '@/types/photo-style'
import { createHash } from 'crypto'
import { WARDROBE_DETAILS } from '../../clothing/config'
import type { KnownClothingStyle } from '../../clothing/config'

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
    if (settings.branding?.type !== 'include') return false
    if (settings.branding?.position !== 'clothing') return false

    // For ALL clothing styles when branding on clothing is enabled
    const clothing = settings.clothing
    if (!clothing || clothing.type === 'user-choice') return false

    // Overlay applies to all predefined clothing styles
    return true
  }

  /**
   * Check if this element needs to prepare assets (clothing overlay)
   * NOTE: This is called during 'preparation' phase, not 'person-generation' phase
   */
  needsPreparation(context: ElementContext): boolean {
    const { settings } = context

    // Only when branding on clothing is enabled
    if (settings.branding?.type !== 'include') return false
    if (settings.branding?.position !== 'clothing') return false

    // For ALL clothing styles when branding on clothing is enabled
    const clothing = settings.clothing
    if (!clothing || clothing.type === 'user-choice') return false

    // Overlay applies to all predefined clothing styles
    return true
  }

  /**
   * Prepare clothing overlay in Step 0
   *
   * This method:
   * 1. Generates cache key from clothing + branding settings
   * 2. Checks database for cached overlay
   * 3. Downloads logo if needed
   * 4. Generates clothing overlay using Gemini (or loads from cache)
   * 5. Saves overlay to S3 and database
   * 6. Returns prepared asset for use in contribute()
   */
  async prepare(context: ElementContext): Promise<PreparedAsset> {
    const { settings, generationContext } = context
    const clothing = settings.clothing!
    const branding = settings.branding!
    const generationId = generationContext.generationId || 'unknown'

    // Type guard for services
    const downloadAsset = generationContext.downloadAsset as
      | ((key: string) => Promise<{ base64: string; mimeType: string } | null>)
      | undefined
    const s3Client = generationContext.s3Client as S3Client | undefined

    if (!downloadAsset || !s3Client) {
      throw new Error('ClothingOverlayElement.prepare(): downloadAsset and s3Client must be provided in generationContext')
    }

    const bucketName = getS3BucketName()

    Logger.info('[ClothingOverlayElement] Starting clothing overlay preparation', {
      generationId,
      style: clothing.style,
      details: clothing.details,
      brandingPosition: branding.position,
    })

    // 1. Generate cache key
    const cacheKey = this.getCacheKey(clothing, branding)
    Logger.debug('[ClothingOverlayElement] Generated cache key', {
      cacheKey,
      generationId,
    })

    // 2. Check database cache
    let overlayBase64: string | null = null
    let s3Key: string | null = null
    let fromCache = false

    const cached = await this.loadCachedOverlay(cacheKey)
    if (cached) {
      Logger.info('[ClothingOverlayElement] Found cached overlay', {
        cacheKey,
        s3Key: cached.s3Key,
        generationId,
      })

      // Try to download cached overlay
      try {
        const cachedAsset = await downloadAsset(cached.s3Key)
        if (cachedAsset) {
          overlayBase64 = cachedAsset.base64
          s3Key = cached.s3Key
          fromCache = true
          Logger.info('[ClothingOverlayElement] Using cached clothing overlay', {
            cacheKey,
            s3Key: cached.s3Key,
            generationId,
          })
        } else {
          Logger.warn('[ClothingOverlayElement] Cached overlay not found in S3, will regenerate', {
            cacheKey,
            s3Key: cached.s3Key,
            generationId,
          })
        }
      } catch (error) {
        Logger.warn('[ClothingOverlayElement] Failed to load cached overlay', {
          cacheKey,
          generationId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // 3. Generate overlay if no cache
    if (!overlayBase64) {
      // Get prepared logo from BrandingElement (Step 0) - already has SVG conversion
      const preparedLogo = generationContext.preparedAssets?.get('branding-logo')
      if (!preparedLogo?.data.base64) {
        throw new Error(
          'ClothingOverlayElement.prepare(): Prepared logo asset not found. ' +
          'BrandingElement must run before ClothingOverlayElement in Step 0.'
        )
      }

      const logoData = {
        base64: preparedLogo.data.base64,
        mimeType: preparedLogo.data.mimeType || 'image/png'
      }

      Logger.info('[ClothingOverlayElement] Using prepared logo for overlay generation', {
        generationId,
        logoKey: preparedLogo.data.s3Key,
        mimeType: logoData.mimeType,
      })

      // 4. Generate clothing overlay with logo
      const overlayResult = await this.generateClothingOverlay({
        clothing,
        branding,
        logoData,
        generationId,
      })

      if (overlayResult.success) {
        overlayBase64 = overlayResult.data.base64

        // 4.5. Save to tmp for debugging
        await this.saveTmpOverlay(overlayBase64, cacheKey, generationId)

        // 5. Upload to S3
        s3Key = await this.uploadOverlay(overlayBase64, cacheKey, s3Client, bucketName, generationId)

        // 6. Save cache reference
        await this.saveCacheReference(cacheKey, s3Key, clothing, branding)

        Logger.info('[ClothingOverlayElement] Generated and cached new clothing overlay', {
          cacheKey,
          s3Key,
          generationId,
        })
      } else {
        throw new Error(`ClothingOverlayElement.prepare(): Overlay generation failed: ${overlayResult.error}`)
      }
    }

    // 7. Return prepared asset
    return {
      elementId: this.id,
      assetType: 'overlay',
      data: {
        base64: overlayBase64!,
        mimeType: 'image/png',
        s3Key: s3Key!,
        metadata: {
          clothingStyle: `${clothing.style}-${clothing.details}`,
          brandingPosition: branding.position,
          cacheKey,
          fromCache,
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

    if (!overlay) {
      Logger.error('[ClothingOverlayElement] No prepared overlay found - this should not happen!', {
        generationId: context.generationContext.generationId,
        availableKeys: Array.from(preparedAssets?.keys() || []),
        expectedKey: `${this.id}-overlay`,
      })

      // CRITICAL: Still set metadata to suppress branding even without overlay
      // This prevents logo duplication if overlay preparation failed
      return {
        metadata: {
          hasClothingOverlay: true, // Mark as handled to suppress BrandingElement
          overlayMissing: true,     // Flag for debugging
        },
      }
    }

    Logger.info('[ClothingOverlayElement] Adding clothing overlay to contribution', {
      generationId: context.generationContext.generationId,
      fromCache: overlay.data.metadata?.fromCache,
    })

    // Add overlay as reference image
    return {
      referenceImages: [
        {
          url: `data:${overlay.data.mimeType};base64,${overlay.data.base64}`,
          description: 'CLOTHING OVERLAY - Use this as a visual template for clothing and logo placement. The logo is already correctly positioned on the base layer with proper layering shown.',
          type: 'clothing' as const,
        },
      ],

      mustFollow: [
        'Use the clothing overlay as the PRIMARY reference for garment styling and logo placement.',
        'The overlay shows the exact logo position on the base layer - replicate this on the person.',
        'Maintain the layering relationship shown in the overlay (base layer with logo, outer layer on top).',
        'The logo placement in the overlay is definitive - do not reinterpret or relocate it.',
        'DO NOT apply the logo again from other reference images - the overlay already has the logo correctly placed.',
        'Ignore any additional logo reference images or branding instructions - use ONLY the overlay for clothing and logo.',
      ],

      freedom: [
        'The clothing overlay shows ONLY the core garments in a flat-lay arrangement - it does NOT show the person.',
        'All facial features and personal accessories (glasses, earrings, watches, jewelry) come from the SELFIE references, NOT from the clothing overlay.',
        'If the selfies show the person wearing glasses, you MUST include those same glasses in the generated image.',
      ],

      metadata: {
        hasClothingOverlay: true,
        overlayS3Key: overlay.data.s3Key,
        clothingStyle: overlay.data.metadata?.clothingStyle,
        suppressWardrobeBranding: true, // Don't add branding from wardrobe
        suppressLogoReference: true, // Don't add separate logo reference
      },
    }
  }

  /**
   * Generate clothing overlay using Gemini
   */
  private async generateClothingOverlay(params: {
    clothing: ClothingSettings
    branding: BrandingSettings
    logoData: { base64: string; mimeType: string }
    generationId?: string
  }): Promise<
    | { success: true; data: { base64: string }; usage?: { inputTokens: number; outputTokens: number } }
    | { success: false; error: string; code?: string }
  > {
    const { clothing, branding, logoData, generationId } = params
    const startTime = Date.now()

    try {
      const { generateWithGemini } = await import('@/queue/workers/generate-image/gemini')

      // Build prompt for clothing overlay generation
      // Get shot type from settings if available
      const shotType = (clothing as any).shotType || 'medium-shot'
      const prompt = this.buildOverlayPrompt(clothing, branding, shotType)

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
  private buildOverlayPrompt(clothing: ClothingSettings, branding: BrandingSettings, shotType: string = 'medium-shot'): string {
    const styleKey = clothing.style as KnownClothingStyle
    const detailKey = clothing.details || 'default'

    // Get wardrobe details from config
    const wardrobeConfig = WARDROBE_DETAILS[styleKey]?.[detailKey]

    if (!wardrobeConfig) {
      throw new Error(`No wardrobe config found for ${styleKey}-${detailKey}`)
    }

    // Get clothing-specific template for logo placement
    const template = this.getClothingTemplate(`${styleKey}-${detailKey}`)

    // Extract colors from clothing settings
    const colors = clothing.colors || {}
    const baseLayerColor = colors.baseLayer || '#FFFFFF'
    const topLayerColor = colors.topLayer || '#000000'

    // Determine what items to show based on shot type
    const showPants = shotType === 'medium-shot' || shotType === 'full-body'
    const showShoes = shotType === 'full-body'

    // Build layer descriptions with colors
    const layerDescriptions: string[] = []

    if (wardrobeConfig.baseLayer) {
      layerDescriptions.push(
        `Base layer: ${wardrobeConfig.baseLayer} in ${baseLayerColor} color`
      )
    }

    if (wardrobeConfig.outerLayer) {
      layerDescriptions.push(
        `Outer layer: ${wardrobeConfig.outerLayer} in ${topLayerColor} color`
      )
    }

    if (showPants) {
      layerDescriptions.push(
        `Pants: Professional ${styleKey === 'business' ? 'dress pants or trousers' : 'casual pants or chinos'} in coordinating neutral color`
      )
    }

    if (showShoes) {
      layerDescriptions.push(
        `Shoes: ${styleKey === 'business' ? 'Professional dress shoes' : 'Clean casual shoes'}`
      )
    }

    return `
CREATE A CLOTHING OVERLAY WITH LOGO PLACEMENT:

You are creating a flat-lay product photograph showing SEPARATE clothing items arranged for a professional headshot.

CLOTHING ITEMS TO SHOW (SEPARATELY, NOT WORN):
${layerDescriptions.map((layer, i) => `${i + 1}. ${layer}`).join('\n')}

LAYOUT INSTRUCTIONS:
- Disassemble the clothing into individual components
- Arrange items in a clean, organized GRID or KNOLLING pattern on a neutral background (white or light gray)
- Ensure even spacing and no overlaps between items
- Each item must be clearly separated and laid flat
- Add a subtle drop shadow to give depth
- Label each item with a clean, sans-serif text label next to it (e.g., "Base Layer", "Outer Layer", "Pants")
- Use professional product photography styling
${showPants ? '- Include pants as a separate labeled item' : ''}
${showShoes ? '- Include shoes as a separate labeled item' : ''}

LOGO PLACEMENT:
- Place the logo on: ${template.logoLayer}
- Position: ${template.logoPosition}
- The logo should look ${template.logoStyle} (embroidered/printed)
- Logo must be centered and proportional on the specified garment
- Logo is applied to the BASE LAYER garment only

COLOR ACCURACY:
- Base layer MUST be ${baseLayerColor} color
- Outer layer MUST be ${topLayerColor} color
- Match the specified hex colors accurately
- Maintain color consistency across the entire garment

CRITICAL REQUIREMENTS:
- Clean product photography on neutral background (white or light grey)
- Each garment shown separately and clearly
- Logo integrated into the base layer garment only
- Realistic fabric rendering with proper texture and depth
- NO person wearing the clothes - just the clothing items laid flat
- High contrast and sharp details
- Professional studio lighting with soft shadows

OUTPUT:
- PNG image showing clothing items laid out separately
- Each item clearly visible and properly colored
- Logo correctly positioned on base layer garment
- Ready to use as visual reference for AI generation

Use the attached logo reference image for exact logo colors and design.
`.trim()
  }

  /**
   * Get clothing template for specific style
   */
  private getClothingTemplate(styleKey: string): ClothingTemplate {
    const templates: Record<string, ClothingTemplate> = {
      // LAYERED STYLES (Multi-layer clothing)
      'business-casual': {
        description: 'Business casual with jacket over shirt',
        layers: ['Base layer: Fitted t-shirt or knit top', 'Outer layer: Blazer or suit jacket, worn open'],
        logoLayer: 'Base layer (t-shirt/knit top)',
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
   * Generate cache key from clothing and branding settings
   * Version 2: Now includes colors and uses wardrobe config
   */
  private getCacheKey(clothing: ClothingSettings, branding: BrandingSettings): string {
    const logoHash = this.hashLogoKey(branding.logoKey || '')

    // Include colors in cache key
    const colors = clothing.colors || {}
    const baseColor = (colors.baseLayer || '#FFFFFF').replace('#', '')
    const topColor = (colors.topLayer || '#000000').replace('#', '')

    const parts = [
      'clothing-overlay',
      'v2', // Version bump for new prompt format
      clothing.style,
      clothing.details,
      branding.position,
      logoHash,
      baseColor,
      topColor,
    ]

    return parts.join('-')
  }

  /**
   * Hash logo key for cache key generation
   */
  private hashLogoKey(logoKey: string): string {
    if (!logoKey) return 'no-logo'
    // Use first 8 characters of SHA256 hash for consistency
    return createHash('sha256').update(logoKey).digest('hex').substring(0, 8)
  }

  /**
   * Load cached overlay from database
   */
  private async loadCachedOverlay(cacheKey: string): Promise<{ s3Key: string } | null> {
    try {
      const cached = await prisma.clothingOverlayCache.findUnique({
        where: { cacheKey },
        select: { s3Key: true },
      })

      return cached
    } catch (error) {
      Logger.warn('[ClothingOverlayElement] Failed to load cached overlay', {
        cacheKey,
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
    cacheKey: string,
    generationId: string
  ): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')

      const tmpDir = path.join(process.cwd(), 'tmp', 'collages')
      await fs.mkdir(tmpDir, { recursive: true })

      const overlayBuffer = Buffer.from(overlayBase64, 'base64')
      const filename = `${generationId}-overlay-${cacheKey}.png`
      await fs.writeFile(path.join(tmpDir, filename), overlayBuffer)

      Logger.info('[ClothingOverlayElement] Saved overlay to tmp folder', {
        path: `tmp/collages/${filename}`,
        generationId,
        cacheKey,
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
    cacheKey: string,
    s3Client: S3Client,
    bucketName: string,
    generationId: string
  ): Promise<string> {
    try {
      const overlayBuffer = Buffer.from(overlayBase64, 'base64')
      const s3Key = `clothing-overlays/${cacheKey}-${Date.now()}.png`

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
   * Save cache reference to database
   */
  private async saveCacheReference(
    cacheKey: string,
    s3Key: string,
    clothing: ClothingSettings,
    branding: BrandingSettings
  ): Promise<void> {
    try {
      await prisma.clothingOverlayCache.upsert({
        where: { cacheKey },
        update: {
          s3Key,
          updatedAt: new Date(),
        },
        create: {
          cacheKey,
          s3Key,
          logoKey: branding.logoKey || null,
          style: clothing.style,
          detail: clothing.details || 'default',
        },
      })

      Logger.info('[ClothingOverlayElement] Saved cache reference to database', {
        cacheKey,
        s3Key,
      })
    } catch (error) {
      Logger.warn('[ClothingOverlayElement] Failed to save cache reference', {
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Validate settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const { clothing, branding } = settings

    // If clothing overlay would be relevant, validate requirements
    if (
      branding?.type === 'include' &&
      branding?.position === 'clothing' &&
      clothing &&
      clothing.type !== 'user-choice'
    ) {
      if (!branding.logoKey) {
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
