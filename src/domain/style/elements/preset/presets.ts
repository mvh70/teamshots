/**
 * Standard Shots Preset Settings
 *
 * Each preset defines settings that map to PhotoStyleSettings.
 * Elements read these settings and build prompts.
 *
 * This is the source of truth for preset configurations.
 * NO hardcoded prompt text - elements handle prompt generation.
 */

import type { PhotoStyleSettings } from '@/types/photo-style'
import { predefined } from '../base/element-types'

/**
 * Metadata for each preset (non-element content)
 * Scene descriptions that aren't covered by other elements
 */
export interface PresetMetadata {
  id: string
  description: string
  sceneDescription: string
  locationType: string
}

export const PRESET_METADATA: Record<string, PresetMetadata> = {
  LINKEDIN_NEUTRAL_STUDIO: {
    id: 'LINKEDIN_NEUTRAL_STUDIO',
    description: 'A high-end, clean studio headshot prioritizing trust and competence.',
    sceneDescription: 'Solid, soft light gray background with a subtle vignette. No distracting elements, pure seamless paper texture.',
    locationType: 'studio_seamless',
  },
  LINKEDIN_MODERN_OFFICE: {
    id: 'LINKEDIN_MODERN_OFFICE',
    description: 'A contemporary, dynamic business portrait set in a modern workspace.',
    sceneDescription: 'Blurred modern open-plan office environment (Bokeh). Hints of glass walls, steel, indoor plants. Cool tones.',
    locationType: 'modern_office_blur',
  },
  DATING_LIFESTYLE_CAFE: {
    id: 'DATING_LIFESTYLE_CAFE',
    description: 'A candid, relaxed lifestyle shot implying a social personality.',
    sceneDescription: 'Bustling, cozy coffee shop interior. Warm ambient lights (Edison bulbs), brick/wood textures. Blurred background.',
    locationType: 'cafe_interior',
  },
  DATING_OUTDOOR_GOLDEN_HOUR: {
    id: 'DATING_OUTDOOR_GOLDEN_HOUR',
    description: 'Vibrant, healthy outdoor shot. The "Gold Standard" for dating profiles.',
    sceneDescription: 'Sun-drenched park or nature backdrop. Backlit greenery/foliage creating bokeh.',
    locationType: 'outdoor_nature_park',
  },
  CV_MINIMALIST_WHITE: {
    id: 'CV_MINIMALIST_WHITE',
    description: 'Functional, ultra-clean photo for printed CVs/PDFs.',
    sceneDescription: 'Pure High-Key White (#FFFFFF). Blown out to match white paper.',
    locationType: 'pure_white',
  },
  PERSONAL_BRAND_URBAN_CREATIVE: {
    id: 'PERSONAL_BRAND_URBAN_CREATIVE',
    description: 'Stylish, edgy photo for creative professionals.',
    sceneDescription: 'Urban texture: blurry city street, concrete, architectural geometry. Muted urban tones.',
    locationType: 'urban_street',
  },
  SPEAKER_CONFERENCE_STAGE: {
    id: 'SPEAKER_CONFERENCE_STAGE',
    description: 'Conference speaker photo showing stage presence and body language.',
    sceneDescription: 'Real conference stage with subtle LED screen or banner backdrop. Soft stage lighting visible. Professional event atmosphere.',
    locationType: 'conference_stage',
  },
  EXECUTIVE_DARK_STUDIO: {
    id: 'EXECUTIVE_DARK_STUDIO',
    description: 'Authoritative C-suite portrait conveying power and leadership.',
    sceneDescription: 'Rich charcoal/navy gradient background. Hints of mahogany, leather, or dark wood texture.',
    locationType: 'executive_dark_studio',
  },
  TEAM_PAGE_CORPORATE: {
    id: 'TEAM_PAGE_CORPORATE',
    description: 'Consistent, bright team photo for company websites.',
    sceneDescription: 'Clean, bright off-white or light brand-color background. Subtle gradient for depth.',
    locationType: 'team_bright_studio',
  },
  SOCIAL_MEDIA_LIFESTYLE: {
    id: 'SOCIAL_MEDIA_LIFESTYLE',
    description: 'Warm, approachable photo for Instagram, Twitter, and personal social media.',
    sceneDescription: 'Soft natural environment: sunny window, cozy interior, or blurred greenery. Warm tones.',
    locationType: 'lifestyle_natural',
  },
}

/**
 * Preset settings that map to PhotoStyleSettings
 * Elements read these and build prompts
 */
