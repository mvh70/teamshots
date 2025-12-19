/**
 * Clothing Element
 *
 * Contributes standard clothing/wardrobe rules to person generation.
 * Handles business, startup, and black-tie styles with various details.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'

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

    // Normalize style
    const style = clothing.style?.toLowerCase() || 'startup'

    // Generate style-specific instructions
    if (style === 'business') {
      instructions.push(
        'Dress the person in polished business attire',
        'Clothing should be corporate-appropriate and professional',
        'Base layer should be a crisp dress shirt'
      )
      mustFollow.push(
        'Attire must be suitable for a corporate business environment',
        'Clothing must appear neat, pressed, and well-maintained'
      )

      // Add detail-specific guidance
      if (clothing.details) {
        const detail = clothing.details.toLowerCase()
        if (detail.includes('blazer') || detail.includes('suit')) {
          instructions.push('Include a tailored blazer or suit jacket worn neatly')
          metadata.outerLayer = 'blazer'
        }
        if (detail.includes('tie')) {
          instructions.push('Include a professional necktie')
          metadata.accessories = ['tie']
        }
      }
    } else if (style === 'startup') {
      instructions.push(
        'Dress the person in relaxed startup-style wardrobe',
        'Clothing should be casual but professional',
        'Base should be clean and suitable for logo placement'
      )
      mustFollow.push(
        'Attire must balance casual comfort with professional presentation',
        'Clothing should look modern and tech-appropriate'
      )

      // Add detail-specific guidance
      if (clothing.details) {
        const detail = clothing.details.toLowerCase()
        if (detail.includes('hoodie')) {
          instructions.push('Dress in a modern hoodie as the main garment')
          metadata.topGarment = 'hoodie'
        }
        if (detail.includes('polo')) {
          instructions.push('Dress in a polo shirt')
          metadata.topGarment = 'polo'
        }
      }
    } else if (style === 'black-tie') {
      instructions.push(
        'Dress the person in refined black-tie formalwear',
        'Clothing should be elegant and suitable for upscale evening events',
        'Garments should have a sophisticated, formal aesthetic'
      )
      mustFollow.push(
        'Attire must be appropriate for black-tie/formal evening events',
        'Clothing must appear elegant and high-end'
      )
    }

    // Handle accessories if specified
    if (clothing.accessories && Array.isArray(clothing.accessories) && clothing.accessories.length > 0) {
      instructions.push(
        `Include the following accessories: ${clothing.accessories.join(', ')}`
      )
      mustFollow.push(
        'All specified accessories must be present and visible',
        'Accessories should complement the overall outfit'
      )
      metadata.accessories = clothing.accessories
    }

    // Add general clothing rules
    mustFollow.push(
      'Clothing must fit the person naturally and appropriately',
      'All garments must be worn correctly and neatly',
      'No clothing should appear distorted or unrealistic'
    )

    return {
      instructions,
      mustFollow,
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
