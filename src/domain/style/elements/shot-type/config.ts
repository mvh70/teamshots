import { defaultAspectRatioForShot } from '@/domain/style/elements/aspect-ratio/config'
import type {
  ApertureSetting,
  FocalLengthSetting,
  LightingQualitySetting,
  ShutterSpeedSetting,
  ShotTypeValue
} from './types'

export type LightingDirection =
  | 'front'
  | 'front-45'
  | 'side'
  | 'back'
  | 'top'
  | 'multi'
  | 'creative'

export const DEFAULT_SHOT_TYPE: ShotTypeValue = 'medium-close-up'

export type CanonicalShotType =
  | 'extreme-close-up'
  | 'close-up'
  | 'medium-close-up'
  | 'medium-shot'
  | 'three-quarter'
  | 'full-length'
  | 'wide-shot'

export interface ShotTypeConfig {
  id: CanonicalShotType
  label: string
  framingDescription: string
  preferredOrientation: 'vertical' | 'horizontal'
  compositionNotes?: string
}

export const SHOT_TYPE_CONFIGS: Record<CanonicalShotType, ShotTypeConfig> = {
  'extreme-close-up': {
    id: 'extreme-close-up',
    label: 'Extreme Close-Up',
    framingDescription: 'Extreme close-up focusing on the subject’s eyes or a key facial feature. Keep the frame tight with no background distractions.',
    preferredOrientation: 'vertical',
    compositionNotes: 'Tight framing on facial features with minimal headroom'
  },
  'close-up': {
    id: 'close-up',
    label: 'Close-Up (Tight Headshot)',
    framingDescription: 'Close-up headshot framing from the top of the head to just below the chin, minimal neck visible.',
    preferredOrientation: 'vertical',
    compositionNotes: 'Head and face only, minimal headroom'
  },
  'medium-close-up': {
    id: 'medium-close-up',
    label: 'Medium Close-Up (Standard Headshot)',
    framingDescription: 'Standard professional headshot framing from the top of the head down to mid-chest.',
    preferredOrientation: 'vertical',
    compositionNotes: 'Medium close-up from head to mid-chest'
  },
  'medium-shot': {
    id: 'medium-shot',
    label: 'Medium Shot (Bust)',
    framingDescription: 'Portrait framing from the top of the head down to the waist, showing torso and arms.',
    preferredOrientation: 'vertical',
    compositionNotes: 'Bust portrait from head to waist'
  },
  'three-quarter': {
    id: 'three-quarter',
    label: '3/4 Shot (American)',
    framingDescription:
      'Three-quarter portrait framing from the top of the head to mid-thigh, full arms included. The feet must NOT be visible.',
    preferredOrientation: 'vertical',
    compositionNotes: 'Three-quarter framing from head to mid-thigh, full arms visible'
  },
  'full-length': {
    id: 'full-length',
    label: 'Full-Length',
    framingDescription: 'Full-length portrait showing the entire body from head to toe with a touch of floor visible.',
    preferredOrientation: 'vertical',
    compositionNotes: 'Full body visible with breathing room top and bottom'
  },
  'wide-shot': {
    id: 'wide-shot',
    label: 'Wide Shot',
    framingDescription: 'Wide shot that places the subject within their environment. Maintain awareness of background balance.',
    preferredOrientation: 'horizontal',
    compositionNotes: 'Environmental composition with subject in context'
  }
}

export const SHOT_TYPE_ALIASES: Record<string, CanonicalShotType> = {
  'headshot': 'medium-close-up',
  'midchest': 'medium-shot',
  'full-body': 'full-length',
  'mediumcloseup': 'medium-close-up',
  'threequarter': 'three-quarter'
}

export function resolveShotType(input?: string): ShotTypeConfig {
  if (!input) {
    return SHOT_TYPE_CONFIGS[DEFAULT_SHOT_TYPE as CanonicalShotType]
  }

  const normalized = input.trim().toLowerCase()
  const canonical =
    (SHOT_TYPE_ALIASES[normalized] as CanonicalShotType | undefined) ||
    (SHOT_TYPE_CONFIGS[normalized as CanonicalShotType]
      ? (normalized as CanonicalShotType)
      : DEFAULT_SHOT_TYPE as CanonicalShotType)

  return SHOT_TYPE_CONFIGS[canonical]
}

export const DEFAULT_FOCAL_LENGTH: FocalLengthSetting = '85mm'

export interface FocalLengthConfig {
  id: FocalLengthSetting
  label: string
  mm: number
  lensType: 'prime' | 'zoom'
  description: string
}

