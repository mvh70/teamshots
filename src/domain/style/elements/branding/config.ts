import type { BrandingSettings } from '@/types/photo-style'
import type { KnownClothingStyle } from '../clothing/config'

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
  placement: 'Place the provided brand logo ONCE as a framed element on a background wall.',
  rules: [
    'Align with scene perspective and lighting.',
    'If the background is blurred, apply the same blurring to the framed logo',
    'Do not place on subject, floors, windows, or floating in space.',
    'Maintain original aspect ratio and colors.',
    'Single placement only, no duplication or patterns.'
  ]
}

export const ELEMENT_BRANDING_PROMPT: Record<string, unknown> = {
  logo_source: 'Place the provided brand logo once on a plausible scene element only, such as: a coffee mug label, a laptop sticker, a notebook cover, a standing banner flag, a signboard, or a door plaque. The element must be grounded in the scene (on a desk/floor/wall) and the logo must follow the element perspective without warping or repeating. Do not place on the person, skin, or clothing when using elements mode; do not float in mid-air; no duplicates or patterns.',
  allowed_elements: ['coffee mug label', 'laptop sticker', 'notebook cover', 'standing banner', 'door plaque'],
  rules: [
    'Ground the element in the scene with correct perspective.',
    'Single placement only. No duplicates or floating marks.',
    'Maintain original colors and aspect ratio.'
  ]
}

export const CLOTHING_BRANDING_RULES_BASE = [
  'CRITICAL: Place logo ONLY on the chest area of base garments (t-shirt, polo, shirt) - NEVER on outer layers like jackets unless the jacket is open to reveal it.',
  'Logo must appear as physically printed on fabric with proper lighting, shadows, and material interaction.',
  'If wearing layered clothing: Either open the outer layer (jacket/blazer) to prominently display the logo, OR ensure logo is visible on the base layer underneath.',
  'Logo should be centered or positioned naturally on the chest area, clearly visible and not obscured.',
  'Do not place on background, walls, accessories, skin, or any non-clothing surfaces.',
  'Keep original aspect ratio and colors; maintain logo integrity without distortion.',
  'Logo size should be proportional (typically 10-15% of chest width) and look professionally placed.',
  'Single logo placement only - no duplicates, patterns, or repetitions.',
  'Maintain all images and letters of the logo, and keep each limage and letter in the same color as in the original logo.'
]

export type ClothingBrandingConfig = {
  placement: string
  rules: string[]
  pose: {
    arms: string
    description: string
  }
}

export const resolveClothingBrandingConfig = (
  styleKey: KnownClothingStyle,
  detailKey: string
): ClothingBrandingConfig => {
  if (styleKey === 'business') {
    if (detailKey === 'dress') {
      return {
        placement: 'upper-left chest of the dress as a subtle embroidered crest',
        rules: [
          'Integrate the logo as a tasteful embroidered mark on the dress bodice.',
          ...CLOTHING_BRANDING_RULES_BASE,
          'Keep surrounding fabric smooth so the crest remains crisp.'
        ],
        pose: {
          arms: 'hands gently clasped at the waist, angled slightly to showcase the crest',
          description: 'Subject stands gracefully, angled 20° with relaxed hands drawing focus to the embroidered logo.'
        }
      }
    }

    // Business formal (formal, pantsuit, blouse)
    if (detailKey === 'formal' || detailKey === 'pantsuit' || detailKey === 'blouse') {
      return {
        placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
        rules: [
          'CRITICAL: Place logo on the base dress shirt (underneath jacket) in the upper-right chest area where a shirt pocket would be.',
          'MANDATORY: Open the jacket sufficiently so the logo on the shirt underneath is clearly visible and prominent.',
          'Logo must be clearly readable and not obscured by the jacket layers.',
          ...CLOTHING_BRANDING_RULES_BASE,
          'Ensure jacket opening naturally reveals the logo placement area.'
        ],
        pose: {
          arms: 'hands clasped professionally at the front, jacket open to reveal logo',
          description: 'Subject stands confidently with jacket open and hands clasped professionally, prominently displaying the logo on the shirt underneath.'
        }
      }
    }

    // Business casual (casual)
    if (detailKey === 'casual') {
      return {
        placement: 'center chest area of the base layer (t-shirt, knit top, or blouse)',
        rules: [
          'Place the provided brand logo exactly once on the center chest area of the base garment.',
          ...CLOTHING_BRANDING_RULES_BASE
        ],
        pose: {
          arms: 'hands gently clasped at the front, maintaining relaxed posture',
          description: 'Subject stands confidently with hands relaxed at the sides, naturally showcasing the center chest logo.'
        }
      }
    }

    // Default fallback - business formal
    return {
      placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
      rules: [
        'CRITICAL: Place logo on the base dress shirt (underneath jacket) in the upper-right chest area where a shirt pocket would be.',
        'MANDATORY: Open the jacket wide enough so the logo on the shirt is clearly visible and takes center focus.',
        'Logo must be the prominent focal point on the chest area.',
        ...CLOTHING_BRANDING_RULES_BASE,
        'Ensure the jacket opening is natural but maximizes logo visibility.'
      ],
      pose: {
        arms: 'opening jacket wide to prominently reveal logo on the base shirt',
        description: 'Subject elegantly opens the jacket wide to proudly and prominently reveal the logo positioned on the base garment beneath.'
      }
    }
  }

  if (styleKey === 'startup') {
    return {
      placement: 'center chest area of the base garment (t-shirt, hoodie, polo, button-down)',
      rules: ['Place the provided brand logo exactly once on the center chest area of the base garment.', ...CLOTHING_BRANDING_RULES_BASE],
      pose: {
        arms: 'hands gently pointing towards the logo on the base garment',
        description: 'The subject highlights the logo with both hands in a confident yet natural gesture.'
      }
    }
  }

  // black-tie
  if (detailKey === 'dress' || detailKey === 'gown') {
    return {
      placement: 'upper-left chest of the gown as an elegant embroidered crest',
      rules: [
        'Integrate the logo as a tasteful applique on the gown or dress bodice.',
        ...CLOTHING_BRANDING_RULES_BASE
      ],
      pose: {
        arms: 'one hand resting gracefully near the logo placement to draw subtle attention',
        description: 'The subject maintains a poised stance with one hand near the logo to emphasize it gracefully.'
      }
    }
  }

  return {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ],
    pose: {
      arms: 'opening jacket to reveal logo on the base shirt',
      description: 'Subject is elegantly opening the jacket to proudly reveal the logo on the base garment beneath.'
    }
  }
}

