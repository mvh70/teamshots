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
 */
export const CLOTHING_ACCESSORIES: Record<string, string[]> = {
  business: ['tie', 'bowtie', 'blazer', 'vest', 'pocket-square', 'cufflinks'],
  startup: ['watch', 'glasses', 'hat'],
  'black-tie': ['bowtie', 'cufflinks', 'pocket-square', 'gloves']
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
