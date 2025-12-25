/**
 * Branding Element
 *
 * Contributes logo placement and brand color rules to background generation
 * and logo preservation rules to composition.
 *
 * Implements preparation phase to download logo assets asynchronously.
 */

import {
  StyleElement,
  ElementContext,
  ElementContribution,
  type PreparedAsset,
} from '../../base/StyleElement'
import {
  BACKGROUND_BRANDING_PROMPT,
  ELEMENT_BRANDING_PROMPT,
  CLOTHING_BRANDING_RULES_BASE,
} from '../../branding/config'
import { generateBrandingPrompt } from '../../branding/prompt'
import type { KnownClothingStyle } from '../../clothing/config'
import { Logger } from '@/lib/logger'
import sharp from 'sharp'
import { AssetService } from '@/domain/services/AssetService'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import { getS3BucketName } from '@/lib/s3-client'

export class BrandingElement extends StyleElement {
  readonly id = 'branding'
  readonly name = 'Branding'
  readonly description = 'Logo and brand color management for backgrounds and composition'

  // Branding depends on clothing for style_key and detail_key
  get dependsOn(): string[] | undefined {
    return ['clothing']
  }

  get after(): string[] | undefined {
    return ['clothing']
  }

  // Branding affects different phases based on position:
  // - clothing: person-generation (step 1a)
  // - background/elements: background-generation (step 1b) + composition (step 2)
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no branding or explicitly excluded
    if (!settings.branding || settings.branding.type === 'exclude') {
      return false
    }

    // Skip if no logo is provided
    if (!settings.branding.logoKey && !settings.branding.logoAssetId) {
      return false
    }

    const position = settings.branding.position || 'background'

    // Person generation: contribute for clothing branding only
    if (phase === 'person-generation') {
      return position === 'clothing'
    }

    // Background generation: contribute for background/elements branding only
    if (phase === 'background-generation') {
      return position === 'background' || position === 'elements'
    }

    // Composition phase: contribute for background/elements branding only
    // (clothing branding was already applied in step 1a person generation)
    if (phase === 'composition') {
      return position === 'background' || position === 'elements'
    }

