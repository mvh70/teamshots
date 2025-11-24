export type BackgroundEnvironment = 'studio' | 'outdoor' | 'indoor'
export type BackgroundModifier = 'bright' | 'shade' | 'dim' | 'overcast' | 'tungsten' | 'fluorescent'

export interface BackgroundSettings {
  type:
    | 'office'
    | 'neutral'
    | 'gradient'
    | 'custom'
    | 'user-choice'
    | 'tropical-beach'
    | 'busy-city'
  key?: string // S3 key for custom uploads (same as selfies)
  prompt?: string // For office/descriptions
  color?: string // Hex color for neutral and gradient backgrounds
  environment?: BackgroundEnvironment // Derived from type
  modifier?: BackgroundModifier // Optional lighting/environment modifier
}

