import type { ClothingColorKey } from '@/domain/style/elements/clothing-colors/types'
import type { ClothingSettings, ClothingValue } from './types'
export type { ClothingSettings, ClothingValue, ClothingType } from './types'

/**
 * Known clothing style types
 */
export type KnownClothingStyle = 'business' | 'startup' | 'black-tie'

/**
 * Wardrobe detail configuration structure
 * Contains prompt descriptions and UI exclusions
 */
export interface WardrobeDetailConfig {
  details: string
  baseLayer: string
  outerLayer?: string
  notes?: string
  excludeClothingColors?: ClothingColorKey[]
  /**
   * Accessories that are naturally part of this clothing style.
   * These are authorized in the evaluator and won't be rejected as "unauthorized accessories".
   * Example: 'belt' is inherent for business trousers, 'cufflinks' for formal dress shirts.
   */
  inherentAccessories?: string[]
}

/**
 * UI metadata for clothing style selector
 * Icons and colors only - labels and descriptions come from i18n
 */
export const CLOTHING_STYLES = [
  { value: 'business', icon: '💼', color: 'from-blue-600 to-indigo-600' },
  { value: 'startup', icon: '👕', color: 'from-purple-500 to-pink-500' },
  { value: 'black-tie', icon: '🎩', color: 'from-gray-800 to-gray-900' }
] as const

/**
 * UI metadata for clothing detail options per style
 * Values only - labels come from i18n
 */
export const CLOTHING_DETAILS: Record<string, string[]> = {
  business: ['formal', 'casual'],
  startup: ['t-shirt', 'hoodie', 'polo', 'button-down'],
  'black-tie': ['tuxedo', 'suit', 'dress']
}

/**
 * UI metadata for clothing accessories per style
 * Uses compound keys (style-detail) when accessories vary by detail,
 * falls back to style-only key when they don't
 */
export const CLOTHING_ACCESSORIES: Record<string, string[]> = {
  'business-formal': ['tie', 'vest', 'pocket-square'],
  'business-casual': ['vest', 'pocket-square'],
  startup: ['watch', 'glasses', 'hat'],
  'black-tie': ['bowtie', 'cufflinks', 'pocket-square', 'gloves']
}

/**
 * Get accessories for a clothing style/detail combination
 * Tries compound key first, falls back to style-only key
 */
export function getAccessoriesForClothing(style: string, detail?: string): string[] {
  if (detail) {
    const compoundKey = `${style}-${detail}`
    if (CLOTHING_ACCESSORIES[compoundKey]) {
      return CLOTHING_ACCESSORIES[compoundKey]
    }
  }
  return CLOTHING_ACCESSORIES[style] || []
}

import type { ElementConfig } from '../registry'
import { predefined, userChoice, hasValue } from '../base/element-types'
import { deserialize } from './deserializer'

/**
 * Element registry config for clothing
 */
export const clothingElementConfig: ElementConfig<ClothingSettings> = {
  getDefaultPredefined: (packageDefaults) => {
    if (packageDefaults && hasValue(packageDefaults)) {
      return predefined({ ...packageDefaults.value })
    }
    return predefined({ style: 'business' })
  },
  getDefaultUserChoice: () => userChoice(),
  deserialize
}
