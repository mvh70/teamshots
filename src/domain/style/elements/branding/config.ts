import type { BrandingSettings } from './types'

export { BrandingSettings }

export interface BrandingTypeConfig {
  value: BrandingSettings['type']
  label: string
  icon: string
  color: string
}

export const BRANDING_TYPES: BrandingTypeConfig[] = [
  { value: 'include', label: 'Include Logo', icon: '✨', color: 'from-blue-500 to-indigo-500' },
  { value: 'exclude', label: 'No Logo', icon: '🚫', color: 'from-gray-400 to-gray-500' }
]

export const BRANDING_POSITIONS = [
  { key: 'background', label: 'Background' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'elements', label: 'Other elements' }
] as const

export const BACKGROUND_BRANDING_PROMPT: Record<string, unknown> = {
  logo_source: 'Use the attached image labeled "logo" as the branding element for the scene',
  placement: 'Place the provided brand logo ONCE as a framed element on a background wall. Ensure that it is fully placed within the frame. Ideally place it off center, so that we can compose the person in the center later. If there are any elements, like plants, or cables, that would overlap the logo, that is ok, as it adds realism and depth.',
  rules: [
    'Align with scene perspective and lighting.',
    'Ensure that elements like plants, or cables, that would overlap the logo, are not hidden by the logo, but place the logo behind thes, as it adds realism and depth.',
    'Do not place on subject, floors, windows, or floating in space.',
    'Maintain original aspect ratio and colors.',
    'Single placement only, no duplication or patterns.'
  ]
}

export const ELEMENT_BRANDING_PROMPT: Record<string, unknown> = {
  logo_source: 'Use the attached image labeled "logo" as the branding element for the scene',
  placement: 'Place the provided brand logo once on a WHITE vertical standing banner flag. The element must be grounded in the scene behind the subject, standing on the floor. The logo must follow the element perspective without warping or repeating. Do not place on the person, skin, or clothing when using elements mode; do not float in mid-air; no duplicates or patterns.',
  allowed_elements: ['standing banner'],
  rules: [
    'Ground the element in the scene with correct perspective.',
    'Single placement only. No duplicates or floating marks.',
    'Keep original aspect ratio and colors; The colors of each letter and icon should be the same as the original.'
  ]
}

export const CLOTHING_BRANDING_RULES_BASE = [
  'Do not place the logo on outer layers (jackets/coats), background, walls, floors, signs, accessories, or skin.',
  'Keep original aspect ratio and colors; The colors of each letter and icon should be the same as the original.',
  'The logo size should be modest and proportional to the garment.'
]
