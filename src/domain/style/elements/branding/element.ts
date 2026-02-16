/**
 * Branding Element
 *
 * Contributes logo placement and brand color rules to generation phases.
 *
 * Implements preparation phase to download logo assets asynchronously.
 */

import {
  StyleElement,
  ElementContext,
  ElementContribution,
  type PreparedAsset,
} from '../base/StyleElement'
import {
  getContextualBackgroundBrandingRules,
  generateBrandingPrompt,
  getBrandingIntegrationRules,
  getBrandingPromptConfig,
  getCompositionLayoutBrandingNote,
  getLogoIntegrityRules,
  getLogoReferenceDescription,
} from './prompt'
import type { KnownClothingStyle } from '../clothing/config'
import { hasValue } from '../base/element-types'
import { Logger } from '@/lib/logger'
import sharp from 'sharp'
import { AssetService } from '@/domain/services/AssetService'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import { getS3BucketName } from '@/lib/s3-client'
import { autoRegisterElement } from '../composition/registry'

function mergeUniqueRules(...ruleSets: string[][]): string[] {
  return [...new Set(ruleSets.flat().map((rule) => rule.trim()).filter(Boolean))]
}

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
  // - background/elements: pre-generated in Step 0 and surfaced via background buffer in Step 2
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no branding or no value
    if (!settings.branding || !hasValue(settings.branding)) {
      return false
    }

    const brandingValue = settings.branding.value

    // Skip if explicitly excluded
    if (brandingValue.type === 'exclude') {
      return false
    }

    // Skip if no logo is provided
    if (!brandingValue.logoKey && !brandingValue.logoAssetId) {
      return false
    }

    const position = brandingValue.position || 'background'

    // Person generation: contribute for clothing branding only
    if (phase === 'person-generation') {
      return position === 'clothing'
    }

    // Background generation: contribute for background/elements branding only
    if (phase === 'background-generation') {
      return position === 'background' || position === 'elements'
    }

    // Composition phase: branding is already applied before Step 2.
    // - clothing: applied in Step 1a (overlay or direct)
    // - background/elements: pre-generated in Step 0 for all background types
    if (phase === 'composition') {
      return false
    }

    // Evaluation phase: evaluate background/elements branding in the final image.
    if (phase === 'evaluation') {
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

    if (!branding || !hasValue(branding)) {
      return false
    }

    const brandingValue = branding.value
    if (brandingValue.type === 'exclude') {
      return false
    }

    // Need preparation if we have a logo to download
    return !!(brandingValue.logoKey || brandingValue.logoAssetId)
  }

  /**
   * Prepare logo asset in step 0
   *
   * Downloads the logo image and returns it as a prepared asset
   * for use in background-generation and composition phases
   */
  async prepare(context: ElementContext): Promise<PreparedAsset> {
    const { settings, generationContext } = context
    // Extract the branding value from the wrapper
    if (!settings.branding || !hasValue(settings.branding)) {
      throw new Error('BrandingElement.prepare(): branding must have a value')
    }
    const brandingValue = settings.branding.value
    const generationId = generationContext.generationId || 'unknown'

    // Type guard for downloadAsset service
    const downloadAsset = generationContext.downloadAsset as
      | ((key: string) => Promise<{ base64: string; mimeType: string } | null>)
      | undefined

    if (!downloadAsset) {
      throw new Error('BrandingElement.prepare(): downloadAsset must be provided in generationContext')
    }

    const logoKey = brandingValue.logoKey || brandingValue.logoAssetId
    if (!logoKey) {
      throw new Error('BrandingElement.prepare(): No logo key or asset ID provided')
    }

    // OPTIMIZATION: Check if we already have a prepared logo from a previous generation
    // This is common in regenerations where the logo was already processed
    const existingPreparedKey = brandingValue.preparedLogoKey
    if (existingPreparedKey) {
      Logger.info('[BrandingElement] Found existing prepared logo, attempting to reuse', {
        generationId,
        preparedLogoKey: existingPreparedKey,
        originalLogoKey: logoKey,
      })

      try {
        // Try to download the already-prepared logo
        const preparedLogo = await downloadAsset(existingPreparedKey)
        if (preparedLogo) {
          Logger.info('[BrandingElement] Successfully reused prepared logo from previous generation', {
            generationId,
            preparedLogoKey: existingPreparedKey,
            mimeType: preparedLogo.mimeType,
            savedProcessing: 'skipped download, conversion, and upload',
          })

          // Return the prepared asset directly
          return {
            elementId: this.id,
            assetType: 'logo',
            data: {
              base64: preparedLogo.base64,
              mimeType: preparedLogo.mimeType,
              s3Key: logoKey, // Keep original logo key for reference
              metadata: {
                position: brandingValue.position,
                preparedLogoS3Key: existingPreparedKey,
                reused: true, // Flag to indicate this was reused
              },
            },
          }
        }
      } catch (error) {
        Logger.warn('[BrandingElement] Failed to reuse prepared logo, will re-prepare', {
          generationId,
          preparedLogoKey: existingPreparedKey,
          error: error instanceof Error ? error.message : String(error),
        })
        // Fall through to full preparation
      }
    }

    // Extract s3Client and owner context for Asset creation (only needed for new preparation)
    const s3Client = generationContext.s3Client as S3Client | undefined
    const teamId = generationContext.teamId as string | undefined
    const personId = generationContext.personId as string | undefined

    if (!s3Client) {
      throw new Error('BrandingElement.prepare(): s3Client must be provided in generationContext')
    }

    if (!teamId && !personId) {
      throw new Error('BrandingElement.prepare(): Either teamId or personId must be provided in generationContext')
    }

    Logger.info('[BrandingElement] Downloading logo', {
      generationId,
      logoKey,
      position: brandingValue.position,
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

        // Convert SVG to PNG at high render density without downscaling.
        const pngBuffer = await sharp(svgBuffer, { density: 300 })
          .png({ compressionLevel: 0 })
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

    // Add green chroma background to logos with transparency
    // This helps the model "see" white text/elements that would otherwise be invisible
    try {
      const logoBuffer = Buffer.from(finalBase64, 'base64')
      const metadata = await sharp(logoBuffer).metadata()

      // Check if image has alpha channel (transparency)
      if (metadata.hasAlpha) {
        Logger.info('[BrandingElement] Logo has transparency, adding green chroma background', {
          generationId,
          logoKey,
          width: metadata.width,
          height: metadata.height,
        })

        // Composite logo onto bright green (#00FF00) background
        // This makes white elements highly visible to the model
        const chromaBuffer = await sharp({
          create: {
            width: metadata.width || 1024,
            height: metadata.height || 1024,
            channels: 3,
            background: { r: 0, g: 255, b: 0 }, // Bright green chroma key
          },
        })
          .composite([{ input: logoBuffer, blend: 'over' }])
          .png({ compressionLevel: 0 })
          .toBuffer()

        finalBase64 = chromaBuffer.toString('base64')
        finalMimeType = 'image/png'

        Logger.info('[BrandingElement] Green chroma background added successfully', {
          generationId,
          logoKey,
          originalSize: logoBuffer.length,
          chromaSize: chromaBuffer.length,
        })
      }
    } catch (error) {
      // Non-fatal - continue with original logo if chroma compositing fails
      Logger.warn('[BrandingElement] Failed to add green chroma background (continuing with original)', {
        generationId,
        logoKey,
        error: error instanceof Error ? error.message : String(error),
      })
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

      // Save debug file to tmp/v3-debug (same pattern as step 1a)
      try {
        const { promises: fs } = await import('fs')
        const path = await import('path')
        const tmpDir = path.join(process.cwd(), 'tmp', 'v3-debug')
        await fs.mkdir(tmpDir, { recursive: true })
        const debugFilename = `prepared-logo-${generationId}-${Date.now()}.png`
        const debugPath = path.join(tmpDir, debugFilename)
        await fs.writeFile(debugPath, preparedLogoBuffer)
        Logger.info('[BrandingElement] Saved prepared logo to debug folder', {
          generationId,
          path: debugPath,
        })
      } catch (debugError) {
        Logger.warn('[BrandingElement] Failed to save debug file (non-fatal)', {
          generationId,
          error: debugError instanceof Error ? debugError.message : String(debugError),
        })
      }

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
          brandingPosition: brandingValue.position,
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
            position: brandingValue.position,
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
    // Extract branding value from wrapper
    if (!settings.branding || !hasValue(settings.branding)) {
      return {}
    }
    const brandingValue = settings.branding.value

    if (phase === 'person-generation') {
      return this.contributeToPersonGeneration(brandingValue, context)
    }

    if (phase === 'background-generation') {
      return this.contributeToBackgroundGeneration(brandingValue, context)
    }

    if (phase === 'evaluation') {
      return this.contributeToEvaluation(brandingValue, context)
    }

    return {}
  }

  /**
   * Person generation phase contribution
   * Provides logo placement rules for clothing branding
   */
  private contributeToPersonGeneration(
    brandingValue: import('./types').BrandingValue,
    context: ElementContext
  ): ElementContribution {
    // Only handle clothing branding in person generation
    const position = brandingValue.position || 'background'
    if (position !== 'clothing') {
      return {}
    }

    // CRITICAL: Check if ClothingOverlayElement is handling branding
    // Check if clothing overlay was successfully prepared (not just attempted)
    const preparedAssets = context.generationContext.preparedAssets
    const clothingOverlayAsset = preparedAssets?.get('clothing-overlay-overlay')
    const hasWorkingClothingOverlay =
      // Overlay asset exists AND has actual image data
      (clothingOverlayAsset?.data?.base64 && clothingOverlayAsset.data.base64.length > 0) ||
      // OR it's already in contributions (fallback check for dependency ordering)
      context.existingContributions.some((c) => c.metadata?.hasClothingOverlay === true)

    if (hasWorkingClothingOverlay) {
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

    // Get prepared logo from context (preparedAssets already declared above)
    const logoAsset = preparedAssets?.get(`${this.id}-logo`)

    // Add reference image if logo was prepared - with emphatic copying instructions
    const referenceImages = []
    if (logoAsset?.data.base64) {
      referenceImages.push({
        url: `data:${logoAsset.data.mimeType || 'image/png'};base64,${logoAsset.data.base64}`,
        description: getLogoReferenceDescription('clothing'),
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
      mustFollow: [
        ...getLogoIntegrityRules(),
        ...brandingResult.rules
      ],

      referenceImages,
      payload,

      metadata: {
        position: 'clothing',
        hasLogo: true,
        logoKey: brandingValue.logoKey,
        logoAssetId: brandingValue.logoAssetId,
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
    brandingValue: import('./types').BrandingValue,
    context: ElementContext
  ): ElementContribution {
    const position = brandingValue.position || 'background'
    const background = context.settings.background
    const backgroundType = background && hasValue(background) ? background.value.type : undefined
    const contextualBackgroundRules = getContextualBackgroundBrandingRules({
      position,
      backgroundType,
    })

    // Generate branding prompt with clothing context
    const brandingResult = generateBrandingPrompt({
      branding: context.settings.branding,
      styleKey: 'startup',
      detailKey: 'dress_shirt',
    })

    // Build payload structure based on position
    const payload: Record<string, unknown> = {}
    if (position === 'background' || position === 'elements') {
      const brandingPayload = brandingResult.branding as Record<string, unknown>
      const existingBrandingRules = Array.isArray(brandingPayload.rules)
        ? brandingPayload.rules.map((rule) => String(rule))
        : []

      payload.scene = {
        branding: {
          ...brandingPayload,
          rules: mergeUniqueRules(existingBrandingRules, contextualBackgroundRules),
          logo_integrity: getLogoIntegrityRules(),
          integration: getBrandingIntegrationRules(),
        },
      }
      payload.composition_layout = {
        branding_position: getCompositionLayoutBrandingNote(),
      }
    } else {
      // Default to subject.branding for clothing or when position is not specified
      payload.subject = {
        branding: brandingResult.branding,
      }
    }

    const promptConfig = getBrandingPromptConfig(
      position === 'elements' ? 'elements' : 'background'
    )

    const configRules = promptConfig.rules.map((rule) => String(rule))

    return {
      mustFollow: [
        ...getLogoIntegrityRules(),
        ...configRules,
        ...contextualBackgroundRules,
      ],

      payload,

      metadata: {
        position,
        hasLogo: true,
        logoKey: brandingValue.logoKey,
        logoAssetId: brandingValue.logoAssetId,
      },
    }
  }

  /**
   * Evaluation phase contribution
   * Provides branding-specific evaluation constraints for Step 3.
   */
  private contributeToEvaluation(
    brandingValue: import('./types').BrandingValue,
    context: ElementContext
  ): ElementContribution {
    const position = brandingValue.position || 'background'
    if (position !== 'background' && position !== 'elements') {
      return {}
    }

    const background = context.settings.background
    const backgroundType = background && hasValue(background) ? background.value.type : undefined
    const contextualBackgroundRules = getContextualBackgroundBrandingRules({
      position,
      backgroundType,
    })

    return {
      mustFollow: [...getLogoIntegrityRules(), ...contextualBackgroundRules],
      metadata: {
        position,
        evaluatePlacement: true,
        logoKey: brandingValue.logoKey,
        logoAssetId: brandingValue.logoAssetId,
      },
    }
  }

  /**
   * Validate branding settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const branding = settings.branding

    if (!branding || !hasValue(branding)) {
      return errors
    }

    const brandingVal = branding.value

    // If branding is set to include, must have a logo
    if (
      brandingVal.type === 'include' &&
      !brandingVal.logoKey &&
      !brandingVal.logoAssetId
    ) {
      errors.push(
        'Branding is set to "include" but no logo key or asset ID is provided'
      )
    }

    // Validate position
    if (
      brandingVal.position &&
      !['background', 'clothing', 'elements'].includes(brandingVal.position)
    ) {
      errors.push(`Invalid branding position: ${brandingVal.position}`)
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

autoRegisterElement(brandingElement)
