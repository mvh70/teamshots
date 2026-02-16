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
} from '../base/StyleElement'
import { isUserChoice, hasValue } from '../base/element-types'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { CostTrackingService } from '@/domain/services/CostTrackingService'
import { STAGE_MODEL } from '@/queue/workers/generate-image/config'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getColorHex, type ColorValue } from '../clothing-colors/types'
import type { S3Client } from '@aws-sdk/client-s3'
import { getS3BucketName } from '@/lib/s3-client'
import type { BrandingSettings, BrandingValue } from '../branding/types'
import type { ClothingValue } from './types'
import {
  buildClothingOverlayGenerationPrompt,
  getClothingOverlayContributionFreedomRules,
  getClothingOverlayContributionMustFollowRules,
  getClothingTemplateReferenceDescription,
} from './prompt'
import { AssetService } from '@/domain/services/AssetService'
import { StyleFingerprintService } from '@/domain/services/StyleFingerprintService'
import type { Asset } from '@prisma/client'
import { autoRegisterElement } from '../composition/registry'

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
    const mustFollow = getClothingOverlayContributionMustFollowRules()
    const freedom = getClothingOverlayContributionFreedomRules()

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
        description: getClothingTemplateReferenceDescription(),
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
    logoData: { base64: string; mimeType: string }
    generationId?: string
    clothingColors?: { baseLayer?: string | ColorValue; topLayer?: string | ColorValue; bottom?: string | ColorValue; shoes?: string | ColorValue }
  }): Promise<
    | { success: true; data: { base64: string }; usage?: { inputTokens: number; outputTokens: number } }
    | { success: false; error: string; code?: string }
  > {
    const { clothing, logoData, generationId, clothingColors } = params
    const startTime = Date.now()

    try {
      const { generateWithGemini } = await import('@/queue/workers/generate-image/gemini')

      // Build prompt for clothing overlay generation
      // Get shot type from settings if available
      const shotType = (clothing as any).shotType || 'medium-shot'
      const prompt = buildClothingOverlayGenerationPrompt({
        clothing,
        shotType,
        clothingColors,
      })

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
        { temperature: 0.2, stage: 'CLOTHING_OVERLAY' }
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
        model: STAGE_MODEL.CLOTHING_OVERLAY,
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

autoRegisterElement(clothingOverlayElement)
