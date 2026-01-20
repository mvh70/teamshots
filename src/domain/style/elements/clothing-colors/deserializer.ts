import type { ClothingColorSettings, ClothingColorValue, LegacyClothingColorSettings } from './types'
import { predefined, userChoice } from '../base/element-types'

/**
 * Helper to get color with backward compatibility for old field names
 */
function getColorValue(colors: Record<string, unknown> | undefined, newField: string, oldField?: string): string | undefined {
  if (!colors) return undefined
  return (colors[newField] as string | undefined) || (oldField ? colors[oldField] as string | undefined : undefined)
}

/**
 * Extract ClothingColorValue from raw colors object
 */
function extractColorValue(colors: Record<string, unknown> | undefined, fallback: ClothingColorValue): ClothingColorValue {
  if (!colors) return fallback
  return {
    baseLayer: getColorValue(colors, 'baseLayer', 'topBase') || fallback.baseLayer,
    topLayer: getColorValue(colors, 'topLayer', 'topCover') || fallback.topLayer,
    bottom: colors.bottom as string | undefined,
    shoes: colors.shoes as string | undefined
  }
}

export function deserialize(
  raw: Record<string, unknown>,
  defaults?: ClothingColorSettings
): ClothingColorSettings {
  const rawClothingColors = raw.clothingColors

  // Fallback default colors
  const fallbackColors: ClothingColorValue = {
    baseLayer: defaults?.value?.baseLayer || 'white',
    topLayer: defaults?.value?.topLayer || 'navy'
  }

  if (rawClothingColors === null || rawClothingColors === undefined || !('clothingColors' in raw)) {
    // If clothingColors is not present in settings, use defaults if provided
    // This ensures admin-preset packages don't show clothingColors as user-editable
    return defaults || userChoice()
  }

  const colorsObj = rawClothingColors as Record<string, unknown>

  // Detect new format (has 'mode' field)
  if ('mode' in colorsObj && typeof colorsObj.mode === 'string') {
    const mode = colorsObj.mode as 'predefined' | 'user-choice'
    const value = colorsObj.value as ClothingColorValue | undefined
    return { mode, value }
  }

  // Legacy format detection
  const legacy = colorsObj as unknown as LegacyClothingColorSettings

  if (legacy.type === 'user-choice') {
    if (legacy.colors) {
      return userChoice(extractColorValue(legacy.colors as Record<string, unknown>, fallbackColors))
    }
    return userChoice(fallbackColors)
  }

  if (legacy.type === 'predefined') {
    return predefined(extractColorValue(legacy.colors as Record<string, unknown>, fallbackColors))
  }

  // If has colors but no type, treat as user-choice with colors
  if (legacy.colors) {
    return userChoice(extractColorValue(legacy.colors as Record<string, unknown>, fallbackColors))
  }

  return userChoice()
}

