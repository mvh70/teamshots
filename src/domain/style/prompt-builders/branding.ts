import type { BrandingSettings } from '@/types/photo-style'

import type { KnownStyle } from './clothing'

export interface BrandingPromptInput {
  branding?: BrandingSettings | null
  styleKey: KnownStyle
  detailKey: string
  defaultPose: {
    description: string
    arms: string
  }
}

export interface BrandingPromptResult {
  branding: Record<string, unknown>
  pose: {
    description: string
    arms: string
  }
}

const BACKGROUND_BRANDING_PROMPT: Record<string, unknown> = {
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

const ELEMENT_BRANDING_PROMPT: Record<string, unknown> = {
  logo_source: 'Place the provided brand logo once on a plausible scene element only, such as: a coffee mug label, a laptop sticker, a notebook cover, a standing banner flag, a signboard, or a door plaque. The element must be grounded in the scene (on a desk/floor/wall) and the logo must follow the element perspective without warping or repeating. Do not place on the person, skin, or clothing when using elements mode; do not float in mid-air; no duplicates or patterns.',
  allowed_elements: ['coffee mug label', 'laptop sticker', 'notebook cover', 'standing banner', 'door plaque'],
  rules: [
    'Ground the element in the scene with correct perspective.',
    'Single placement only. No duplicates or floating marks.',
    'Maintain original colors and aspect ratio.'
  ]
}

const CLOTHING_BRANDING_RULES_BASE = [
  'Do not place the logo on outer layers (jackets/coats), background, walls, floors, signs, accessories, or skin.',
  'Do not create patterns or duplicates.',
  'Keep original aspect ratio and colors; no stylization or warping.',
  'The logo size should be modest and proportional to the garment.'
]

type ClothingBrandingConfig = {
  placement: string
  rules: string[]
  pose: {
    arms: string
    description: string
  }
}

const resolveClothingBrandingConfig = (
  styleKey: KnownStyle,
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
          'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
          ...CLOTHING_BRANDING_RULES_BASE,
          'Keep the jacket partially open so the logo remains visible.'
        ],
        pose: {
          arms: 'hands clasped professionally at the front',
          description: 'Subject stands confidently with hands clasped professionally, naturally showcasing the shirt pocket logo.'
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

export function generateBrandingPrompt({
  branding,
  styleKey,
  detailKey,
  defaultPose
}: BrandingPromptInput): BrandingPromptResult {
  if (!branding || branding.type !== 'include' || !branding.logoKey) {
    return {
      branding: {
        rules: ['no brand marks visible']
      },
      pose: defaultPose
    }
  }

  const position = branding.position ?? 'clothing'

  if (position === 'background') {
    return {
      branding: BACKGROUND_BRANDING_PROMPT,
      pose: defaultPose
    }
  }

  if (position === 'elements') {
    return {
      branding: ELEMENT_BRANDING_PROMPT,
      pose: defaultPose
    }
  }

  const clothingConfig = resolveClothingBrandingConfig(styleKey, detailKey)
  return {
    branding: {
      logo_source: 'attached brand image',
      placement: clothingConfig.placement,
      size: 'modest, proportional to garment',
      rules: clothingConfig.rules
    },
    pose: clothingConfig.pose
  }
}

