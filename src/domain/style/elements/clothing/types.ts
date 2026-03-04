import type { ElementSetting } from '../base/element-types'

/**
 * Active clothing styles used by current UI.
 */
export type ClothingStyle = 'business_professional' | 'business_casual' | 'startup' | 'black-tie'

/**
 * Legacy style values that can appear in persisted data.
 */
export type LegacyClothingStyle = 'business' | 'startup'

/**
 * Any style value accepted by deserialization/migration.
 */
export type AnyClothingStyle = ClothingStyle | LegacyClothingStyle

/**
 * Backward-compatible alias used across the codebase.
 */
export type ClothingType = ClothingStyle

export type ClothingDetectedGender = 'male' | 'female' | 'unknown'
export type ClothingMode = 'separate' | 'one_piece'

/**
 * Clothing value without mode information
 */
export interface ClothingValue {
  style: ClothingType
  mode?: ClothingMode
  topChoice?: string
  bottomChoice?: string
  outerChoice?: string
  onePieceChoice?: string
  details?: string // Style-specific detail (e.g., 'formal', 'casual', 't-shirt', 'hoodie', 'tuxedo', 'suit')
  /**
   * Clothing-specific partial lock policy:
   * style is fixed by admin, detail remains user-editable.
   */
  lockScope?: 'style-only'
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