export const FOCAL_LENGTH_CONFIGS: Record<FocalLengthSetting, FocalLengthConfig> = {
  '24mm': {
    id: '24mm',
    label: '24mm',
    mm: 24,
    lensType: 'prime',
    description: 'Wide environmental portrait with slight distortion. Use carefully near edges.',
  },
  '35mm': {
    id: '35mm',
    label: '35mm',
    mm: 35,
    lensType: 'prime',
    description: 'Natural perspective with light environmental context, minimal distortion.',
  },
  '50mm': {
    id: '50mm',
    label: '50mm',
    mm: 50,
    lensType: 'prime',
    description: 'Neutral “human eye” perspective, versatile for portraits and context.',
  },
  '70mm': {
    id: '70mm',
    label: '70mm',
    mm: 70,
    lensType: 'prime',
    description: 'Flattering three-quarter portrait compression while keeping enough body context.',
  },
  '85mm': {
    id: '85mm',
    label: '85mm',
    mm: 85,
    lensType: 'prime',
    description: 'Portrait standard focal length with flattering compression and separation.',
  },
  '105mm': {
    id: '105mm',
    label: '105mm',
    mm: 105,
    lensType: 'prime',
    description: 'Tight portrait perspective with strong compression and background blur.',
  },
  '135mm': {
    id: '135mm',
    label: '135mm',
    mm: 135,
    lensType: 'prime',
    description: 'Fashion/editorial compression with significant subject-background separation.',
  },
  '70-200mm': {
    id: '70-200mm',
    label: '70-200mm',
    mm: 135,
    lensType: 'zoom',
    description: 'Professional telephoto zoom offering flexible compression across the range.',
  },
  'user-choice': {
    id: 'user-choice',
    label: 'User Choice',
    mm: 85,
    lensType: 'prime',
    description: 'Use photographer-selected focal length.',
  }
}

export function resolveFocalLength(input?: string): FocalLengthConfig {
  if (!input) {
    return FOCAL_LENGTH_CONFIGS[DEFAULT_FOCAL_LENGTH]
  }
  const normalized = input.trim().toLowerCase()
  const entry = FOCAL_LENGTH_CONFIGS[normalized as FocalLengthSetting]
  return entry ?? FOCAL_LENGTH_CONFIGS[DEFAULT_FOCAL_LENGTH]
}

export const DEFAULT_APERTURE: ApertureSetting = 'f/4.0'

export interface ApertureConfig {
  id: ApertureSetting
  value: string
  description: string
}

export const APERTURE_CONFIGS: Record<ApertureSetting, ApertureConfig> = {
  'f/1.2': {
    id: 'f/1.2',
    value: 'f/1.2',
    description: 'Ultra shallow depth of field with extreme background blur for artistic portraits.',
  },
  'f/1.4': {
    id: 'f/1.4',
    value: 'f/1.4',
    description: 'Very shallow depth of field producing strong background blur.',
  },
  'f/1.8': {
    id: 'f/1.8',
    value: 'f/1.8',
    description: 'Shallow depth of field with beautiful bokeh; flattering portraits.',
  },
  'f/2.0': {
    id: 'f/2.0',
    value: 'f/2.0',
    description: 'Moderate shallow depth of field with balanced background separation.',
  },
  'f/2.8': {
    id: 'f/2.8',
    value: 'f/2.8',
    description: 'Professional portrait standard with dependable subject separation.',
  },
  'f/4.0': {
    id: 'f/4.0',
    value: 'f/4.0',
    description: 'Balanced depth of field for sharp facial features and controlled background blur.',
  },
  'f/5.6': {
    id: 'f/5.6',
    value: 'f/5.6',
    description: 'Greater depth of field, ideal for small groups (2-3 subjects).',
  },
  'f/8.0': {
    id: 'f/8.0',
    value: 'f/8.0',
    description: 'Deep focus for environmental portraits or larger groups.',
  },
  'f/11': {
    id: 'f/11',
    value: 'f/11',
    description: 'Very deep focus suitable for landscapes, architectural, or large group portraits.',
  },
  'user-choice': {
    id: 'user-choice',
    value: 'user-choice',
    description: 'Use photographer-selected aperture settings.',
  }
}

export function resolveAperture(input?: string): ApertureConfig {
  if (!input) {
    return APERTURE_CONFIGS[DEFAULT_APERTURE]
  }
  const entry = APERTURE_CONFIGS[input as ApertureSetting]
  return entry ?? APERTURE_CONFIGS[DEFAULT_APERTURE]
}

export const DEFAULT_LIGHTING_QUALITY: LightingQualitySetting = 'soft-diffused'

export interface LightingQualityConfig {
  id: LightingQualitySetting
  label: string
  quality: string
  style: string
  description: string
}