    return false
  }

  /**
   * Check if this element needs to prepare assets (logo download)
   */
  needsPreparation(context: ElementContext): boolean {
    const { settings } = context
    const branding = settings.branding

    if (!branding || branding.type === 'exclude') {
      return false
    }

    // Need preparation if we have a logo to download
    return !!(branding.logoKey || branding.logoAssetId)
  }

  /**
   * Prepare logo asset in step 0
   *
   * Downloads the logo image and returns it as a prepared asset
   * for use in background-generation and composition phases
   */
  async prepare(context: ElementContext): Promise<PreparedAsset> {
    const { settings, generationContext } = context
    const branding = settings.branding!
    const generationId = generationContext.generationId || 'unknown'

    // Type guard for downloadAsset service
    const downloadAsset = generationContext.downloadAsset as
      | ((key: string) => Promise<{ base64: string; mimeType: string } | null>)
      | undefined

    if (!downloadAsset) {
      throw new Error('BrandingElement.prepare(): downloadAsset must be provided in generationContext')
    }

    // Extract s3Client and owner context for Asset creation
    const s3Client = generationContext.s3Client as S3Client | undefined
    const teamId = generationContext.teamId as string | undefined
    const personId = generationContext.personId as string | undefined

    if (!s3Client) {
      throw new Error('BrandingElement.prepare(): s3Client must be provided in generationContext')
    }

    if (!teamId && !personId) {
      throw new Error('BrandingElement.prepare(): Either teamId or personId must be provided in generationContext')
    }

    const logoKey = branding.logoKey || branding.logoAssetId
    if (!logoKey) {
      throw new Error('BrandingElement.prepare(): No logo key or asset ID provided')
    }

    Logger.info('[BrandingElement] Downloading logo', {
      generationId,
      logoKey,
      position: branding.position,
    })

    // Download logo
    const logoImage = await downloadAsset(logoKey)
    if (!logoImage) {
      throw new Error(`BrandingElement.prepare(): Failed to download logo: ${logoKey}`)
    }

    Logger.info('[BrandingElement] Logo downloaded successfully', {
      generationId,
      logoKey,
      mimeType: logoImage.mimeType,
    })

    // Convert SVG to PNG if needed (Gemini doesn't support SVG)
    let finalBase64 = logoImage.base64
    let finalMimeType = logoImage.mimeType

    // Check if file is SVG by EITHER mimeType OR file extension
    // (downloadAsset sometimes misdetects SVG mimeType)
    const isSvg =
      logoImage.mimeType === 'image/svg+xml' ||
      logoKey.toLowerCase().endsWith('.svg')

    if (isSvg) {
      Logger.info('[BrandingElement] Converting SVG logo to PNG for Gemini compatibility', {
        generationId,
        logoKey,
      })

      try {
        // Convert base64 SVG to buffer
        const svgBuffer = Buffer.from(logoImage.base64, 'base64')

        // Convert SVG to PNG using sharp
        // Set width to 1024px (high quality) and maintain aspect ratio
        const pngBuffer = await sharp(svgBuffer)
          .png({ compressionLevel: 6, quality: 100 })
          .resize(1024, null, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer()

        // Convert PNG buffer back to base64
        finalBase64 = pngBuffer.toString('base64')
        finalMimeType = 'image/png'

        Logger.info('[BrandingElement] SVG converted to PNG successfully', {
          generationId,
          logoKey,
          originalSize: svgBuffer.length,
          pngSize: pngBuffer.length,
        })
      } catch (error) {
        Logger.error('[BrandingElement] Failed to convert SVG to PNG', {
          generationId,
          logoKey,
          error: error instanceof Error ? error.message : String(error),
        })
        throw new Error(`BrandingElement.prepare(): Failed to convert SVG to PNG: ${error}`)
      }
    }

    // Upload prepared logo to S3 and create Asset record
    const bucketName = getS3BucketName()
    const preparedLogoS3Key = `prepared-logos/${generationId}-${Date.now()}.png`

    Logger.info('[BrandingElement] Uploading prepared logo to S3', {
      generationId,
      s3Key: preparedLogoS3Key,
      originalLogoKey: logoKey,
    })

    try {
      // Upload to S3
      const preparedLogoBuffer = Buffer.from(finalBase64, 'base64')
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: preparedLogoS3Key,
          Body: preparedLogoBuffer,
          ContentType: finalMimeType,
        })
      )

      Logger.info('[BrandingElement] Prepared logo uploaded to S3 successfully', {
        generationId,
        s3Key: preparedLogoS3Key,
      })

      // Create Asset record
      const logoAsset = await AssetService.createAsset({
        s3Key: preparedLogoS3Key,
        type: 'intermediate',
        subType: 'prepared_logo',
        mimeType: finalMimeType,
        ownerType: teamId ? 'team' : 'person',
        teamId,
        personId,
        parentAssetIds: [], // Original logo might not be in Asset table
        styleFingerprint: undefined, // No fingerprint needed for prepared logos
        styleContext: {
          originalLogoKey: logoKey,
          brandingPosition: branding.position,
          generationId,
          step: 'logo_preparation',
        },
        temporary: false, // Keep for potential reuse
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })

      Logger.info('[BrandingElement] Created Asset record for prepared logo', {
        generationId,
        assetId: logoAsset.id,
        s3Key: preparedLogoS3Key,
      })

      // Return prepared asset with Asset ID in metadata
      return {
        elementId: this.id,
        assetType: 'logo',
        data: {
          base64: finalBase64,
          mimeType: finalMimeType,
          s3Key: logoKey, // Keep original logo key for reference
          metadata: {
            position: branding.position,
            assetId: logoAsset.id, // Include Asset ID for ClothingOverlayElement
            preparedLogoS3Key, // Include prepared logo S3 key
          },
        },
      }
    } catch (error) {
      Logger.error('[BrandingElement] Failed to upload prepared logo or create Asset', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new Error(`BrandingElement.prepare(): Failed to persist prepared logo: ${error}`)
    }
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase, settings } = context
    const branding = settings.branding!

    if (phase === 'person-generation') {
      return this.contributeToPersonGeneration(branding, context)
    }

    if (phase === 'background-generation') {
      return this.contributeToBackgroundGeneration(branding, context)
    }

    if (phase === 'composition') {
      return this.contributeToComposition(branding, context)
    }

    return {}
  }

  /**
   * Person generation phase contribution
   * Provides logo placement rules for clothing branding
   */
  private contributeToPersonGeneration(
    branding: NonNullable<import('../../branding/types').BrandingSettings>,
    context: ElementContext
  ): ElementContribution {
    // Only handle clothing branding in person generation
    const position = branding.position || 'background'
    if (position !== 'clothing') {
      return {}
    }

    // CRITICAL: Check if ClothingOverlayElement is handling branding
    // If overlay exists in contributions, it means clothing overlay is active and handling logo
    const hasClothingOverlay = context.existingContributions.some(
      (c) => c.metadata?.hasClothingOverlay === true
    )

    if (hasClothingOverlay) {
      // ClothingOverlayElement is handling branding - skip all branding instructions
      Logger.info('[BrandingElement] Clothing overlay is handling branding, skipping all direct logo contributions and instructions', {
        generationId: context.generationContext.generationId,
      })
      return {
        metadata: {
          handledByOverlay: true,
          position: 'clothing',
        },
      }
    }

    // Read clothing data from accumulated payload for branding placement logic
    const subject = context.accumulatedPayload?.subject as Record<string, unknown> | undefined
    const wardrobe = subject?.wardrobe as Record<string, unknown> | undefined
    const styleKey = (wardrobe?.style_key as KnownClothingStyle | undefined) || 'startup'
    const detailKey = (wardrobe?.detail_key as string | undefined) || 'dress_shirt'

    // Generate branding prompt with clothing context
    const brandingResult = generateBrandingPrompt({
      branding: context.settings.branding,
      styleKey,
      detailKey,
    })

    // Build payload structure for clothing branding
    const payload: Record<string, unknown> = {
      subject: {
        branding: brandingResult.branding,
      },
    }

    // Get prepared logo from context
    const preparedAssets = context.generationContext.preparedAssets
    const logoAsset = preparedAssets?.get(`${this.id}-logo`)

    // Add reference image if logo was prepared
    const referenceImages = []
    if (logoAsset?.data.base64) {
      referenceImages.push({
        url: `data:${logoAsset.data.mimeType || 'image/png'};base64,${logoAsset.data.base64}`,
        description: 'Company logo for clothing branding - apply according to position rules',
        type: 'branding' as const,
      })

      Logger.info('[BrandingElement] Added logo to person generation contribution', {
        generationId: context.generationContext.generationId,
        position: 'clothing',
        styleKey,
        detailKey,
      })
    }

    return {
      instructions: [],

      mustFollow: brandingResult.rules,

      referenceImages,
      payload,

      metadata: {
        position: 'clothing',
        hasLogo: true,
        logoKey: branding.logoKey,
        logoAssetId: branding.logoAssetId,
        styleKey,
        detailKey,
      },
    }
  }

  /**
   * Background generation phase contribution
   * Provides logo placement rules for the background image
   */
  private contributeToBackgroundGeneration(
    branding: NonNullable<import('../../branding/types').BrandingSettings>,
    context: ElementContext
  ): ElementContribution {
    const position = branding.position || 'background'

    // CRITICAL: Read clothing data from accumulated payload for branding placement logic
    const subject = context.accumulatedPayload?.subject as Record<string, unknown> | undefined
    const wardrobe = subject?.wardrobe as Record<string, unknown> | undefined
    const styleKey = (wardrobe?.style_key as KnownClothingStyle | undefined) || 'startup'
    const detailKey = (wardrobe?.detail_key as string | undefined) || 'dress_shirt'

    // Generate branding prompt with clothing context
    const brandingResult = generateBrandingPrompt({
      branding: context.settings.branding,
      styleKey,
      detailKey,
    })

    // Build payload structure based on position
    const payload: Record<string, unknown> = {}
    if (position === 'background' || position === 'elements') {
      payload.scene = {
        branding: brandingResult.branding,
      }
    } else {
      // Default to subject.branding for clothing or when position is not specified
      payload.subject = {
        branding: brandingResult.branding,
      }
    }

    // Select prompt based on position
    const promptConfig =
      position === 'elements'
        ? ELEMENT_BRANDING_PROMPT
        : position === 'clothing'
          ? this.getClothingBrandingPrompt()
          : BACKGROUND_BRANDING_PROMPT

    // Get prepared logo from context
    const preparedAssets = context.generationContext.preparedAssets
    const logoAsset = preparedAssets?.get(`${this.id}-logo`)

    // Add reference image if logo was prepared
    const referenceImages = []
    if (logoAsset?.data.base64) {
      referenceImages.push({
        url: `data:${logoAsset.data.mimeType || 'image/png'};base64,${logoAsset.data.base64}`,
        description: 'Company logo for branding - apply according to position rules',
        type: 'branding' as const,
      })

      Logger.info('[BrandingElement] Added logo to background generation contribution', {
        generationId: context.generationContext.generationId,
        position,
        styleKey,
        detailKey,
      })
    }

    return {
      instructions: [
        typeof promptConfig.logo_source === 'string' ? promptConfig.logo_source : '',
        typeof promptConfig.placement === 'string' ? promptConfig.placement : '',
      ].filter(Boolean),

      mustFollow: Array.isArray(promptConfig.rules)
        ? promptConfig.rules.map((rule) => String(rule))
        : [],

      payload,

      referenceImages,

      metadata: {
        position,
        hasLogo: true,
        logoKey: branding.logoKey,
        logoAssetId: branding.logoAssetId,
        styleKey,
        detailKey,
      },
    }
  }

  /**
   * Composition phase contribution
   * Adds logo reference and placement instructions for background/elements branding
   * (clothing branding is already on the person from Step 1a)
   */
  private contributeToComposition(
    branding: NonNullable<import('../../branding/types').BrandingSettings>,
    context: ElementContext
  ): ElementContribution {
    const position = branding.position || 'background'

    // Skip if branding is on clothing (already applied in Step 1a)
    if (position === 'clothing') {
      return {}
    }

    // Get prepared logo from context
    const preparedAssets = context.generationContext.preparedAssets
    const logoAsset = preparedAssets?.get(`${this.id}-logo`)

    if (!logoAsset?.data.base64) {
      Logger.warn('[BrandingElement] No logo asset found for composition phase', {
        generationId: context.generationContext.generationId,
        position,
      })
      return {}
    }

    // Get clothing context for branding placement logic
    const subject = context.accumulatedPayload?.subject as Record<string, unknown> | undefined
    const wardrobe = subject?.wardrobe as Record<string, unknown> | undefined
    const styleKey = (wardrobe?.style_key as KnownClothingStyle | undefined) || 'startup'
    const detailKey = (wardrobe?.detail_key as string | undefined) || 'dress_shirt'

    // Generate branding prompt with clothing context
    const brandingResult = generateBrandingPrompt({
      branding: context.settings.branding,
      styleKey,
      detailKey,
    })

    // Build position-specific instructions
    const instructions: string[] = []
    const mustFollow: string[] = []

    if (position === 'background') {
      instructions.push(
        'Place the provided logo on the background wall behind the person',
        'Logo should be positioned at head/shoulder level for visibility',
        'Logo can be partially occluded by the person to reinforce depth'
      )
      mustFollow.push(
        'Logo must be on the background wall surface with proper perspective',
        'Apply depth of field - logo should be slightly softer than the sharp person',
        'Logo must match background wall lighting and color temperature',
        'Logo should appear naturally integrated into the wall surface',
        'Scale logo appropriately - visible but not dominating the person'
      )
    } else if (position === 'elements') {
      instructions.push(
        'Create a fabric flag or banner 6-8 feet behind the person',
        'Apply the provided logo to the flag/banner surface',
        'Flag should be grounded on the floor, not floating'
      )
      mustFollow.push(
        'Flag must have natural fabric physics with folds and curves (not flat)',
        'Flag should be slightly softer in focus than the person (depth of field)',
        'Apply proper lighting and shadows to the flag',
        'Flag must be positioned BEHIND the person with clear spatial separation',
        'Logo on flag should follow fabric contours naturally',
        'Scale flag appropriately - visible but subordinate to person'
      )
    }

    // Add logo reference image
    const referenceImages = [
      {
        url: `data:${logoAsset.data.mimeType || 'image/png'};base64,${logoAsset.data.base64}`,
        description: `LOGO for ${position} branding - Place according to position rules`,
        type: 'branding' as const,
      },
    ]

    Logger.info('[BrandingElement] Added logo reference for composition phase', {
      generationId: context.generationContext.generationId,
      position,
      hasLogo: true,
    })

    // Build payload with branding configuration for JSON
    const payload: Record<string, unknown> = {
      scene: {
        branding: brandingResult.branding,
      },
    }

    return {
      instructions,
      mustFollow,
      referenceImages,
      payload,
      metadata: {
        hasBackgroundLogo: true,
        position,
        logoKey: branding.logoKey,
        logoAssetId: branding.logoAssetId,
      },
    }
  }

  /**
   * Get clothing branding prompt configuration
   */
  private getClothingBrandingPrompt(): Record<string, unknown> {
    return {
      logo_source:
        'Use the attached image labeled "logo" as the branding element for clothing',
      placement: 'Place logo on clothing garment (shirt, sweater, etc.)',
      rules: CLOTHING_BRANDING_RULES_BASE,
    }
  }

  /**
   * Validate branding settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const branding = settings.branding

    if (!branding) {
      return errors
    }

    // If branding is set to include, must have a logo
    if (
      branding.type === 'include' &&
      !branding.logoKey &&
      !branding.logoAssetId
    ) {
      errors.push(
        'Branding is set to "include" but no logo key or asset ID is provided'
      )
    }

    // Validate position
    if (
      branding.position &&
      !['background', 'clothing', 'elements'].includes(branding.position)
    ) {
      errors.push(`Invalid branding position: ${branding.position}`)
    }

    return errors
  }

  // Medium priority - branding should be established before composition rules
  get priority(): number {
    return 60
  }
}

// Export singleton instance
export const brandingElement = new BrandingElement()
export default brandingElement

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Elements self-register on import!
 *
 * When this module is imported, the element automatically registers
 * with the composition registry. No manual registration required!
 */
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(brandingElement)
