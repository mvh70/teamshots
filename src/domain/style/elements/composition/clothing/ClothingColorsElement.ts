/**
 * Clothing Colors Element
 *
 * Contributes color palette specifications for clothing layers to person generation.
 * Handles topLayer, baseLayer, bottom, and shoes colors with shot-type awareness.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import { getColorHex, type ColorValue } from '../../clothing-colors/types'
import { hasValue } from '../../base/element-types'
import type { ShotTypeValue } from '@/types/photo-style'

export class ClothingColorsElement extends StyleElement {
  readonly id = 'clothing-colors'
  readonly name = 'Clothing Colors'
  readonly description = 'Color specifications for clothing layers'

  // Clothing colors only affect person generation
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no clothing colors configured
    if (!settings.clothingColors || !hasValue(settings.clothingColors)) {
      return false
    }

    // Only contribute to person generation
    if (phase !== 'person-generation') {
      return false
    }

    // CRITICAL: Skip if ClothingOverlayElement is handling clothing
    // (branding on clothing means overlay with colors is active)
    if (
      hasValue(settings.branding) &&
      settings.branding.value.type === 'include' &&
      settings.branding.value.position === 'clothing'
    ) {
      return false // ClothingOverlayElement has colors baked in
    }

    return true
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings, existingContributions } = context
    const colors = settings.clothingColors!.value!
    const shotType = hasValue(settings.shotType) ? settings.shotType.value.type as ShotTypeValue : undefined

    const instructions: string[] = []
    const mustFollow: string[] = []
    const colorPalette: string[] = []

    const metadata: Record<string, unknown> = {
      colors: { ...colors },
    }

    // Check if colors are from outfit reference image
    // If so, skip color specifications and let AI match the reference exactly
    if (colors.source === 'outfit') {
      return {
        instructions: [],
        mustFollow: [
          'Use the exact clothing colors shown in the outfit reference image',
          'Do not modify or reinterpret the colors - match the reference exactly'
        ],
        metadata: {
          ...metadata,
          colorsFromOutfit: true,
          skipColorSpecifications: true,
        },
      }
    }

    // CRITICAL: Check if ClothingOverlayElement is handling clothing
    // If overlay exists, it already has colors baked in
    const hasClothingOverlay = existingContributions.some(
      c => c.metadata?.hasClothingOverlay === true
    )

    if (hasClothingOverlay) {
      // ClothingOverlayElement has colors already applied - skip color specifications
      return {
        instructions: [],
        mustFollow: [
          'Use the exact clothing colors shown in the clothing overlay reference image',
          'Do not modify or reinterpret the colors - they are already correct'
        ],
        metadata,
      }
    }

    // Normal flow: no overlay, provide color specifications
    // Determine visibility based on shot type
    const isFullBody = this.isFullBodyVisible(shotType)
    const isBottomVisible = this.isBottomVisible(shotType)
    const mayPartiallyShowBottom = this.mayPartiallyShowBottom(shotType)

    // Determine garment structure
    const clothing = settings.clothing
    const detail = clothing?.value?.details?.toLowerCase() || ''

    // Check if this is a single-layer garment (polo, hoodie, t-shirt, dress, gown, jumpsuit)
    // These garments are worn alone without a visible base layer underneath
    // NOTE: button-down is NOT included because it's worn open with a t-shirt base layer
    const isSingleLayer = detail.includes('polo') ||
                         detail.includes('hoodie') ||
                         detail.includes('t-shirt') ||
                         detail.includes('dress') ||
                         detail.includes('gown') ||
                         detail.includes('jumpsuit')

    if (isSingleLayer) {
      // Single-layer garments: the garment itself is the top layer
      if (colors.topLayer) {
        colorPalette.push(`${detail || 'main garment'} (the main visible garment): ${getColorHex(colors.topLayer)} color`)
      }
    } else {
      // Multi-layer garments: topLayer is the outer garment (jacket, blazer), baseLayer is the shirt underneath
      if (colors.topLayer) {
        colorPalette.push(`top layer (e.g., suit jacket, blazer, cardigan): ${getColorHex(colors.topLayer)} color`)
      }
      if (colors.baseLayer) {
        colorPalette.push(`base layer (e.g., shirt under jacket, dress shirt under blazer): ${getColorHex(colors.baseLayer)} color`)
      }
    }

    // Bottom garment handling based on shot type visibility
    if (colors.bottom && isBottomVisible) {
      // Fully visible - include color as primary specification
      colorPalette.push(`bottom garment (trousers, skirt, dress pants): ${getColorHex(colors.bottom)} color`)
    } else if (colors.bottom && mayPartiallyShowBottom) {
      // Edge case: shot cuts near waistline - bottom may be partially visible
      // Include color as fallback to ensure consistency if AI shows any trousers
      colorPalette.push(`bottom garment if partially visible (trousers, skirt): ${getColorHex(colors.bottom)} color`)
      metadata.bottomColorPartiallyVisible = true
      // Also add a must-follow rule to ensure color consistency
      mustFollow.push(
        `If any bottom garment (trousers, skirt) is partially visible at the waistline, it MUST be ${getColorHex(colors.bottom)} color - do not use a random color`
      )
    } else if (colors.bottom) {
      // Not expected to be visible at all
      metadata.bottomColorNotVisible = true
    }

    // Shoes (only if visible in full-body shot)
    if (colors.shoes && isFullBody) {
      colorPalette.push(`shoes (dress shoes, loafers, heels): ${getColorHex(colors.shoes)} color`)
    } else if (colors.shoes && !isFullBody) {
      // Log that shoes color is specified but won't be visible
      metadata.shoesColorNotVisible = true
    }

    // Note: Specific color values are in the JSON payload color_palette
    // No need to repeat them in instructions or mustFollow

    // Add general color matching instructions
    if (colorPalette.length > 0) {
      instructions.push(
        'Match all clothing colors exactly as specified',
        'Colors should appear natural under the lighting conditions'
      )
      mustFollow.push(
        'All visible clothing layers must match the specified colors',
        'Colors should be accurate and true to the specifications'
      )

      metadata.colorPalette = colorPalette
    }

    return {
      instructions,
      mustFollow,
      metadata,
    }
  }

  /**
   * Helper: Check if shot type shows full body
   */
  private isFullBodyVisible(shotType?: ShotTypeValue): boolean {
    return shotType === 'full-body' ||
           shotType === 'full-length' ||
           shotType === 'wide-shot'
  }

  /**
   * Helper: Check if shot type shows bottom garments fully
   */
  private isBottomVisible(shotType?: ShotTypeValue): boolean {
    return this.isFullBodyVisible(shotType) ||
           shotType === 'midchest' ||
           shotType === 'three-quarter'
  }

  /**
   * Helper: Check if shot type may partially show bottom garments
   * These are "edge case" shots where the frame cuts near the waistline,
   * so trousers/skirts might be partially visible even though not intended.
   * We include the bottom color for these to ensure consistency if the AI
   * slightly deviates from the framing.
   */
  private mayPartiallyShowBottom(shotType?: ShotTypeValue): boolean {
    return shotType === 'medium-shot' // Waist-level cut - trousers may be partially visible
  }

  /**
   * Validate clothing colors settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const clothingColors = settings.clothingColors

    if (!clothingColors || !hasValue(clothingColors)) {
      return errors
    }

    const colors = clothingColors.value

    // At least one color should be specified
    if (!colors.topLayer && !colors.baseLayer && !colors.bottom && !colors.shoes) {
      errors.push('At least one clothing color must be specified')
    }

    // Validate color format (basic check for hex colors or color names)
    const validateColor = (color: string | ColorValue | undefined, name: string) => {
      if (!color) return
      const hex = getColorHex(color)
      if (!hex) return
      // Accept hex colors or common color names
      const isHex = /^#[0-9A-F]{6}$/i.test(hex)
      const isColorName = hex.length > 0 && /^[a-z\s-]+$/i.test(hex)
      if (!isHex && !isColorName) {
        errors.push(`Invalid ${name} color format: ${hex}`)
      }
    }

    validateColor(colors.topLayer, 'topLayer')
    validateColor(colors.baseLayer, 'baseLayer')
    validateColor(colors.bottom, 'bottom')
    validateColor(colors.shoes, 'shoes')

    return errors
  }

  // High priority - colors should be applied after clothing style is determined
  get priority(): number {
    return 55
  }
}

// Export singleton instance
export const clothingColorsElement = new ClothingColorsElement()
export default clothingColorsElement

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Elements self-register on import!
 *
 * When this module is imported, the element automatically registers
 * with the composition registry. No manual registration required!
 */
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(clothingColorsElement)
