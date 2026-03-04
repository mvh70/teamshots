/**
 * Clothing Element
 *
 * Contributes standard clothing/wardrobe rules to person generation.
 * Handles business, startup, and black-tie styles with various details.
 */

import { StyleElement, ElementContext, ElementContribution } from '../base/StyleElement'
import { isUserChoice, hasValue, type ElementSetting } from '../base/element-types'
import { generateWardrobePrompt } from './prompt'
import type { ShotTypeValue } from '@/types/photo-style'
import { autoRegisterElement } from '../composition/registry'
import { getEffectiveClothingDetail } from './config'

export class ClothingElement extends StyleElement {
  readonly id = 'clothing'
  readonly name = 'Clothing'
  readonly description = 'Standard clothing and wardrobe styles'

  // Clothing only affects person generation, not backgrounds
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context
    const clothing = settings.clothing

    // Skip if no clothing configured
    if (!clothing) {
      return false
    }

    // Skip if no value set (regardless of mode - user-choice with value should still contribute)
    if (!hasValue(clothing)) {
      return false
    }

    // Only contribute to person generation
    if (phase !== 'person-generation') {
      return false
    }

    // CRITICAL: Skip if ClothingOverlayElement is handling clothing
    // (branding on clothing means overlay is active)
    if (
      hasValue(settings.branding) &&
      settings.branding.value.type === 'include' &&
      settings.branding.value.position === 'clothing'
    ) {
      return false // ClothingOverlayElement will handle wardrobe
    }

    return true
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings, existingContributions } = context
    const clothing = settings.clothing!
    // At this point, we know clothing has a value (checked in isRelevantForPhase)
    const clothingValue = clothing.value!

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      style: clothingValue.style,
      details: getEffectiveClothingDetail(clothingValue.style, clothingValue),
      mode: clothingValue.mode,
      topChoice: clothingValue.topChoice,
      bottomChoice: clothingValue.bottomChoice,
      outerChoice: clothingValue.outerChoice,
      onePieceChoice: clothingValue.onePieceChoice,
    }

    // CRITICAL: Check if ClothingOverlayElement is handling clothing
    // If overlay exists, it already has wardrobe and colors baked in
    const hasClothingOverlay = existingContributions.some(
      c => c.metadata?.hasClothingOverlay === true
    )

    if (hasClothingOverlay) {
      // ClothingOverlayElement is handling everything - skip wardrobe payload
      // Only add minimal metadata for other elements that might need style info
      return {
        instructions: [],
        mustFollow: [
          'Use the clothing shown in the clothing overlay reference image',
          'The overlay shows the exact garments with correct styling and logo placement'
        ],
        payload: {}, // No wardrobe data - overlay has it all
        metadata,
      }
    }

    // Normal flow: no overlay, provide wardrobe data
    // Generate wardrobe prompt result for payload
    const shotTypeValue = hasValue(settings.shotType) ? settings.shotType.value.type : undefined
    const wardrobeResult = generateWardrobePrompt({
      clothing: clothingValue,
      clothingColors: settings.clothingColors,
      shotType: shotTypeValue,
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
    const style = clothingValue.style?.toLowerCase() || 'business_professional'
    metadata.style = style

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

    // Only validate if there's a value to validate
    // (regardless of mode - user-choice with value should still be validated)
    if (!clothing || !hasValue(clothing)) {
      return errors
    }

    const clothingValue = clothing.value

    // Validate style is one of the known types
    const validStyles = [
      'business_professional',
      'business_casual',
      'startup',
      'black-tie',
      // Legacy values accepted during migration.
      'business',
    ]
    if (clothingValue.style && !validStyles.includes(clothingValue.style)) {
      errors.push(`Unknown clothing style: ${clothingValue.style}`)
    }

    // Style-only presets intentionally leave detailed garment choices for end users.
    if (clothingValue.lockScope !== 'style-only') {
      const mode = clothingValue.mode || 'separate'
      if (mode === 'one_piece') {
        if (!clothingValue.onePieceChoice) {
          errors.push('One-piece clothing mode requires onePieceChoice')
        }
        if (clothingValue.bottomChoice) {
          errors.push('One-piece clothing mode cannot define bottomChoice')
        }
      } else {
        if (!clothingValue.topChoice) {
          errors.push('Separate clothing mode requires topChoice')
        }
        if (!clothingValue.bottomChoice) {
          errors.push('Separate clothing mode requires bottomChoice')
        }
      }
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

autoRegisterElement(clothingElement)
