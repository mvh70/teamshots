// Photo Style Settings Types
// This defines the structure of the JSON settings stored in the Context model

import type { PoseSettings, PoseType, PoseValue } from '../domain/style/elements/pose/types'
import type { ClothingSettings, ClothingType, ClothingValue } from '../domain/style/elements/clothing/types'
import type { ExpressionSettings, ExpressionType, ExpressionValue } from '../domain/style/elements/expression/types'
import type {
  ShotTypeSettings,
  ShotTypeValue
} from '../domain/style/elements/shot-type/types'
import type { BrandingSettings } from '../domain/style/elements/branding/types'
import type { ClothingColorSettings, ClothingColorValue } from '../domain/style/elements/clothing-colors/types'
import type { BackgroundSettings, BackgroundType, BackgroundValue } from '../domain/style/elements/background/types'
import type { CustomClothingSettings } from '../domain/style/elements/custom-clothing/types'
import type { IndustrySettings, IndustryType, IndustryValue } from '../domain/style/elements/industry/types'
import type { FilmTypeSettings, FilmType, FilmTypeValue } from '../domain/style/elements/rendering/film-type/types'

export { PoseSettings, PoseType, PoseValue }
export { ClothingSettings, ClothingType, ClothingValue }
export { ExpressionSettings, ExpressionType, ExpressionValue }
export {
  ShotTypeSettings,
  ShotTypeValue
}
export { BrandingSettings }
export { ClothingColorSettings, ClothingColorValue }
export { BackgroundSettings, BackgroundType, BackgroundValue }
export { CustomClothingSettings }
export { IndustrySettings, IndustryType, IndustryValue }
export { FilmTypeSettings, FilmType, FilmTypeValue }

export interface StyleSettings {
  type: 'preset' | 'user-choice'
  preset?: 'corporate' | 'casual' | 'creative' | 'modern' | 'classic' | 'artistic'
}

// Lighting types that can be selected as a value
export type LightingType = 'natural' | 'studio' | 'soft' | 'dramatic'

// The inner value when a lighting type is selected
export interface LightingValue {
  type: LightingType
}

// Full lighting settings with mode wrapper (matches ElementSetting pattern)
export interface LightingSettings {
  mode: 'predefined' | 'user-choice'
  value?: LightingValue
}

export type SubjectCountSetting = '1' | '2-3' | '4-8' | '9+'

export type UsageContextSetting = 'general' | 'social-media'

export interface PhotoStyleSettings {
  presetId?: string
  background?: BackgroundSettings
  branding?: BrandingSettings
  clothing?: ClothingSettings
  clothingColors?: ClothingColorSettings
  customClothing?: CustomClothingSettings
  shotType?: ShotTypeSettings
  aspectRatio?: string
  // Camera settings (focal length, aperture, ISO, white balance) are now calculated
  // dynamically by the backend based on shot type, subject count, and background
  // Granular pose settings are now nested in 'pose'
  style?: StyleSettings
  expression?: ExpressionSettings
  lighting?: LightingSettings
  pose?: PoseSettings
  subjectCount?: SubjectCountSetting
  usageContext?: UsageContextSetting
  customPrompt?: string
  industry?: IndustrySettings
  filmType?: FilmTypeSettings
  preset?: {
    mode: 'predefined' | 'user-choice'
    value?: { presetId: string }
  }
}

// Helper types for form handling
export type CategoryType =
  | 'background'
  | 'branding'
  | 'clothing'
  | 'clothingColors'
  | 'customClothing'
  | 'shotType'
  | 'aspectRatio'
  | 'style'
  | 'expression'
  | 'lighting'
  | 'pose'
  | 'industry'
  | 'filmType'
  | 'preset'

export interface CategoryToggle {
  category: CategoryType
  isPredefined: boolean // true = admin sets it, false = user choice
}

// Default settings for new contexts
export const DEFAULT_PHOTO_STYLE_SETTINGS: PhotoStyleSettings = {
  presetId: undefined,
  background: {
    mode: 'user-choice',
    value: undefined
  },
  branding: {
    mode: 'user-choice',
    value: undefined
  },
  clothing: {
    mode: 'user-choice',
    value: undefined
  },
  clothingColors: {
    mode: 'user-choice',
    value: undefined
  },
  customClothing: {
    mode: 'predefined',
    value: undefined
  },
  shotType: {
    mode: 'user-choice',
    value: undefined
  },
  aspectRatio: '1:1',
  // Camera settings are now calculated dynamically based on scene requirements
  style: {
    type: 'preset',
    preset: 'corporate'
  },
  expression: {
    mode: 'user-choice',
    value: undefined
  },
  lighting: {
    mode: 'user-choice',
    value: undefined
  },
  pose: {
    mode: 'user-choice',
    value: undefined
  },
  subjectCount: '1',
  usageContext: 'general',
  filmType: {
    mode: 'predefined',
    value: undefined
  }
}
