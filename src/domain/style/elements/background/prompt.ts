import type { BackgroundType, BackgroundValue } from './types'
import { getBackgroundEnvironment } from './config'
import { Logger } from '@/lib/logger'

type BackgroundPrompt = {
  location_type?: string
  color_palette?: string[]
  description?: string
}

interface BackgroundDefinition {
  id: string
  generatePrompt: (settings: Partial<BackgroundValue>) => BackgroundPrompt
}

// ---------------------------------------------------------------------------
// User-selectable backgrounds (headshot1, freepackage, outfit1)
// ---------------------------------------------------------------------------

const OFFICE_BG: BackgroundDefinition = {
  id: 'office',
  generatePrompt: (settings) => ({
    location_type: 'a corporate office environment with natural depth-of-field; keep the subject area primary and the background softly out of focus.',
    description: settings.prompt,
  }),
}

const TROPICAL_BEACH_BG: BackgroundDefinition = {
  id: 'tropical-beach',
  generatePrompt: () => ({
    location_type: 'a tropical beach setting with palm trees and ocean in the background, soft and atmospheric',
  }),
}

const BUSY_CITY_BG: BackgroundDefinition = {
  id: 'busy-city',
  generatePrompt: () => ({
    location_type: 'a busy urban city street with buildings and people in the background, blurred for depth',
  }),
}

const NEUTRAL_BG: BackgroundDefinition = {
  id: 'neutral',
  generatePrompt: (settings) => ({
    location_type: 'a studio with a neutral background',
    color_palette: settings.color ? [settings.color] : undefined,
  }),
}

const GRADIENT_BG: BackgroundDefinition = {
  id: 'gradient',
  generatePrompt: (settings) => ({
    location_type: 'a studio with a gradient background going from light to dark',
    color_palette: settings.color ? [settings.color] : undefined,
  }),
}

const CUSTOM_BG: BackgroundDefinition = {
  id: 'custom',
  generatePrompt: () => ({
    location_type: 'custom uploaded background image',
  }),
}

// ---------------------------------------------------------------------------
// Standard-shots preset backgrounds
// ---------------------------------------------------------------------------

const CAFE_BG: BackgroundDefinition = {
  id: 'cafe',
  generatePrompt: () => ({
    location_type: 'a cozy cafe interior with warm ambient lighting, Edison bulbs, brick and wood textures, blurred for depth',
  }),
}

const OUTDOOR_BG: BackgroundDefinition = {
  id: 'outdoor',
  generatePrompt: () => ({
    location_type: 'a natural outdoor setting with soft natural lighting, blurred greenery and foliage',
  }),
}

const SOLID_BG: BackgroundDefinition = {
  id: 'solid',
  generatePrompt: (settings) => ({
    location_type: 'a studio with a solid color background',
    color_palette: settings.color ? [settings.color] : undefined,
  }),
}

const URBAN_BG: BackgroundDefinition = {
  id: 'urban',
  generatePrompt: () => ({
    location_type: 'an urban street scene with city architecture, concrete textures, and muted urban tones, blurred for depth',
  }),
}

const STAGE_BG: BackgroundDefinition = {
  id: 'stage',
  generatePrompt: () => ({
    location_type: 'a conference stage with subtle LED screen or banner backdrop, soft stage lighting, professional event atmosphere',
  }),
}

const DARK_STUDIO_BG: BackgroundDefinition = {
  id: 'dark_studio',
  generatePrompt: (settings) => ({
    location_type: 'a dark studio with rich charcoal/navy gradient background, hints of mahogany and leather texture',
    color_palette: settings.color ? [settings.color] : undefined,
  }),
}

const TEAM_BRIGHT_BG: BackgroundDefinition = {
  id: 'team_bright',
  generatePrompt: (settings) => ({
    location_type: 'a bright, clean studio with off-white or light brand-color background, subtle gradient for depth',
    color_palette: settings.color ? [settings.color] : undefined,
  }),
}

