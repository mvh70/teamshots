/**
 * Clothing Colors Element
 *
 * Contributes color palette specifications for clothing layers to person generation.
 * Handles topBase, topCover, bottom, and shoes colors with shot-type awareness.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import type { ShotTypeValue } from '@/types/photo-style'

export class ClothingColorsElement extends StyleElement {
  readonly id = 'clothing-colors'
  readonly name = 'Clothing Colors'
  readonly description = 'Color specifications for clothing layers'

  // Clothing colors only affect person generation
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no clothing colors configured
    if (!settings.clothingColors || !settings.clothingColors.colors) {
      return false
    }

    // Only contribute to person generation
    return phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const colors = settings.clothingColors!.colors!
    const shotType = settings.shotType?.type as ShotTypeValue

    const instructions: string[] = []
    const mustFollow: string[] = []
    const colorPalette: string[] = []

    const metadata: Record<string, unknown> = {
      colors: { ...colors },
    }

    // Determine visibility based on shot type
    const isFullBody = this.isFullBodyVisible(shotType)
    const isBottomVisible = this.isBottomVisible(shotType)

    // Base layer (shirt under hoodie, dress shirt under blazer)
    if (colors.topBase) {
      colorPalette.push(`base layer (e.g., shirt under hoodie, dress shirt under blazer): ${colors.topBase} color`)
      instructions.push(`Base layer garment should be ${colors.topBase} in color`)
      mustFollow.push(`Base layer must be ${colors.topBase}`)
    }

    // Top cover/outer layer (depends on clothing type)
    if (colors.topCover) {
      const clothing = settings.clothing
      const detail = clothing?.details?.toLowerCase() || ''

      // Check if this is a single-layer garment (hoodie, t-shirt, etc.)
      const isSingleLayer = detail.includes('hoodie') ||
                           detail.includes('t-shirt') ||
                           detail.includes('polo') ||
                           detail.includes('dress')

      if (isSingleLayer) {
        colorPalette.push(`${detail || 'main garment'} (the main visible garment): ${colors.topCover} color`)
        instructions.push(`Main visible garment should be ${colors.topCover} in color`)
        mustFollow.push(`Main garment must be ${colors.topCover}`)
      } else {
        // Multi-layer outfit (jacket, blazer, etc.)
        colorPalette.push(`outer layer (e.g., suit jacket, blazer, cardigan): ${colors.topCover} color`)
        instructions.push(`Outer layer should be ${colors.topCover} in color`)
        mustFollow.push(`Outer layer must be ${colors.topCover}`)
      }
    }

    // Bottom garment (only if visible in shot)
    if (colors.bottom && isBottomVisible) {
      colorPalette.push(`bottom garment (trousers, skirt, dress pants): ${colors.bottom} color`)
      instructions.push(`Bottom garment should be ${colors.bottom} in color`)
      mustFollow.push(`Bottom garment must be ${colors.bottom}`)
    } else if (colors.bottom && !isBottomVisible) {
      // Log that bottom color is specified but won't be visible
      metadata.bottomColorNotVisible = true
    }

    // Shoes (only if visible in full-body shot)
    if (colors.shoes && isFullBody) {
      colorPalette.push(`shoes (dress shoes, loafers, heels): ${colors.shoes} color`)
      instructions.push(`Shoes should be ${colors.shoes} in color`)
      mustFollow.push(`Shoes must be ${colors.shoes}`)
    } else if (colors.shoes && !isFullBody) {
      // Log that shoes color is specified but won't be visible
      metadata.shoesColorNotVisible = true
    }

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
   * Helper: Check if shot type shows bottom garments
   */
  private isBottomVisible(shotType?: ShotTypeValue): boolean {
    return this.isFullBodyVisible(shotType) ||
           shotType === 'midchest' ||
           shotType === 'three-quarter'
  }

  /**
   * Validate clothing colors settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const clothingColors = settings.clothingColors

    if (!clothingColors || !clothingColors.colors) {
      return errors
    }

    const colors = clothingColors.colors

    // At least one color should be specified
    if (!colors.topBase && !colors.topCover && !colors.bottom && !colors.shoes) {
      errors.push('At least one clothing color must be specified')
    }

    // Validate color format (basic check for hex colors or color names)
    const validateColor = (color: string, name: string) => {
      if (!color) return
      // Accept hex colors or common color names
      const isHex = /^#[0-9A-F]{6}$/i.test(color)
      const isColorName = color.length > 0 && /^[a-z\s-]+$/i.test(color)
      if (!isHex && !isColorName) {
        errors.push(`Invalid ${name} color format: ${color}`)
      }
    }

    validateColor(colors.topBase!, 'topBase')
    validateColor(colors.topCover!, 'topCover')
    validateColor(colors.bottom!, 'bottom')
    validateColor(colors.shoes!, 'shoes')

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
