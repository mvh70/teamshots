/**
 * Custom Clothing Element
 *
 * Contributes custom outfit reference and color matching rules to person generation.
 * Handles garment collage references for outfit transfer.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'

export class CustomClothingElement extends StyleElement {
  readonly id = 'custom-clothing'
  readonly name = 'Custom Clothing'
  readonly description = 'Custom outfit reference and color matching for outfit transfer'

  // Clothing only affects person generation, not backgrounds
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no custom clothing configured
    if (!settings.customClothing) {
      return false
    }

    // Skip if no asset or outfit key
    if (!settings.customClothing.assetId && !settings.customClothing.outfitS3Key) {
      return false
    }

    // Only contribute to person generation
    return phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const clothing = settings.customClothing!

    // Instructions for wearing the custom clothing
    const instructions = [
      'The person must wear the exact clothing items shown in the garment collage reference image',
      'Match all visible clothing details: style, fit, patterns, and textures',
      'Ensure all garments are worn appropriately and naturally',
    ]

    // Strict rules for clothing matching
    const mustFollow = [
      'All garments from the collage must be present and visible on the person',
      'Clothing must fit naturally on the person\'s body',
      'No duplicate accessories - only include items from collage once',
      'Maintain clothing colors as specified in the reference',
      'Do not add clothing items that are not in the reference',
    ]

    // Build metadata with clothing information
    const metadata: Record<string, unknown> = {
      hasCustomClothing: true,
      assetId: clothing.assetId,
      outfitS3Key: clothing.outfitS3Key,
    }

    // Include color information if available
    if (clothing.colors) {
      metadata.clothingColors = clothing.colors
      instructions.push(
        'Reference the clothing colors data provided in metadata for accurate color matching'
      )
    }

    // Include description if available
    if (clothing.description) {
      metadata.description = clothing.description
    }

    return {
      instructions,
      mustFollow,
      metadata,
    }
  }

  /**
   * Validate custom clothing settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const clothing = settings.customClothing

    if (!clothing) {
      return errors
    }

    // Must have either assetId or outfitS3Key
    if (!clothing.assetId && !clothing.outfitS3Key) {
      errors.push('Custom clothing requires either assetId or outfitS3Key')
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