export const LIGHTING_QUALITY_CONFIGS: Record<LightingQualitySetting, LightingQualityConfig> = {
  'soft-diffused': {
    id: 'soft-diffused',
    label: 'Soft Diffused',
    quality: 'soft diffused lighting',
    style: 'flattering soft light',
    description: 'Flattering professional lighting with gentle transitions and minimal harsh shadows.',
  },
  'hard-direct': {
    id: 'hard-direct',
    label: 'Hard Direct',
    quality: 'hard direct lighting',
    style: 'dramatic high contrast',
    description: 'Dramatic, high-contrast lighting with defined shadows.',
  },
  'natural-golden-hour': {
    id: 'natural-golden-hour',
    label: 'Natural Golden Hour',
    quality: 'warm natural lighting',
    style: 'golden hour glow',
    description: 'Warm glowing natural light reminiscent of golden hour sunsets.',
  },
  'natural-overcast': {
    id: 'natural-overcast',
    label: 'Natural Overcast',
    quality: 'soft overcast lighting',
    style: 'even natural light',
    description: 'Even natural light with no harsh shadows—ideal for balanced portraits.',
  },
  'studio-softbox': {
    id: 'studio-softbox',
    label: 'Studio Softbox',
    quality: 'controlled studio lighting',
    style: 'softbox setup',
    description: 'Clean, controlled studio lighting with professional polish.',
  },
  'rembrandt': {
    id: 'rembrandt',
    label: 'Rembrandt',
    quality: 'directional studio lighting',
    style: 'rembrandt triangle light',
    description: 'Classic Rembrandt lighting with a triangle of light on the far cheek.',
  },
  'butterfly': {
    id: 'butterfly',
    label: 'Butterfly / Paramount',
    quality: 'beauty lighting',
    style: 'butterfly lighting',
    description: 'Beauty lighting from above the lens creating a subtle nose shadow.',
  },
  'split': {
    id: 'split',
    label: 'Split Lighting',
    quality: 'high contrast lighting',
    style: 'split lighting',
    description: 'Half the face lit and half in shadow for dramatic portraiture.',
  },
  'rim-backlight': {
    id: 'rim-backlight',
    label: 'Rim / Backlight',
    quality: 'backlighting',
    style: 'rim light',
    description: 'Backlighting that adds a rim highlight to separate the subject from the background.',
  },
  'loop': {
    id: 'loop',
    label: 'Loop Lighting',
    quality: 'loop lighting',
    style: 'loop pattern',
    description: 'Versatile portrait lighting with a small nose shadow loop.',
  },
  'user-choice': {
    id: 'user-choice',
    label: 'User Choice',
    quality: 'user defined lighting',
    style: 'user choice lighting',
    description: 'Use photographer-selected lighting quality and direction.',
  }
}

export function resolveLightingQuality(input?: string): LightingQualityConfig {
  if (!input) {
    return LIGHTING_QUALITY_CONFIGS[DEFAULT_LIGHTING_QUALITY]
  }
  const normalized = input.trim().toLowerCase()
  const entry = LIGHTING_QUALITY_CONFIGS[normalized as LightingQualitySetting]
  return entry ?? LIGHTING_QUALITY_CONFIGS[DEFAULT_LIGHTING_QUALITY]
}

export const LIGHTING_DIRECTION_LABELS: Record<LightingDirection, string> = {
  front: 'front-lit (camera-side key)',
  'front-45': '45° front-side',
  side: 'side-lit profile',
  back: 'backlit with rim effect',
  top: 'top-down light',
  multi: 'multi-source lighting',
  creative: 'creative directional lighting'
}

export function getLightingDirectionLabel(direction?: string | null): string {
  if (!direction) {
    return LIGHTING_DIRECTION_LABELS['front-45']
  }

  const normalized = direction.trim().toLowerCase() as LightingDirection
  return LIGHTING_DIRECTION_LABELS[normalized] ?? LIGHTING_DIRECTION_LABELS['front-45']
}

export const DEFAULT_SHUTTER_SPEED: ShutterSpeedSetting = '1/200'

export interface ShutterSpeedConfig {
  id: ShutterSpeedSetting
  value: string
  description: string
}

export const SHUTTER_SPEED_CONFIGS: Record<ShutterSpeedSetting, ShutterSpeedConfig> = {
  '1/100': {
    id: '1/100',
    value: '1/100',
    description: 'Minimum speed for static portraits. Use with stabilization.',
  },
  '1/125': {
    id: '1/125',
    value: '1/125',
    description: 'Safe shutter for portraits when slight movement is possible.',
  },
  '1/160': {
    id: '1/160',
    value: '1/160',
    description: 'Standard portrait shutter speed balancing sharpness and exposure.',
  },
  '1/200': {
    id: '1/200',
    value: '1/200',
    description: 'Professional standard for crisp portraits without motion blur.',
  },
  '1/250': {
    id: '1/250',
    value: '1/250',
    description: 'Additional safety margin for active subjects or handheld shots.',
  },
  '1/320': {
    id: '1/320',
    value: '1/320',
    description: 'Ideal for subjects with slight movement or windy conditions.',
  },
  '1/500': {
    id: '1/500',
    value: '1/500',
    description: 'Freezes fast movement—great for energetic subjects.',
  },
  '1/1000+': {
    id: '1/1000+',
    value: '1/1000',
    description: 'Sports/action shutter speeds to freeze intense motion.',
  },
  'user-choice': {
    id: 'user-choice',
    value: 'user-choice',
    description: 'Use photographer-selected shutter speed.',
  }
}

export function resolveShutterSpeed(input?: string): ShutterSpeedConfig {
  if (!input) {
    return SHUTTER_SPEED_CONFIGS[DEFAULT_SHUTTER_SPEED]
  }
  const entry = SHUTTER_SPEED_CONFIGS[input as ShutterSpeedSetting]
  return entry ?? SHUTTER_SPEED_CONFIGS[DEFAULT_SHUTTER_SPEED]
}

export function shotTypeSuggestedAspectRatio(shotType?: string) {
  return defaultAspectRatioForShot(shotType)
}
