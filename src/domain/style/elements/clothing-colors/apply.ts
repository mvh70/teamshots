import { PromptBuildContext } from '../../prompt-builders/context-types'
import { buildColorPalette } from './prompt'
import { setPath } from '../../prompt-builders/context'
import { WARDROBE_DETAILS } from '../clothing/config'

/**
 * Apply clothing colors to the generation payload
 *
 * This adds a color palette to the subject's clothing specification.
 * Colors are only applied if clothingColors type is 'predefined' with actual color values.
 */
export function applyToPayload(context: PromptBuildContext): void {
  const { clothingColors, shotType, clothing } = context.settings

  // Skip if no clothing colors specified or user-choice
  if (!clothingColors || clothingColors.type === 'user-choice') {
    return
  }

  // Get clothing detail config (using 'details' not 'detail')
  const detailKey = clothing?.details || 'dress_shirt'
  const style = clothing?.style || 'business'

  // Skip if user-choice (not a known style)
  if (style === 'user-choice') return

  // WARDROBE_DETAILS is keyed by style, then detail
  const styleConfig = WARDROBE_DETAILS[style as 'business' | 'startup' | 'black-tie']
  if (!styleConfig) return

  const descriptor = styleConfig[detailKey]
  if (!descriptor) return

  // Build color palette based on shot type and clothing detail
  const palette = buildColorPalette(
    clothingColors.colors,
    detailKey,
    descriptor,
    shotType?.type
  )

  // Add palette to payload if colors were specified
  if (palette) {
    setPath(context.payload, 'subject.clothing.color_palette', palette)
  }
}
