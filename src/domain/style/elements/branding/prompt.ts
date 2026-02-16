import type { BrandingSettings, BrandingValue } from './types'
import { hasValue } from '../base/element-types'
import { KnownClothingStyle } from '../clothing/config'

export type BrandingPosition = NonNullable<BrandingValue['position']>

type BrandingPromptConfig = {
  logo_source: string
  placement: string
  material?: string
  allowed_elements?: string[]
  rules: string[]
}

const NO_BRAND_MARKS_RULE = 'No brand marks visible'

const CLOTHING_BRANDING_RULES_BASE = [
  'Do not place the logo on outer layers (jackets/coats), background, walls, floors, signs, accessories, or skin.',
  'Keep original aspect ratio and colors; The colors of each letter and icon should be the same as the original.',
  'The logo size should be modest and proportional to the garment.',
]

const LOGO_INTEGRITY_RULES = [
  'Copy the logo EXACTLY from the reference image - same letters, shapes, colors, proportions.',
  'DO NOT redesign, reinterpret, stylize, simplify, or modify the logo in any way.',
  'Treat it as a fixed trademark asset: only its placement/material integration can change, never the logo design itself.',
  'If the logo has a bright green background, treat it as chroma key — do NOT render green in the output.',
]

const BACKGROUND_BRANDING_PROMPT: BrandingPromptConfig = {
  logo_source: 'Use the attached image labeled "logo" as the branding element for the scene',
  placement:
    "Physical 3D wall signage in acrylic. The logo is not a print, but a dimensional acrylic object mounted on the rear wall with visible thickness/extrusion. The acrylic preserves the logo's original colors faithfully. It casts a natural soft shadow on the wall.",
  rules: [
    'Align with scene perspective and lighting.',
    'Ensure that elements like plants, or cables, that would overlap the logo, are not hidden by the logo, but place the logo behind them, as it adds realism and depth.',
    'Do not place on subject, floors, windows, or floating in space.',
    "Maintain original aspect ratio and colors exactly.",
    'Single placement only, no duplication or patterns.',
  ],
}

const ELEMENT_BRANDING_PROMPT: BrandingPromptConfig = {
  logo_source: 'Use the attached image labeled "logo" as the branding element for the scene',
  placement:
    "Place the provided brand logo once on a FALCON FEATHER FLAG/BANNER - a curved, swooping flag mounted on a pole that extends from the floor. The flag shape is distinctive: HORIZONTAL or SLIGHTLY DIAGONAL at the bottom edge (where it attaches to the pole), and SMOOTH, ROUNDED, and CURVED at the top edge (flowing outward like a feather or sail). The flag should have natural fabric physics: it curves outward from the pole, creating a THREE-DIMENSIONAL swooping shape with visible depth, natural folds, and subtle fabric texture. Adapt the flag color to the logo: if the logo has a distinct background color, use that same color for the flag background; if the logo has a white or transparent background, make the flag WHITE. CRITICAL SPATIAL POSITIONING: The flag pole must be positioned OFF-CENTER in the frame - either to the LEFT or RIGHT side, NOT in the center where the person stands. This ensures the flag is VISIBLE and not blocked by the person. The flag pole must be grounded on the floor BEHIND the subject (6-8 feet back), standing naturally in the scene. CRITICAL LOGO POSITIONING ON FLAG: Center the logo VERTICALLY on the flag fabric, with equal space above and below. Align the logo's CENTER with the flag pole's vertical axis - the logo should be balanced around the pole, not shifted left or right relative to the pole. The logo must be professionally printed on the curved fabric surface, following the natural curve and perspective of the flag without warping. Due to the depth of field (f/2.0 aperture), the flag should be SLIGHTLY SOFTER in focus than the sharp subject in the foreground. Do not place on the person, skin, or clothing when using elements mode; do not float in mid-air; no duplicates or patterns.",
  allowed_elements: ['falcon feather flag', 'curved banner flag'],
  rules: [
    'CRITICAL FLAG SHAPE & DEPTH: The flag must curve outward from the pole in a swooping feather/sail shape with visible three-dimensional depth. Add natural fabric folds, shadows, and highlights that show the flag is a real physical object with volume, not flat.',
    'CRITICAL SPATIAL POSITIONING IN FRAME: Position the flag pole OFF-CENTER in the composition - either on the LEFT or RIGHT side of the frame. The person will be centered, so the flag MUST be to the side to remain visible and not blocked by the person. The flag should be clearly visible next to or behind the person, not hidden.',
    'CRITICAL PERSPECTIVE: Position the flag pole 6-8 feet BEHIND the subject. Apply proper depth of field - the flag should be slightly softer/gentler in focus than the tack-sharp subject.',
    'CRITICAL GROUNDING: The flag pole must be clearly planted on the floor with a weighted base or stand visible at ground level. The flag should appear naturally grounded, not floating.',
    "CRITICAL LOGO CENTERING ON FLAG: The logo must be CENTERED on the flag fabric itself, following the flag's vertical axis.",
    'LIGHTING & SHADOWS: The flag should receive the same scene lighting as the background. Add natural shadows cast by the flag onto the background wall/floor to reinforce depth.',
    'FABRIC PHYSICS: Show subtle wind movement or natural fabric draping. The flag should look like real fabric material, not a stiff board.',
    "LOGO INTEGRATION: The logo follows the natural curve of the fabric surface, slightly distorted by the flag's perspective and curvature.",
    'Single placement only. No duplicates or floating marks.',
    'Keep original logo aspect ratio and colors; The colors of each letter and icon should be the same as the original.',
  ],
}

