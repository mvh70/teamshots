/**
 * Clothing Element
 *
 * Contributes standard clothing/wardrobe rules to person generation.
 * Handles business, startup, and black-tie styles with various details.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import { generateWardrobePrompt } from '../../clothing/prompt'

export class ClothingElement extends StyleElement {
  readonly id = 'clothing'
  readonly name = 'Clothing'
  readonly description = 'Standard clothing and wardrobe styles'

  // Clothing only affects person generation, not backgrounds
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no clothing configured
    if (!settings.clothing) {
      return false
    }

    // Skip if user-choice (no specific style selected)
    if (settings.clothing.style === 'user-choice') {
      return false
    }

    // Only contribute to person generation
    return phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const clothing = settings.clothing!

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      style: clothing.style,
      details: clothing.details,
    }

    // Generate wardrobe prompt result for payload
    const wardrobeResult = generateWardrobePrompt({
      clothing: settings.clothing,
      clothingColors: settings.clothingColors,
      shotType: settings.shotType?.type,
    })

    // Build payload structure with wardrobe data
    // IMPORTANT: This includes style_key and detail_key that BrandingElement depends on!
    const payload = {
      subject: {
        wardrobe: wardrobeResult.wardrobe,
      },
    }

    // Note: Specific clothing details (style, base_layer, outer_layer, details) are in the JSON payload
    // Only add critical quality rules that aren't obvious from the JSON structure

    // Normalize style for metadata
    const style = clothing.style?.toLowerCase() || 'startup'
    metadata.style = style

    // Add general clothing quality rules (not specific to any style)
    mustFollow.push(
      'Clothing must fit the person naturally and appropriately',
      'All garments must be worn correctly and neatly',
      'No clothing should appear distorted or unrealistic'
    )

    return {
      instructions,
      mustFollow,
      payload,
      metadata,
    }
  }

  /**
   * Validate clothing settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const clothing = settings.clothing

    if (!clothing) {
      return errors
    }

    // Validate style is one of the known types
    const validStyles = ['business', 'startup', 'black-tie', 'user-choice']
    if (clothing.style && !validStyles.includes(clothing.style)) {
      errors.push(`Unknown clothing style: ${clothing.style}`)
    }

    return errors
  }

  // Medium priority - clothing is important but works with other elements
  get priority(): number {
    return 50
  }
}

// Export singleton instance
export const clothingElement = new ClothingElement()
export default clothingElement

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Elements self-register on import!
 *
 * When this module is imported, the element automatically registers
 * with the composition registry. No manual registration required!
 */
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(clothingElement)
