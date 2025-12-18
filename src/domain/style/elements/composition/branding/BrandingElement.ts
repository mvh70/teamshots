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
import { Logger } from '@/lib/logger'

export class BrandingElement extends StyleElement {
  readonly id = 'branding'
  readonly name = 'Branding'
  readonly description = 'Logo and brand color management for backgrounds and composition'

  // Branding only affects background generation and composition, not person generation
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

    // Only contribute to background and composition phases
    return phase === 'background-generation' || phase === 'composition'
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

    // Return prepared asset
    return {
      elementId: this.id,
      assetType: 'logo',
      data: {
        base64: logoImage.base64,
        mimeType: logoImage.mimeType,
        s3Key: logoKey,
        metadata: {
          position: branding.position,
        },
      },
    }
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase, settings } = context
    const branding = settings.branding!

    if (phase === 'background-generation') {
      return this.contributeToBackgroundGeneration(branding, context)
    }

    if (phase === 'composition') {
      return this.contributeToComposition(branding)
    }

    return {}
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

      referenceImages,

      metadata: {
        position,
        hasLogo: true,
        logoKey: branding.logoKey,
        logoAssetId: branding.logoAssetId,
      },
    }
  }

  /**
   * Composition phase contribution
   * Ensures logo is preserved from background image
   */
  private contributeToComposition(
    branding: NonNullable<import('../../branding/types').BrandingSettings>
  ): ElementContribution {
    const position = branding.position || 'background'

    return {
      mustFollow: [
        'Preserve the logo from the background image exactly as it appears',
        'Do not regenerate, redraw, or modify the logo in any way',
        'Maintain logo position, size, colors, and clarity',
        position === 'background'
          ? 'Ensure logo on wall/background remains visible and unobstructed'
          : position === 'elements'
            ? 'Ensure flag/banner with logo remains visible and properly positioned'
            : 'Ensure logo on clothing remains clear and unobstructed',
      ],

      freedom: [
        'Adjust overall lighting to ensure logo is well-lit and clear',
        'Fine-tune contrast if needed to make logo readable',
      ],

      metadata: {
        preserveLogo: true,
        position,
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
