import type { ElementSetting } from '../base/element-types'

export type BackgroundEnvironment = 'studio' | 'outdoor' | 'indoor'

/**
 * Available background types
 */
export type BackgroundType =
  // User-selectable backgrounds (headshot1, freepackage, outfit1)
  | 'office'
  | 'neutral'
  | 'gradient'
  | 'custom'
  | 'tropical-beach'
  | 'busy-city'
  // Standard-shots preset backgrounds
  | 'cafe'
  | 'outdoor'
  | 'solid'
  | 'urban'
  | 'stage'
  | 'dark_studio'
  | 'team_bright'
  | 'lifestyle'

/**
 * Background value - the actual background configuration (no 'user-choice')
 */
export interface BackgroundValue {
  type: BackgroundType
  key?: string // Legacy: S3 key for custom uploads - prefer assetId
  assetId?: string // Preferred: Asset ID for custom uploads
  prompt?: string // For office/descriptions
  color?: string // Hex color for neutral, gradient, solid, dark_studio, team_bright backgrounds
  modifier?: string // Lighting/environment modifier (e.g. 'bright', 'shade', 'dim', 'overcast', 'tungsten', 'fluorescent') — used by camera-settings and lighting derive
}

/**
 * Background settings with mode wrapper
 */
export type BackgroundSettings = ElementSetting<BackgroundValue>