const CLOTHING_BRANDING_PROMPT: BrandingPromptConfig = {
  logo_source: 'Use the attached image labeled "logo" as the branding element for clothing',
  placement: 'Place logo on clothing garment (shirt, sweater, etc.)',
  rules: CLOTHING_BRANDING_RULES_BASE,
}

const BRANDING_INTEGRATION_RULES = [
  'Integrate the logo as a real physical object in the environment, not a flat pasted sticker or watermark.',
  'Match scene perspective, vanishing lines, lighting direction, exposure, and color temperature.',
  'Add realistic surface interaction: soft contact shadow, subtle highlights, and material-consistent shading.',
  'Respect scene depth and occlusion: if foreground/background objects overlap the placement area, keep natural layering.',
]

const COMPOSITION_LAYOUT_BRANDING_NOTE =
  'The branding should be visible but secondary to the person who will be composited in the center later.'

const LOGO_REFERENCE_DESCRIPTION_CLOTHING =
  'LOGO REFERENCE (DO NOT MODIFY) - Copy this logo EXACTLY as shown onto the clothing. This is a corporate trademark that CANNOT be changed. Every letter, shape, color, and proportion must be reproduced with 100% accuracy. Do NOT redesign, reinterpret, or stylize. NOTE: If the logo has a bright green background, that is a chroma key for visibility only - do NOT include the green background in the output, only the logo elements.'

const LOGO_REFERENCE_DESCRIPTION_SCENE =
  'LOGO REFERENCE (DO NOT MODIFY) - Copy this logo EXACTLY as shown. This is a corporate trademark that CANNOT be changed. Every letter, shape, color, and proportion must be reproduced with 100% accuracy. Do NOT redesign, reinterpret, or stylize. Place it in the scene but DO NOT alter the logo itself. NOTE: If the logo has a bright green background, that is a chroma key for visibility only - do NOT include the green background in the output, only the logo elements.'

const STEP0_ROLE_TASK_INTRO = {
  customEdit:
    'You are a world-class brand compositor. Edit only the provided background image by integrating the provided logo naturally into the scene.',
  studioGenerate:
    'You are a world-class brand compositor. Generate a branded studio background scene and integrate the provided logo naturally according to the scene specifications.',
  environmentGenerate:
    'You are a world-class scene designer and brand compositor. Generate a branded photographic background scene and integrate the provided logo naturally according to the scene specifications.',
} as const

type ClothingBrandingConfig = {
  placement: string
  rules: string[]
}

