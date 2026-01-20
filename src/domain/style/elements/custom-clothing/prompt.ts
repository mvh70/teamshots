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
  const value = settings.value
  
  // Only build prompt if there's an actual outfit set
  if (!value?.outfitS3Key && !value?.assetId) {
    return ''
  }

  const parts: string[] = []

  // If we have a description, use it as the primary guidance
  if (value.description) {
    parts.push(`The person should be wearing: ${value.description}.`)
  } else if (value.colors) {
    // Otherwise, build description from colors
    const colorParts: string[] = []

    if (value.colors.topLayer) {
      colorParts.push(`a ${value.colors.topLayer} colored outer garment (jacket/blazer/shirt)`)
    }

    if (value.colors.baseLayer) {
      colorParts.push(`with a ${value.colors.baseLayer} colored shirt underneath`)
    }

    if (value.colors.bottom) {
      colorParts.push(`${value.colors.bottom} colored pants/trousers`)
    }

    if (value.colors.shoes) {
      colorParts.push(`${value.colors.shoes} colored shoes`)
    }

    if (colorParts.length > 0) {
      parts.push(`The person should be wearing ${colorParts.join(', ')}.`)
    }
  }

  // Add general guidance for outfit matching
  if (value.assetId || value.outfitS3Key) {
    parts.push(
      'Match the style, fit, and overall appearance of the reference outfit provided.',
      'Pay close attention to collar style, sleeve length, garment fit, and any visible details.',
      'Ensure the clothing looks natural and professional.'
    )
  }

  return parts.join(' ')
}
