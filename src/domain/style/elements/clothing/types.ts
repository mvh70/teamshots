import type { ElementSetting } from '../base/element-types'

/**
 * Known clothing style types (without 'user-choice')
 */
export type ClothingType = 'business' | 'startup' | 'black-tie'

/**
 * Clothing value without mode information
 */
export interface ClothingValue {
  type?: ClothingType
  style: ClothingType
  details?: string // Style-specific detail (e.g., 'formal', 'casual', 't-shirt', 'hoodie', 'tuxedo', 'suit')
  colors?: {
    topLayer?: string // Outer layer color (blazer, jacket, etc.)
    baseLayer?: string // Base layer color (shirt, t-shirt, etc.)
    bottom?: string // Bottom color (pants, skirt, etc.)
    shoes?: string // Shoes color
  }
  accessories?: string[] // Style-dependent accessories
}

/**
 * Clothing settings with mode wrapper
 * - mode: 'predefined' means admin has set a specific clothing style
 * - mode: 'user-choice' means the user can choose their clothing style
 */
export type ClothingSettings = ElementSetting<ClothingValue>

