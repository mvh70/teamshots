import type { BrandingSettings } from './types'
import type { ElementConfig } from '../registry'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { deserialize } from './deserializer'

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
  placement: 'Physical 3D Wall Signage. The logo is not a print, but a dimensional object made of matte acrylic mounted on the rear wall. It has visible thickness/extrusion. It casts a natural soft shadow on the wall. Due to the f/2.0 aperture, the logo should be slightly soft/blurred compared to the sharp subject.',
  material: 'Choose what fits best, depending on the size and scenery: in brushed metal / carved stone / illuminated acrylic',
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
  placement: 'Place the provided brand logo once on a FALCON FEATHER FLAG/BANNER - a curved, swooping flag mounted on a pole that extends from the floor. The flag shape is distinctive: HORIZONTAL or SLIGHTLY DIAGONAL at the bottom edge (where it attaches to the pole), and SMOOTH, ROUNDED, and CURVED at the top edge (flowing outward like a feather or sail). The flag should have natural fabric physics: it curves outward from the pole, creating a THREE-DIMENSIONAL swooping shape with visible depth, natural folds, and subtle fabric texture. Adapt the flag color to the logo: if the logo has a distinct background color, use that same color for the flag background; if the logo has a white or transparent background, make the flag WHITE. CRITICAL SPATIAL POSITIONING: The flag pole must be positioned OFF-CENTER in the frame - either to the LEFT or RIGHT side, NOT in the center where the person stands. This ensures the flag is VISIBLE and not blocked by the person. The flag pole must be grounded on the floor BEHIND the subject (6-8 feet back), standing naturally in the scene. CRITICAL LOGO POSITIONING ON FLAG: Center the logo VERTICALLY on the flag fabric, with equal space above and below. Align the logo\'s CENTER with the flag pole\'s vertical axis - the logo should be balanced around the pole, not shifted left or right relative to the pole. The logo must be professionally printed on the curved fabric surface, following the natural curve and perspective of the flag without warping. Due to the depth of field (f/2.0 aperture), the flag should be SLIGHTLY SOFTER in focus than the sharp subject in the foreground. Do not place on the person, skin, or clothing when using elements mode; do not float in mid-air; no duplicates or patterns.',
  allowed_elements: ['falcon feather flag', 'curved banner flag'],
  rules: [
    'CRITICAL FLAG SHAPE & DEPTH: The flag must curve outward from the pole in a swooping feather/sail shape with visible three-dimensional depth. Add natural fabric folds, shadows, and highlights that show the flag is a real physical object with volume, not flat.',
    'CRITICAL SPATIAL POSITIONING IN FRAME: Position the flag pole OFF-CENTER in the composition - either on the LEFT or RIGHT side of the frame. The person will be centered, so the flag MUST be to the side to remain visible and not blocked by the person. The flag should be clearly visible next to or behind the person, not hidden.',
    'CRITICAL PERSPECTIVE: Position the flag pole 6-8 feet BEHIND the subject. Apply proper depth of field - the flag should be slightly softer/gentler in focus than the tack-sharp subject.',
    'CRITICAL GROUNDING: The flag pole must be clearly planted on the floor with a weighted base or stand visible at ground level. The flag should appear naturally grounded, not floating.',
    'CRITICAL LOGO CENTERING ON FLAG: The logo must be CENTERED both vertically and horizontally on the flag fabric itself. Vertically: equal distance from top and bottom edges of the flag. Horizontally: the logo center must align with the flag pole\'s vertical axis. Think of the pole as the centerline - the logo should be balanced equally on both sides of it.',
    'LIGHTING & SHADOWS: The flag should receive the same scene lighting as the background. Add natural shadows cast by the flag onto the background wall/floor to reinforce depth.',
    'FABRIC PHYSICS: Show subtle wind movement or natural fabric draping. The flag should look like real fabric material, not a stiff board.',
    'LOGO INTEGRATION: The logo follows the natural curve of the fabric surface, slightly distorted by the flag\'s perspective and curvature.',
    'Single placement only. No duplicates or floating marks.',
    'Keep original logo aspect ratio and colors; The colors of each letter and icon should be the same as the original.'
  ]
}

export const CLOTHING_BRANDING_RULES_BASE = [
  'Do not place the logo on outer layers (jackets/coats), background, walls, floors, signs, accessories, or skin.',
  'Keep original aspect ratio and colors; The colors of each letter and icon should be the same as the original.',
  'The logo size should be modest and proportional to the garment.'
]

/**
 * Element registry config for branding
 */
export const brandingElementConfig: ElementConfig<PhotoStyleSettings['branding']> = {
  getDefaultPredefined: () => ({ type: 'include' }),
  getDefaultUserChoice: () => ({ type: 'user-choice' }),
  deserialize
}
