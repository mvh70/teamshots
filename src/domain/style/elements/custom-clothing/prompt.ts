/**
 * Custom Clothing Prompt Builder
 *
 * Builds outfit-specific prompt text for AI generation
 */

import { CustomClothingSettings } from './types'

/**
 * Build prompt text for custom clothing
 */
export function buildCustomClothingPrompt(settings: CustomClothingSettings): string {
  // Only build prompt if there's an actual outfit set
  if (!settings.outfitS3Key && !settings.assetId) {
    return ''
  }

  const parts: string[] = []

  // If we have a description, use it as the primary guidance
  if (settings.description) {
    parts.push(`The person should be wearing: ${settings.description}.`)
  } else if (settings.colors) {
    // Otherwise, build description from colors
    const colorParts: string[] = []

    if (settings.colors.topBase) {
      colorParts.push(`a ${settings.colors.topBase} colored shirt/top`)
    }

    if (settings.colors.topCover) {
      colorParts.push(`with a ${settings.colors.topCover} colored jacket/blazer over it`)
    }

    if (settings.colors.bottom) {
      colorParts.push(`${settings.colors.bottom} colored pants/trousers`)
    }

    if (settings.colors.shoes) {
      colorParts.push(`${settings.colors.shoes} colored shoes`)
    }

    if (colorParts.length > 0) {
      parts.push(`The person should be wearing ${colorParts.join(', ')}.`)
    }
  }

  // Add general guidance for outfit matching
  if (settings.assetId || settings.outfitS3Key) {
    parts.push(
      'Match the style, fit, and overall appearance of the reference outfit provided.',
      'Pay close attention to collar style, sleeve length, garment fit, and any visible details.',
      'Ensure the clothing looks natural and professional.'
    )
  }

  return parts.join(' ')
}
