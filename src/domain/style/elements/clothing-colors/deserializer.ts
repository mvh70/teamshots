import type { PhotoStyleSettings } from '@/types/photo-style'

export function deserialize(
  raw: Record<string, unknown>,
  defaults: { type: 'predefined'; colors: { topBase: string; topCover: string; bottom?: string; shoes?: string } }
): PhotoStyleSettings['clothingColors'] {
  const rawClothingColors = raw.clothingColors as PhotoStyleSettings['clothingColors'] | null | undefined

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
        topBase: rawClothingColors.colors?.topBase || defaults.colors.topBase,
        topCover: rawClothingColors.colors?.topCover || defaults.colors.topCover,
        bottom: rawClothingColors.colors?.bottom,
        shoes: rawClothingColors.colors?.shoes
      }
    }
  }

  if (rawClothingColors.colors) {
    return {
      type: 'user-choice',
      colors: {
        topBase: rawClothingColors.colors.topBase || defaults.colors.topBase,
        topCover: rawClothingColors.colors.topCover || defaults.colors.topCover,
        bottom: rawClothingColors.colors.bottom,
        shoes: rawClothingColors.colors.shoes
      }
    }
  }

  return { type: 'user-choice' }
}

