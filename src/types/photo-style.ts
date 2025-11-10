// Photo Style Settings Types
// This defines the structure of the JSON settings stored in the Context model

export interface BackgroundSettings {
  type: 'office' | 'neutral' | 'gradient' | 'custom' | 'user-choice' | 'tropical-beach' | 'busy-city'
  key?: string // S3 key for custom uploads (same as selfies)
  prompt?: string // For office/descriptions
  color?: string // Hex color for neutral and gradient backgrounds
}

export interface BrandingSettings {
  type: 'include' | 'exclude' | 'user-choice'
  logoKey?: string // S3 key for team logo (same as selfies)
  position?: 'background' | 'clothing' | 'elements'
}

export interface ClothingSettings {
  type?: 'business' | 'startup' | 'black-tie' | 'user-choice'
  style: 'business' | 'startup' | 'black-tie' | 'user-choice'
  details?: string // Style-specific detail (e.g., 'formal', 'casual', 't-shirt', 'hoodie', 'tuxedo', 'suit')
  colors?: {
    topCover?: string // Outer layer color (blazer, jacket, etc.)
    topBase?: string // Base layer color (shirt, t-shirt, etc.)
    bottom?: string // Bottom color (pants, skirt, etc.)
    shoes?: string // Shoes color
  }
  accessories?: string[] // Style-dependent accessories
}

export interface ClothingColorSettings {
  type: 'predefined' | 'user-choice'
  colors?: {
    topCover?: string // Outer layer color (blazer, jacket, etc.)
    topBase?: string // Base layer color (shirt, t-shirt, etc.)
    bottom?: string // Bottom color (pants, skirt, etc.)
    shoes?: string // Shoes color
  }
}

export type ShotTypeValue =
  | 'extreme-close-up'
  | 'close-up'
  | 'medium-close-up'
  | 'medium-shot'
  | 'three-quarter'
  | 'full-length'
  | 'wide-shot'
  | 'headshot'
  | 'midchest'
  | 'full-body'
  | 'user-choice'

export interface ShotTypeSettings {
  type: ShotTypeValue
}

export type FocalLengthSetting =
  | '24mm'
  | '35mm'
  | '50mm'
  | '70mm'
  | '85mm'
  | '105mm'
  | '135mm'
  | '70-200mm'
  | 'user-choice'

export type ApertureSetting =
  | 'f/1.2'
  | 'f/1.4'
  | 'f/1.8'
  | 'f/2.0'
  | 'f/2.8'
  | 'f/4.0'
  | 'f/5.6'
  | 'f/8.0'
  | 'f/11'
  | 'user-choice'

export type LightingQualitySetting =
  | 'soft-diffused'
  | 'hard-direct'
  | 'natural-golden-hour'
  | 'natural-overcast'
  | 'studio-softbox'
  | 'rembrandt'
  | 'butterfly'
  | 'split'
  | 'rim-backlight'
  | 'loop'
  | 'user-choice'

export type ShutterSpeedSetting =
  | '1/100'
  | '1/125'
  | '1/160'
  | '1/200'
  | '1/250'
  | '1/320'
  | '1/500'
  | '1/1000+'
  | 'user-choice'

export interface StyleSettings {
  type: 'preset' | 'user-choice'
  preset?: 'corporate' | 'casual' | 'creative' | 'modern' | 'classic' | 'artistic'
}

export interface ExpressionSettings {
  type:
    | 'professional'
    | 'friendly'
    | 'serious'
    | 'confident'
    | 'happy'
    | 'sad'
    | 'neutral'
    | 'thoughtful'
    | 'user-choice'
}

export interface LightingSettings {
  type: 'natural' | 'studio' | 'soft' | 'dramatic' | 'user-choice'
}

export type BodyAngleSetting = 'square' | 'slight-angle' | 'angle-45' | 'user-choice'
export type HeadPositionSetting = 'straight-level' | 'slight-tilt' | 'face-turn' | 'user-choice'
export type ShoulderPositionSetting = 'front-shoulder-dropped' | 'both-relaxed' | 'level' | 'user-choice'
export type WeightDistributionSetting = 'back-foot-70' | 'even' | 'hip-shift' | 'user-choice'
export type ArmPositionSetting =
  | 'not-visible'
  | 'arms-crossed'
  | 'one-hand-pocket'
  | 'adjusting-jacket'
  | 'relaxed-sides'
  | 'user-choice'
