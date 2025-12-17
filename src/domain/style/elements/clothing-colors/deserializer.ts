import type { PhotoStyleSettings } from '@/types/photo-style'

export function deserialize(
  raw: Record<string, unknown>,
  defaults?: PhotoStyleSettings['clothingColors']
): PhotoStyleSettings['clothingColors'] {
  const rawClothingColors = raw.clothingColors as PhotoStyleSettings['clothingColors'] | null | undefined

  // Fallback default colors if defaults is not provided or doesn't have the expected structure
  const fallbackColors = {
    topBase: defaults?.type === 'predefined' && defaults.colors?.topBase ? defaults.colors.topBase : 'white',
    topCover: defaults?.type === 'predefined' && defaults.colors?.topCover ? defaults.colors.topCover : 'navy'
  }

  if (rawClothingColors === null || rawClothingColors === undefined || !('clothingColors' in raw)) {
    return { type: 'user-choice' }
  }

  if (rawClothingColors.type === 'user-choice') {
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

  if (rawClothingColors.type === 'predefined') {
    return {
      type: 'predefined',
      colors: {
        topBase: rawClothingColors.colors?.topBase || fallbackColors.topBase,
        topCover: rawClothingColors.colors?.topCover || fallbackColors.topCover,
        bottom: rawClothingColors.colors?.bottom,
        shoes: rawClothingColors.colors?.shoes
      }
    }
  }

  if (rawClothingColors.colors) {
    return {
      type: 'user-choice',
      colors: {
        topBase: rawClothingColors.colors.topBase || fallbackColors.topBase,
        topCover: rawClothingColors.colors.topCover || fallbackColors.topCover,
        bottom: rawClothingColors.colors.bottom,
        shoes: rawClothingColors.colors.shoes
      }
    }
  }

  return { type: 'user-choice' }
}

