import type { ClothingSettings, ClothingValue, ClothingType } from './types'
import { predefined, userChoice } from '../base/element-types'

/**
 * Legacy clothing settings format (before ElementSetting wrapper)
 */
interface LegacyClothingSettings {
  type?: string
  style: string
  details?: string
  colors?: {
    topLayer?: string
    baseLayer?: string
    bottom?: string
    shoes?: string
  }
  accessories?: string[]
}

/**
 * Extract ClothingValue from legacy format
 */
function extractClothingValue(legacy: LegacyClothingSettings): ClothingValue {
  const style = (legacy.style || 'business') as ClothingType
  return {
    type: legacy.type as ClothingType | undefined,
    style,
    details: legacy.details,
    colors: legacy.colors,
    accessories: legacy.accessories
  }
}

/**
 * Deserializes clothing settings from raw data
 * Supports both legacy format and new ElementSetting wrapper format
 */
export function deserialize(
  raw: Record<string, unknown>,
  defaults?: ClothingSettings
): ClothingSettings {
  const rawClothing = raw.clothing

  if (!rawClothing || typeof rawClothing !== 'object') {
    return defaults || userChoice()
  }

  const clothingObj = rawClothing as Record<string, unknown>

  // Detect new format (has 'mode' field)
  if ('mode' in clothingObj && typeof clothingObj.mode === 'string') {
    const mode = clothingObj.mode as 'predefined' | 'user-choice'
    const value = clothingObj.value as ClothingValue | undefined
    return { mode, value }
  }

  // Legacy format detection
  const legacy = clothingObj as unknown as LegacyClothingSettings

  // Check if it's user-choice in legacy format
  if (legacy.style === 'user-choice' || legacy.type === 'user-choice') {
    return userChoice()
  }

  // Convert legacy format to new format
  return predefined(extractClothingValue(legacy))
}

