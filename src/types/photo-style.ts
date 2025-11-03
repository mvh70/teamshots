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
  colors: {
    topCover?: string // Outer layer color (blazer, jacket, etc.)
    topBase?: string // Base layer color (shirt, t-shirt, etc.)
    bottom?: string // Bottom color (pants, skirt, etc.)
    shoes?: string // Shoes color
  }
}

export interface ShotTypeSettings {
  type: 'headshot' | 'midchest' | 'full-body' | 'user-choice'
}

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

export interface PhotoStyleSettings {
  background?: BackgroundSettings
  branding?: BrandingSettings
  clothing?: ClothingSettings
  clothingColors?: ClothingColorSettings
  shotType?: ShotTypeSettings
  style?: StyleSettings
  expression?: ExpressionSettings
  lighting?: LightingSettings
}

// Helper types for form handling
export type CategoryType = 'background' | 'branding' | 'clothing' | 'clothingColors' | 'shotType' | 'style' | 'expression' | 'lighting'

export interface CategoryToggle {
  category: CategoryType
  isPredefined: boolean // true = admin sets it, false = user choice
}

// Default settings for new contexts
export const DEFAULT_PHOTO_STYLE_SETTINGS: PhotoStyleSettings = {
  background: {
    type: 'user-choice'
  },
  branding: {
    type: 'user-choice'
  },
  clothing: {
    style: 'user-choice'
  },
  clothingColors: undefined,
  shotType: {
    type: 'user-choice'
  },
  style: {
    type: 'preset',
    preset: 'corporate'
  },
  expression: {
    type: 'user-choice'
  },
  lighting: {
    type: 'user-choice'
  }
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
  headshot: 'Headshot',
  midchest: 'Mid-Chest Shot',
  'full-body': 'Full Body',
  'user-choice': 'User Choice'
} as const
