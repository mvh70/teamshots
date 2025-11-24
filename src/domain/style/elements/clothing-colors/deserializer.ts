import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Deserializes clothing colors settings from raw data
 */
export function deserialize(
  raw: Record<string, unknown>,
  defaults: { type: 'predefined'; colors: { topBase: string; topCover: string; bottom?: string; shoes?: string } }
): PhotoStyleSettings['clothingColors'] {
  const rawClothingColors = raw.clothingColors as PhotoStyleSettings['clothingColors'] | null | undefined
  
  if (rawClothingColors === null || rawClothingColors === undefined || !('clothingColors' in raw)) {
    return { type: 'user-choice' }
  }
  
  if (rawClothingColors.type === 'user-choice') {
    // Preserve colors if they exist in the user-choice object
    if (rawClothingColors.colors) {
      return { 
        type: 'user-choice',
        colors: {
          topBase: rawClothingColors.colors.topBase,
          topCover: rawClothingColors.colors.topCover,
          bottom: rawClothingColors.colors.bottom,
          shoes: rawClothingColors.colors.shoes
        }
      }
    }
    return { type: 'user-choice' }
  }
  
  return {
    type: 'predefined',
    colors: {
      topBase: rawClothingColors.colors?.topBase || defaults.colors.topBase,
      topCover: rawClothingColors.colors?.topCover || defaults.colors.topCover,
      bottom: rawClothingColors.colors?.bottom,
      shoes: rawClothingColors.colors?.shoes
    }
  }
}