export type SittingPoseSetting = 'upright-lean-forward' | 'relaxed-back' | 'perched-edge' | 'user-choice'

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
  focalLength?: FocalLengthSetting
  aperture?: ApertureSetting
  lightingQuality?: LightingQualitySetting
  shutterSpeed?: ShutterSpeedSetting
  bodyAngle?: BodyAngleSetting
  headPosition?: HeadPositionSetting
  shoulderPosition?: ShoulderPositionSetting
  weightDistribution?: WeightDistributionSetting
  armPosition?: ArmPositionSetting
  sittingPose?: SittingPoseSetting
  style?: StyleSettings
  expression?: ExpressionSettings
  lighting?: LightingSettings
  subjectCount?: SubjectCountSetting
  usageContext?: UsageContextSetting
}

// Helper types for form handling
export type CategoryType =
  | 'background'
  | 'branding'
  | 'clothing'
  | 'clothingColors'
  | 'shotType'
  | 'aspectRatio'
  | 'focalLength'
  | 'aperture'
  | 'lightingQuality'
  | 'shutterSpeed'
  | 'bodyAngle'
  | 'headPosition'
  | 'shoulderPosition'
  | 'weightDistribution'
  | 'armPosition'
  | 'sittingPose'
  | 'style'
  | 'expression'
  | 'lighting'

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
    type: 'user-choice'
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
  focalLength: 'user-choice',
  aperture: 'user-choice',
  lightingQuality: 'user-choice',
  shutterSpeed: 'user-choice',
  bodyAngle: 'user-choice',
  headPosition: 'user-choice',
  shoulderPosition: 'user-choice',
  weightDistribution: 'user-choice',
  armPosition: 'user-choice',
  sittingPose: 'user-choice',
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
  subjectCount: '1',
  usageContext: 'general'
}

// Available options for each category
export const BACKGROUND_OPTIONS = {
  office: 'Office Environment',
  neutral: 'Neutral Background',
  gradient: 'Gradient Background',
  custom: 'Custom Upload',
  'tropical-beach': 'Tropical Beach',
  'busy-city': 'Busy City',
  'user-choice': 'User Choice'
} as const

export const BRANDING_OPTIONS = {
  include: 'Include Logo',
  exclude: 'No Logo',
  'user-choice': 'User Choice'
} as const

export const CLOTHING_OPTIONS = {
  business: 'Business Attire',
  casual: 'Casual Wear',
  formal: 'Formal Wear',
  'user-choice': 'User Choice'
} as const

export const CLOTHING_ADDONS = [
  'tie',
  'bowtie',
  'blazer',
  'vest',
  'pocket-square',
  'cufflinks',
  'watch'
] as const

export const CLOTHING_COLORS = [
  'navy',
  'black',
  'gray',
  'charcoal',
  'brown',
  'white',
  'blue',
  'burgundy'
] as const

export const STYLE_PRESETS = {
  corporate: 'Corporate',
  casual: 'Casual',
  creative: 'Creative',
  modern: 'Modern',
  classic: 'Classic',
  artistic: 'Artistic'
} as const

export const EXPRESSION_OPTIONS = {
  professional: 'Professional',
  friendly: 'Friendly',
  serious: 'Serious',
  confident: 'Confident',
  happy: 'Happy',
  sad: 'Sad',
  neutral: 'Neutral',
  thoughtful: 'Thoughtful',
  'user-choice': 'User Choice'
} as const

export const LIGHTING_OPTIONS = {
  natural: 'Natural Light',
  studio: 'Studio Lighting',
  soft: 'Soft Lighting',
  dramatic: 'Dramatic Lighting',
  'user-choice': 'User Choice'
} as const

export const SHOT_TYPE_OPTIONS = {
  'extreme-close-up': 'Extreme Close-Up',
  'close-up': 'Close-Up (Tight Headshot)',
  'medium-close-up': 'Medium Close-Up (Standard Headshot)',
  'medium-shot': 'Medium Shot (Bust)',
  'three-quarter': '3/4 Shot (American)',
  'full-length': 'Full-Length',
  'wide-shot': 'Wide Shot (Environmental)',
  headshot: 'Headshot (Legacy)',
  midchest: 'Mid-Chest (Legacy)',
  'full-body': 'Full Body (Legacy)',
  'user-choice': 'User Choice'
} as const
