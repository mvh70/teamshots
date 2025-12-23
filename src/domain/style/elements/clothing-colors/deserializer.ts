import type { PhotoStyleSettings } from '@/types/photo-style'

export function deserialize(
  raw: Record<string, unknown>,
  defaults?: PhotoStyleSettings['clothingColors']
): PhotoStyleSettings['clothingColors'] {
  const rawClothingColors = raw.clothingColors as PhotoStyleSettings['clothingColors'] | null | undefined

  // Fallback default colors if defaults is not provided or doesn't have the expected structure
  const fallbackColors = {
    baseLayer: defaults?.type === 'predefined' && defaults.colors?.baseLayer ? defaults.colors.baseLayer : 'white',
    topLayer: defaults?.type === 'predefined' && defaults.colors?.topLayer ? defaults.colors.topLayer : 'navy'
  }

  if (rawClothingColors === null || rawClothingColors === undefined || !('clothingColors' in raw)) {
    return { type: 'user-choice' }
  }

  // Helper to get color with backward compatibility for old field names
  const getColorValue = (colors: any, newField: string, oldField?: string): string | undefined => {
    return colors?.[newField] || (oldField ? colors?.[oldField] : undefined)
  }

  if (rawClothingColors.type === 'user-choice') {
    if (rawClothingColors.colors) {
      return {
        type: 'user-choice',
        colors: {
          // Try new field names first, fall back to old field names (topBase → baseLayer, topCover → topLayer)
          baseLayer: getColorValue(rawClothingColors.colors, 'baseLayer', 'topBase'),
          topLayer: getColorValue(rawClothingColors.colors, 'topLayer', 'topCover'),
          bottom: rawClothingColors.colors.bottom,
          shoes: rawClothingColors.colors.shoes
        }
      }
    }
    return {
      type: 'user-choice',
      colors: {
        baseLayer: fallbackColors.baseLayer,
        topLayer: fallbackColors.topLayer
      }
    }
  }

  if (rawClothingColors.type === 'predefined') {
    return {
      type: 'predefined',
      colors: {
        // Try new field names first, fall back to old field names
        baseLayer: getColorValue(rawClothingColors.colors, 'baseLayer', 'topBase') || fallbackColors.baseLayer,
        topLayer: getColorValue(rawClothingColors.colors, 'topLayer', 'topCover') || fallbackColors.topLayer,
        bottom: rawClothingColors.colors?.bottom,
        shoes: rawClothingColors.colors?.shoes
      }
    }
  }

  if (rawClothingColors.colors) {
    return {
      type: 'user-choice',
      colors: {
        // Try new field names first, fall back to old field names
        baseLayer: getColorValue(rawClothingColors.colors, 'baseLayer', 'topBase') || fallbackColors.baseLayer,
        topLayer: getColorValue(rawClothingColors.colors, 'topLayer', 'topCover') || fallbackColors.topLayer,
        bottom: rawClothingColors.colors.bottom,
        shoes: rawClothingColors.colors.shoes
      }
    }
  }

  return { type: 'user-choice' }
}

