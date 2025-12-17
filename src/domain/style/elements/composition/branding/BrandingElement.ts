/**
 * Branding Element
 *
 * Contributes logo placement and brand color rules to background generation
 * and logo preservation rules to composition.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import {
  BACKGROUND_BRANDING_PROMPT,
  ELEMENT_BRANDING_PROMPT,
  CLOTHING_BRANDING_RULES_BASE,
} from '../../branding/config'

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

    return {
      instructions: [
        typeof promptConfig.logo_source === 'string' ? promptConfig.logo_source : '',
        typeof promptConfig.placement === 'string' ? promptConfig.placement : '',
      ].filter(Boolean),

      mustFollow: Array.isArray(promptConfig.rules)
        ? promptConfig.rules.map((rule) => String(rule))
        : [],

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
