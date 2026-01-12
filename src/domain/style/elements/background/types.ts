import type { ElementSetting } from '../base/element-types'

export type BackgroundEnvironment = 'studio' | 'outdoor' | 'indoor'
export type BackgroundModifier = 'bright' | 'shade' | 'dim' | 'overcast' | 'tungsten' | 'fluorescent'

/**
 * Available background types
 */
export type BackgroundType =
  | 'office'
  | 'neutral'
  | 'gradient'
  | 'custom'
  | 'tropical-beach'
  | 'busy-city'

/**
 * Background value - the actual background configuration (no 'user-choice')
 */
export interface BackgroundValue {
  type: BackgroundType
  key?: string // Legacy: S3 key for custom uploads - prefer assetId
  assetId?: string // Preferred: Asset ID for custom uploads
  prompt?: string // For office/descriptions
  color?: string // Hex color for neutral and gradient backgrounds
  environment?: BackgroundEnvironment // Derived from type
  modifier?: BackgroundModifier // Optional lighting/environment modifier
}

/**
 * Background settings with mode wrapper
 */
export type BackgroundSettings = ElementSetting<BackgroundValue>

/**
 * Legacy format for migration support
 * @deprecated Use BackgroundSettings instead
 */
export interface LegacyBackgroundSettings {
  type:
    | 'office'
    | 'neutral'
    | 'gradient'
    | 'custom'
    | 'user-choice'
    | 'tropical-beach'
    | 'busy-city'
  key?: string
  assetId?: string
  prompt?: string
  color?: string
  environment?: BackgroundEnvironment
  modifier?: BackgroundModifier
}
