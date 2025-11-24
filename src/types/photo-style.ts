// Photo Style Settings Types
// This defines the structure of the JSON settings stored in the Context model

import type {
  ArmPositionSetting,
  BodyAngleSetting,
  HeadPositionSetting,
  PoseSettings,
  ShoulderPositionSetting,
  SittingPoseSetting,
  WeightDistributionSetting
} from '../domain/style/elements/pose/types'
import type { ClothingSettings } from '../domain/style/elements/clothing/types'
import type { ExpressionSettings } from '../domain/style/elements/expression/types'
import type {
  ShotTypeSettings,
  ShotTypeValue
} from '../domain/style/elements/shot-type/types'
import type { BrandingSettings } from '../domain/style/elements/branding/types'
import type { ClothingColorSettings } from '../domain/style/elements/clothing-colors/types'
import type { BackgroundSettings } from '../domain/style/elements/background/types'

export {
  ArmPositionSetting,
  BodyAngleSetting,
  HeadPositionSetting,
  PoseSettings,
  ShoulderPositionSetting,
  SittingPoseSetting,
  WeightDistributionSetting
}
export { ClothingSettings }
export { ExpressionSettings }
export {
  ShotTypeSettings,
  ShotTypeValue
}
export { BrandingSettings }
export { ClothingColorSettings }
export { BackgroundSettings }

export interface StyleSettings {
  type: 'preset' | 'user-choice'
  preset?: 'corporate' | 'casual' | 'creative' | 'modern' | 'classic' | 'artistic'
}

export interface LightingSettings {
  type: 'natural' | 'studio' | 'soft' | 'dramatic' | 'user-choice'
}

export type SubjectCountSetting = '1' | '2-3' | '4-8' | '9+'

export type UsageContextSetting = 'general' | 'social-media'

export interface PhotoStyleSettings {
  presetId?: string
  background?: BackgroundSettings
  branding?: BrandingSettings
  clothing?: ClothingSettings
  clothingColors?: ClothingColorSettings
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
}

// Helper types for form handling
export type CategoryType =
  | 'background'
  | 'branding'
  | 'clothing'
  | 'clothingColors'
  | 'shotType'
  | 'aspectRatio'
  | 'bodyAngle'
  | 'headPosition'
  | 'shoulderPosition'
  | 'weightDistribution'
  | 'armPosition'
  | 'sittingPose'
  | 'style'
  | 'expression'
  | 'lighting'
  | 'pose'

export interface CategoryToggle {
  category: CategoryType
  isPredefined: boolean // true = admin sets it, false = user choice
}

// Default settings for new contexts
export const DEFAULT_PHOTO_STYLE_SETTINGS: PhotoStyleSettings = {
  presetId: undefined,
  background: {
    type: 'user-choice'
  },
  branding: {
    type: 'user-choice',
    position: 'clothing' // Default position when branding is enabled
  },
  clothing: {
    style: 'user-choice'
  },
  clothingColors: {
    type: 'user-choice'
  },
  shotType: {
    type: 'user-choice'
  },
  aspectRatio: '1:1',
  // Camera settings are now calculated dynamically based on scene requirements
  style: {
    type: 'preset',
    preset: 'corporate'
  },
  expression: {
    type: 'user-choice'
  },
  lighting: {
    type: 'user-choice'
  },
  pose: {
    type: 'user-choice'
  },
  subjectCount: '1',
  usageContext: 'general'
}