export const PRESET_SETTINGS: Record<string, Partial<PhotoStyleSettings>> = {
  LINKEDIN_NEUTRAL_STUDIO: {
    background: predefined({ type: 'neutral', color: '#D3D3D3' }),
    pose: predefined({ type: 'slimming_three_quarter' }),
    expression: predefined({ type: 'genuine_smile' }),
    lighting: predefined({ type: 'soft' }),
    shotType: predefined({ type: 'medium-close-up' }),
    filmType: predefined({ type: 'clinical-modern' }),
    clothing: predefined({ style: 'business', details: 'formal' }),
    aspectRatio: '4:5',
  },
  LINKEDIN_MODERN_OFFICE: {
    background: predefined({ type: 'office' }),
    pose: predefined({ type: 'approachable_lean' }),
    expression: predefined({ type: 'genuine_smile' }),
    lighting: predefined({ type: 'natural' }),
    shotType: predefined({ type: 'medium-close-up' }),
    filmType: predefined({ type: 'cinematic-drama' }),
    clothing: predefined({ style: 'business', details: 'casual' }),
    aspectRatio: '4:5',
  },
  DATING_LIFESTYLE_CAFE: {
    background: predefined({ type: 'cafe' }),
    pose: predefined({ type: 'candid_over_shoulder' }),
    expression: predefined({ type: 'laugh_joy' }),
    lighting: predefined({ type: 'natural' }),
    shotType: predefined({ type: 'medium-shot' }),
    filmType: predefined({ type: 'portra-warm' }),
    clothing: predefined({ style: 'startup', details: 'cardigan' }),
    aspectRatio: '4:5',
  },
  DATING_OUTDOOR_GOLDEN_HOUR: {
    background: predefined({ type: 'outdoor' }),
    pose: predefined({ type: 'casual_confident' }),
    expression: predefined({ type: 'soft_smile' }),
    lighting: predefined({ type: 'natural' }),
    shotType: predefined({ type: 'three-quarter' }),
    filmType: predefined({ type: 'kodak-editorial' }),
    clothing: predefined({ style: 'business', details: 'casual' }),
    aspectRatio: '4:5',
  },
  CV_MINIMALIST_WHITE: {
    background: predefined({ type: 'solid', color: '#FFFFFF' }),
    pose: predefined({ type: 'classic_corporate' }),
    expression: predefined({ type: 'neutral_serious' }),
    lighting: predefined({ type: 'soft' }),
    shotType: predefined({ type: 'close-up' }),
    filmType: predefined({ type: 'clinical-modern' }),
    clothing: predefined({ style: 'business', details: 'formal' }),
    aspectRatio: '1:1',
  },
  PERSONAL_BRAND_URBAN_CREATIVE: {
    background: predefined({ type: 'urban' }),
    pose: predefined({ type: 'casual_confident' }),
    expression: predefined({ type: 'contemplative' }),
    lighting: predefined({ type: 'natural' }),
    shotType: predefined({ type: 'three-quarter' }),
    filmType: predefined({ type: 'fuji-documentary' }),
    clothing: predefined({ style: 'startup', details: 'hoodie' }),
    aspectRatio: '4:5',
  },
  SPEAKER_CONFERENCE_STAGE: {
    background: predefined({ type: 'stage' }),
    pose: predefined({ type: 'power_cross' }),
    expression: predefined({ type: 'genuine_smile' }),
    lighting: predefined({ type: 'studio' }),
    shotType: predefined({ type: 'three-quarter' }),
    filmType: predefined({ type: 'cinematic-drama' }),
    clothing: predefined({ style: 'business', details: 'formal' }),
    aspectRatio: '4:5',
  },
  EXECUTIVE_DARK_STUDIO: {
    background: predefined({ type: 'dark_studio', color: '#2C3E50' }),
    pose: predefined({ type: 'power_cross' }),
    expression: predefined({ type: 'confident' }),
    lighting: predefined({ type: 'dramatic' }),
    shotType: predefined({ type: 'medium-close-up' }),
    filmType: predefined({ type: 'cinematic-drama' }),
    clothing: predefined({ style: 'business', details: 'formal' }),
    aspectRatio: '4:5',
  },
  TEAM_PAGE_CORPORATE: {
    background: predefined({ type: 'team_bright', color: '#F5F5F5' }),
    pose: predefined({ type: 'slimming_three_quarter' }),
    expression: predefined({ type: 'genuine_smile' }),
    lighting: predefined({ type: 'soft' }),
    shotType: predefined({ type: 'medium-close-up' }),
    filmType: predefined({ type: 'clinical-modern' }),
    clothing: predefined({ style: 'business', details: 'casual' }),
    aspectRatio: '1:1',
  },
  SOCIAL_MEDIA_LIFESTYLE: {
    background: predefined({ type: 'lifestyle' }),
    pose: predefined({ type: 'candid_over_shoulder' }),
    expression: predefined({ type: 'genuine_smile' }),
    lighting: predefined({ type: 'natural' }),
    shotType: predefined({ type: 'medium-shot' }),
    filmType: predefined({ type: 'portra-warm' }),
    clothing: predefined({ style: 'startup', details: 'cardigan' }),
    aspectRatio: '4:5',
  },
}

/**
 * Get preset settings by ID
 */
export function getPresetSettings(presetId: string): Partial<PhotoStyleSettings> {
  return PRESET_SETTINGS[presetId] || PRESET_SETTINGS.LINKEDIN_NEUTRAL_STUDIO
}

/**
 * Get preset metadata by ID
 */
export function getPresetMetadata(presetId: string): PresetMetadata {
  return PRESET_METADATA[presetId] || PRESET_METADATA.LINKEDIN_NEUTRAL_STUDIO
}