// Repository pattern for branding configurations
const BRANDING_CONFIGS: Record<string, ClothingBrandingConfig> = {
  // Default fallback
  'default': {
    placement: 'left chest or center chest',
    rules: CLOTHING_BRANDING_RULES_BASE
  },

  // Business style configurations
  'business-dress': {
    placement: 'upper-left chest of the dress as a subtle embroidered crest',
    rules: [
      'Integrate the logo as a tasteful embroidered mark on the dress bodice.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep surrounding fabric smooth so the crest remains crisp.'
    ]
  },
  'business-formal': {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ]
  },
  'business-pantsuit': {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ]
  },
  'business-blouse': {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ]
  },
  'business-casual': {
    placement: 'Place the logo on the center chest area of the base shirt layer ONLY, positioning it as if the outer jacket were not there. The logo must be rendered as part of the base shirt fabric itself. Let the outer jacket naturally obscure portions of the logo for realistic partial visibility. CRITICAL: The logo must NOT spill over or extend onto the jacket fabric - it should exist exclusively on the base shirt layer beneath.',
    rules: [
      'Render the logo as an integral part of the base shirt fabric, not as a separate overlay.',
      'The logo belongs to the base layer only - any parts that would be covered by the jacket should simply be hidden behind it.',
      'Do not let any portion of the logo appear on the jacket lapels, collar, or sleeves.',
      'Partial logo visibility is expected and realistic - do not attempt to show the complete logo.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },

  // Startup style configurations
  'startup-t-shirt': {
    placement: 'center chest area of the t-shirt',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the t-shirt.',
      'Position the logo centered horizontally and slightly below the neckline.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'startup-hoodie': {
    placement: 'center chest area of the hoodie',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the hoodie.',
      'Position the logo centered horizontally and slightly below the neckline.',
      'Ensure the logo sits on the main body of the hoodie, not on the hood or sleeves.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'startup-polo': {
    placement: 'left chest area of the polo shirt, positioned where a traditional polo logo would be',
    rules: [
      'Place the provided brand logo exactly once on the left chest area of the polo shirt.',
      'Position the logo on the upper left chest, similar to where a traditional polo emblem would be placed.',
      'The logo should be small to medium sized, proportional to a typical polo shirt logo.',
      'Keep the logo above the horizontal midline of the chest and to the left of the placket buttons.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'startup-button-down': {
    placement: 'center chest area of the t-shirt underneath the button-down shirt',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the t-shirt that is worn under the button-down shirt.',
      'The logo should NOT be placed on the button-down shirt itself.',
      'Ensure the logo does not spill over onto the button-down shirt.',
      'It is perfectly acceptable for the logo to be only partially visible, with part of it hidden behind the button-down shirt for a more realistic look.',
      'Position the logo on the t-shirt as if the button-down shirt were not there, then let the button-down naturally cover part of it.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'startup-blouse': {
    placement: 'center chest area of the blouse',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the blouse.',
      'Position the logo centered horizontally and slightly below the neckline.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'startup-cardigan': {
    placement: 'center chest area of the base garment underneath the cardigan',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the t-shirt or dress worn under the cardigan.',
      'The logo should NOT be placed on the cardigan itself.',
      'It is perfectly acceptable for the logo to be only partially visible, with part of it hidden behind the cardigan for a more realistic look.',
      'The cardigan should remain naturally open or draped, allowing the logo on the base garment to be visible.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'startup-dress': {
    placement: 'center chest area of the dress bodice',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the dress bodice.',
      'Position the logo centered horizontally and slightly below the neckline.',
      'Ensure the logo integrates naturally with the dress fabric.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'startup-jumpsuit': {
    placement: 'center chest area of the jumpsuit bodice',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the jumpsuit bodice.',
      'Position the logo centered horizontally and slightly below the neckline.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },

  // Black-tie style configurations
  'black-tie-dress': {
    placement: 'upper-left chest of the gown as an elegant embroidered crest',
    rules: [
      'Integrate the logo as a tasteful applique on the gown or dress bodice.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'black-tie-gown': {
    placement: 'upper-left chest of the gown as an elegant embroidered crest',
    rules: [
      'Integrate the logo as a tasteful applique on the gown or dress bodice.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'black-tie-tuxedo': {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ]
  },
  'black-tie-suit': {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ]
  }
}

function resolveClothingBrandingConfig(styleKey: KnownClothingStyle | undefined, detailKey?: string): ClothingBrandingConfig {
  if (!styleKey) {
    return BRANDING_CONFIGS.default
  }

  // Try specific style-detail combination first
  const specificKey = `${styleKey}-${detailKey}` as keyof typeof BRANDING_CONFIGS
  if (BRANDING_CONFIGS[specificKey]) {
    return BRANDING_CONFIGS[specificKey]
  }

  // Try style-default fallback
  const defaultKey = `${styleKey}-default` as keyof typeof BRANDING_CONFIGS
  if (BRANDING_CONFIGS[defaultKey]) {
    return BRANDING_CONFIGS[defaultKey]
  }

  // Final fallback
  return BRANDING_CONFIGS.default
}

export interface BrandingPromptInput {
  branding?: BrandingSettings | null
  styleKey: KnownClothingStyle
  detailKey: string
}

export interface BrandingPromptResult {
  branding: Record<string, unknown>
  rules: string[]
}

export function getLogoIntegrityRules(): string[] {
  return [...LOGO_INTEGRITY_RULES]
}

export function getBrandingPromptConfig(position: BrandingPosition): BrandingPromptConfig {
  if (position === 'background') return BACKGROUND_BRANDING_PROMPT
  if (position === 'elements') return ELEMENT_BRANDING_PROMPT
  return CLOTHING_BRANDING_PROMPT
}

export function getLogoReferenceDescription(position: BrandingPosition): string {
  return position === 'clothing'
    ? LOGO_REFERENCE_DESCRIPTION_CLOTHING
    : LOGO_REFERENCE_DESCRIPTION_SCENE
}

export function getBrandingIntegrationRules(): string[] {
  return [...BRANDING_INTEGRATION_RULES]
}

export function getCompositionLayoutBrandingNote(): string {
  return COMPOSITION_LAYOUT_BRANDING_NOTE
}

export function getStep0BrandingRoleTaskIntro(params: {
  mode: 'custom-edit' | 'environment-generate'
  isStudioType?: boolean
}): string {
  if (params.mode === 'custom-edit') {
    return STEP0_ROLE_TASK_INTRO.customEdit
  }
  return params.isStudioType
    ? STEP0_ROLE_TASK_INTRO.studioGenerate
    : STEP0_ROLE_TASK_INTRO.environmentGenerate
}

export function getStep0BackgroundReferenceDescription(): string {
  return 'BACKGROUND REFERENCE (PRIMARY, IMMUTABLE) - Use this as the exact base scene and preserve its composition.'
}

export function generateBrandingPrompt({
  branding,
  styleKey,
  detailKey
}: BrandingPromptInput): BrandingPromptResult {
  // Check if branding has a value and is set to include with a logo
  if (!branding || !hasValue(branding)) {
    return {
      branding: {
        enabled: false
      },
      rules: [NO_BRAND_MARKS_RULE]
    }
  }

  const brandingValue = branding.value
  if (brandingValue.type !== 'include' || (!brandingValue.logoKey && !brandingValue.logoAssetId)) {
    return {
      branding: {
        enabled: false
      },
      rules: [NO_BRAND_MARKS_RULE]
    }
  }

  const position = brandingValue.position ?? 'clothing'

  if (position === 'background') {
    // Extract instructions from background branding config
    // NOTE: placement is in branding.placement field, NOT duplicated in rules array
    const { logo_source, placement, rules: configRules } = getBrandingPromptConfig(position)
    const rules: string[] = []

    if (typeof logo_source === 'string') {
      rules.push(logo_source)
    }

    // Don't add placement to rules - it's already in branding.placement to avoid duplication

    if (Array.isArray(configRules)) {
      rules.push(...(configRules as string[]))
    }

    return {
      branding: {
        enabled: true,
        position: 'background',
        placement: typeof placement === 'string' ? placement : 'on background wall',
        rules // Store rules in the branding object for Step 3
      },
      rules
    }
  }

  if (position === 'elements') {
    // Extract instructions from elements branding config
    // NOTE: placement is in branding.placement field, NOT duplicated in rules array
    const { logo_source, placement, rules: configRules, allowed_elements } = getBrandingPromptConfig(position)
    const rules: string[] = []

    if (typeof logo_source === 'string') {
      rules.push(logo_source)
    }

    // Don't add placement to rules - it's already in branding.placement to avoid duplication

    if (Array.isArray(configRules)) {
      rules.push(...(configRules as string[]))
    }

    return {
      branding: {
        enabled: true,
        position: 'elements',
        placement: typeof placement === 'string' ? placement : 'on falcon banner flag',
        allowed_elements,
        rules // Store rules in the branding object for Step 3
      },
      rules
    }
  }

  const clothingConfig = resolveClothingBrandingConfig(styleKey, detailKey)
  
  // Build rules array with all instructions
  const rules: string[] = [
    'Use the attached brand image as the logo source.',
    `Place the logo on: ${clothingConfig.placement}.`,
    'The logo size should be modest and proportional to the garment.',
    ...clothingConfig.rules
  ]
  
  return {
    branding: {
      enabled: true,
      position: 'clothing',
      placement: clothingConfig.placement
    },
    rules
  }
}

export function getStep1aClothingLogoReferenceDescription(): string {
  return LOGO_REFERENCE_DESCRIPTION_CLOTHING
}

export function getStep1aBackgroundLogoReferenceDescription(position?: string): string {
  const target =
    position === 'elements'
      ? 'environmental branded element placement'
      : 'background placement'
  return [
    LOGO_REFERENCE_DESCRIPTION_SCENE,
    `Use this for ${target} verification only.`,
  ].join(' ')
}

export function getContextualBackgroundBrandingRules(params: {
  position?: string
  backgroundType?: string
}): string[] {
  const position = params.position || 'background'
  if (position !== 'background') {
    return []
  }

  const backgroundType = (params.backgroundType || '').toLowerCase()
  if (backgroundType !== 'neutral' && backgroundType !== 'gradient') {
    return []
  }

  return [
    'For neutral or gradient backgrounds, place the logo centered on the rear wall directly behind the person so it remains visible around the centered subject.',
  ]
}

export type Step0BrandingEvalScenario = 'clothing' | 'background'

export type Step0BrandingEvalCriterion =
  | 'logo_visible'
  | 'logo_accurate'
  | 'logo_placement'
  | 'logo_integrated'
  | 'clothing_logo_no_overflow'

const STEP0_CHROMA_RULES = [
  'CRITICAL CHROMA RULES:',
  '- If the logo reference has a bright green or solid chroma background, treat it as transparency guidance only.',
  '- Do NOT treat the chroma matte box as part of the intended logo design.',
  '- Compare logo foreground content only (glyphs, text, symbols, brand colors).',
  '- If generated output shows obvious leftover green matte, halo, or patch behind the logo, fail integration/overflow.',
]

export function getStep0BrandingEvalPrompt(scenario: Step0BrandingEvalScenario): string {
  const clothingScenario = scenario === 'clothing'
  const scenarioLine = clothingScenario
    ? 'Scenario: Flat clothing overlay with logo placement.'
    : 'Scenario: Pre-branded background/elements image.'

  const questions = clothingScenario
    ? [
        'Questions:',
        '1. logo_visible',
        '2. logo_accurate',
        '3. logo_placement',
        '4. clothing_logo_no_overflow',
      ]
    : [
        'Questions:',
        '1. logo_visible',
        '2. logo_accurate',
        '3. logo_integrated',
      ]

  const jsonShape = clothingScenario
    ? [
        'Return ONLY valid JSON:',
        '{',
        '  "logo_visible": "YES",',
        '  "logo_accurate": "YES",',
        '  "logo_placement": "YES",',
        '  "clothing_logo_no_overflow": "YES",',
        '  "explanations": {',
        '    "logo_accurate": "Foreground logo content matches the reference"',
        '  }',
        '}',
      ]
    : [
        'Return ONLY valid JSON:',
        '{',
        '  "logo_visible": "YES",',
        '  "logo_accurate": "YES",',
        '  "logo_integrated": "YES",',
        '  "explanations": {',
        '    "logo_integrated": "Logo is naturally integrated without chroma artifacts"',
        '  }',
        '}',
      ]

  return [
    'You are evaluating Step 0 branding assets before person generation.',
    'Answer each question with ONLY: YES, NO, or UNCERTAIN.',
    '',
    ...STEP0_CHROMA_RULES,
    '',
    scenarioLine,
    ...questions,
    '',
    ...jsonShape,
  ].join('\n')
}

export function getStep0BrandingEvalActiveCriteria(
  scenario: Step0BrandingEvalScenario
): Step0BrandingEvalCriterion[] {
  if (scenario === 'clothing') {
    return ['logo_visible', 'logo_accurate', 'logo_placement', 'clothing_logo_no_overflow']
  }
  return ['logo_visible', 'logo_accurate', 'logo_integrated']
}

export function getStep0BrandingEvalCandidateDescription(
  scenario: Step0BrandingEvalScenario
): string {
  if (scenario === 'clothing') {
    return 'Candidate clothing overlay image to evaluate for logo visibility, placement, and overflow.'
  }
  return 'Candidate pre-branded background/elements image to evaluate for logo integration.'
}

export function getStep0BrandingEvalLogoReferenceDescription(): string {
  return [
    'Logo reference image for fidelity comparison.',
    'If the logo uses green chroma, treat it as transparency guidance only.',
  ].join(' ')
}

export function getStep3BrandingEvalQuestions(params: {
  position?: string
  placement?: string
}): string[] {
  const isElements = params.position === 'elements'
  const locationLine = isElements
    ? '- Is the logo placed on the intended scene element (not on the subject)?'
    : '- Is the logo placed in the background?'
  const placement = (params.placement || '').trim() || 'background wall signage'

  return [
    '5. branding_placement',
    `   ${locationLine}`,
    `   - Placement specification: ${placement} (partial occlusion still counts as correctly placed).`,
    '   - Is the logo visibly integrated and at professional head/shoulder height?',
    '   - Is the visible logo content consistent with the provided logo reference?',
    '   - If the person naturally occludes part of the logo, that is acceptable and desirable.',
  ]
}

export function getStep3BrandingAdjustmentSuggestion(): string {
  return 'Correct branding placement/integration: keep one logo in the specified location, preserve exact logo content, and remove chroma artifacts.'
}