const LIFESTYLE_BG: BackgroundDefinition = {
  id: 'lifestyle',
  generatePrompt: () => ({
    location_type: 'a soft natural environment with sunny window light, cozy interior or blurred greenery, warm tones',
  }),
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

const BACKGROUND_REPOSITORY = {
  office: OFFICE_BG,
  'tropical-beach': TROPICAL_BEACH_BG,
  'busy-city': BUSY_CITY_BG,
  neutral: NEUTRAL_BG,
  gradient: GRADIENT_BG,
  custom: CUSTOM_BG,
  cafe: CAFE_BG,
  outdoor: OUTDOOR_BG,
  solid: SOLID_BG,
  urban: URBAN_BG,
  stage: STAGE_BG,
  dark_studio: DARK_STUDIO_BG,
  team_bright: TEAM_BRIGHT_BG,
  lifestyle: LIFESTYLE_BG,
} satisfies Record<BackgroundType, BackgroundDefinition>

export function generateBackgroundPrompt(value: BackgroundValue): BackgroundPrompt {
  const definition = BACKGROUND_REPOSITORY[value.type]
  if (!definition) {
    Logger.warn('[BackgroundPrompt] Unknown background type, returning empty prompt', { type: value.type })
    return {}
  }
  return definition.generatePrompt(value)
}

const STUDIO_BACKGROUND_REQUIREMENTS = [
  'Clean, flat studio wall only.',
  'Frontal view, no perspective lines or lines of sight.',
  'No furniture, props, studio equipment, lights, cables, or environmental objects.',
  'Soft, even studio lighting. No visible light sources or light rigs.',
]

const SCENE_BACKGROUND_REQUIREMENTS = [
  'Photorealistic, well-lit scene suitable as a professional headshot background.',
  'Include natural depth appropriate for portrait photography.',
  'Respect scene depth and occlusion for any overlapping objects.',
]

const BACKGROUND_GENERATION_CONSTRAINTS = ['NO people, hands, or body parts.']

const ENVIRONMENTAL_COMPOSITION_RULES = [
  'Background must be softer/blurrier than the subject for depth',
  'Subject must integrate naturally with the background environment',
]

const STUDIO_COMPOSITION_RULES = [
  'Background must be smooth and uniform',
  'No patterns, textures, or additional elements',
]

const GRADIENT_COMPOSITION_RULES = [
  'Gradient must be smooth without banding',
  'Gradient transition must be natural and professional',
]

const CUSTOM_COMPOSITION_RULES = [
  'Use the attached image labeled "background" as the background for the scene',
  'Do not modify or alter the custom background',
  'Subject must be properly integrated with natural lighting/shadows',
]

export type Step2BackgroundMode = 'immutable' | 'studio' | 'environmental'

const STEP2_BACKGROUND_HARD_CONSTRAINTS: Record<Step2BackgroundMode, string[]> = {
  immutable: [
  ],
  studio: [
  ],
  environmental: [
  ],
}

const STEP2_BACKGROUND_COMPOSITING_INSTRUCTIONS: Record<
  Exclude<Step2BackgroundMode, 'environmental'>,
  string[]
> = {
  immutable: [
    '**Compositing Instructions (Immutable Background):**',
    '- Use the attached BACKGROUND REFERENCE as-is. Do not regenerate, repaint, or restyle the background. Natural crop/reframe is allowed when needed for output format, but do not compress.',
    '- Place the person centrally in the background composition.',
    '- Add soft contact shadow and subtle ambient occlusion where subject meets the scene.',
    '- Match visible background lighting first (direction, color temperature, shadow behavior). Use JSON lighting as secondary guidance only.',
    '- Apply subtle global tone matching only when needed for cohesion.',
  ],
  studio: [
    '**Compositing Instructions (Studio Background):**',
    '- Composite the subject into the studio scene defined by the JSON specifications.',
    '- Apply JSON lighting as the primary light source. Do not infer environmental lighting cues.',
    '- Focus on natural subject integration: edge blending, contact shadow, and tonal cohesion.',
  ],
}

export function getStep2BackgroundHardConstraints(mode: Step2BackgroundMode): string[] {
  return [...STEP2_BACKGROUND_HARD_CONSTRAINTS[mode]]
}

function isGradientStudioBackgroundType(backgroundType?: string): boolean {
  return backgroundType === 'gradient'
}

function isFlatStudioBackgroundType(backgroundType?: string): boolean {
  return (
    backgroundType === 'neutral' ||
    backgroundType === 'solid' ||
    backgroundType === 'dark_studio' ||
    backgroundType === 'team_bright'
  )
}

export function getStep2BackgroundColorHardConstraints(params: {
  mode: Step2BackgroundMode
  backgroundType?: string
  primaryBackgroundColor?: string
}): string[] {
  if (params.mode !== 'studio') {
    return []
  }

  if (isGradientStudioBackgroundType(params.backgroundType)) {
    const colorSuffix = params.primaryBackgroundColor
      ? ` Base color: ${params.primaryBackgroundColor}.`
      : ''
    return [
      `5. **Studio Gradient Discipline:** For gradient studio backgrounds, keep the gradient smooth and subtle with no banding.${colorSuffix}`,
      '6. **No Secondary Palette Drift:** Use only tints/shades of the specified base color; do NOT introduce unrelated hues.',
    ]
  }

  if (isFlatStudioBackgroundType(params.backgroundType)) {
    const colorSuffix = params.primaryBackgroundColor ? ` (${params.primaryBackgroundColor})` : ''
    return [
      `5. **Studio Color Uniformity:** Use ONE uniform wall color matching scene.environment.color_palette exactly${colorSuffix}.`,
      '6. **No Secondary Tones:** Do NOT introduce gradients, banding, mottling, vignettes, or color shifts anywhere in the background.',
    ]
  }

  return []
}

export function getStep2BackgroundCompositingInstructions(params: {
  mode: Step2BackgroundMode
  subjectToBackgroundFt: number
}): string[] {
  if (params.mode === 'immutable' || params.mode === 'studio') {
    return [...STEP2_BACKGROUND_COMPOSITING_INSTRUCTIONS[params.mode]]
  }

  return [
    '**Compositing Instructions (Environmental Background):**',
    '',
    '*Ground Plane & Contact:*',
    '- Align the subject crop edge with the scene ground plane/floor surface.',
    '- Add a soft contact shadow directly beneath the subject, strongest near the body and fading outward.',
    '- Apply subtle ambient occlusion where the subject blocks ambient light.',
    '',
    '*Lighting Coherence:*',
    '- Apply JSON lighting spec as the primary key-light guidance.',
    '- Generate environment lighting coherent with scene context and perspective.',
    '- Cast shadows consistent with the implied light direction and quality (hard vs soft).',
    '',
    '*Color & Tone Integration:*',
    '- Match black levels, white points, and mid-tone contrast between subject and background.',
    '- Apply subtle environmental color spill on subject edges when physically plausible.',
    '- Apply a unified global grade so the final looks like a single capture.',
    '',
    '*Depth & Atmosphere:*',
    '- Keep subject tack-sharp and background progressively softer with distance.',
    `- Subject should appear ~${params.subjectToBackgroundFt} feet from the background surface.`,
    '- Maintain coherent perspective and scale for all scene elements.',
  ]
}

export function getStep2BackgroundReferenceDescription(): string {
  return 'BACKGROUND REFERENCE - Use this exact background scene and preserve objects, layout, logos, and text so they remain visible and recognizable.'
}

export function getStep0BackgroundReferenceDescription(): string {
  return 'BACKGROUND REFERENCE (PRIMARY, IMMUTABLE) - Use this as the exact base scene and preserve its composition.'
}

export function getBackgroundGenerationRequirements(value: BackgroundValue): {
  requirements: string[]
  customDetails?: string
} {
  const isStudioType = getBackgroundEnvironment(value.type) === 'studio'

  if (isStudioType) {
    const requirements = [...STUDIO_BACKGROUND_REQUIREMENTS]
    if (value.type === 'gradient') {
      requirements.push('Apply a smooth gradient transition across the wall. No banding or texture artifacts.')
      if (value.color) {
        requirements.push(`Base the gradient on ${value.color}. Transition from a lighter tint to a darker shade of this color only.`)
      }
    } else {
      requirements.push('The wall must be uniform - no texture or patterns.')
      if (value.color) {
        requirements.push(`The wall color must be exactly ${value.color}. Do not deviate from this color — no gradients, no tonal variation, no darker or lighter areas.`)
      }
    }
    return { requirements }
  }

  return {
    requirements: [...SCENE_BACKGROUND_REQUIREMENTS],
    customDetails: value.prompt,
  }
}

export function getBackgroundGenerationConstraints(): string[] {
  return [...BACKGROUND_GENERATION_CONSTRAINTS]
}

export function getBackgroundCompositionMustFollowRules(value: BackgroundValue): string[] {
  const { type, color } = value

  switch (type) {
    case 'office':
    case 'tropical-beach':
    case 'busy-city':
    case 'cafe':
    case 'outdoor':
    case 'urban':
    case 'stage':
    case 'lifestyle':
      return [...ENVIRONMENTAL_COMPOSITION_RULES]
    case 'neutral':
    case 'solid':
    case 'dark_studio':
    case 'team_bright': {
      const rules = [...STUDIO_COMPOSITION_RULES]
      if (color) {
        rules.push(`Background color must be exactly ${color} — no gradients, no tonal variation, uniform across the entire background`)
      }
      return rules
    }
    case 'gradient': {
      const rules = [...GRADIENT_COMPOSITION_RULES]
      if (color) {
        rules.push(`Gradient must be based on ${color} — transition from a lighter tint to a darker shade of this single color only`)
      }
      return rules
    }
    case 'custom':
      return [...CUSTOM_COMPOSITION_RULES]
    default:
      return []
  }
}

/**
 * Project the canonical prompt JSON into the Step 0 background-branding payload.
 * Keeps only the scene/environment+branding contract.
 * Camera data is intentionally excluded for Step 0 asset generation.
 */
export function projectStep0BackgroundBrandingPayload(
  canonicalPrompt: Record<string, unknown>
): Record<string, unknown> {
  const projected: Record<string, unknown> = {}

  const scene = canonicalPrompt.scene as Record<string, unknown> | undefined
  if (scene) {
    const projectedScene: Record<string, unknown> = {}
    if (scene.environment) projectedScene.environment = scene.environment
    if (scene.branding) projectedScene.branding = scene.branding
    if (Object.keys(projectedScene).length > 0) {
      projected.scene = projectedScene
    }
  }

  return projected
}
