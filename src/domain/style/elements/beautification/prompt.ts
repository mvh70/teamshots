import type { BeautificationAccessorySettings, BeautificationValue, RetouchingLevel } from './types'

function normalizeRetouchingLevel(level: RetouchingLevel | 'max' | undefined): RetouchingLevel {
  if (level === 'max') return 'high'
  return level || 'light'
}

const RETOUCHING_RULES: Record<RetouchingLevel, string[]> = {
  none: [
    'Do not apply beautification. Keep natural skin texture, pores, fine lines, temporary blemishes, under-eye details, and flyaway hairs exactly as in BASE IMAGE (step1a). Use selfies for identity verification only.',
    'Do not perform skin smoothing, dark-circle reduction, blemish cleanup, tone-evening, or teeth/eye whitening.',
  ],
  light: [
    'Apply light retouching only with minimal edits: remove only temporary blemishes and very small distractions.',
    'Soften under-eye shadows very slightly while preserving natural folds and detail.',
    'Apply subtle skin-tone evening while preserving pores, fine lines, and natural texture.',
    'Keep permanent identity markers (moles, freckles, scars) unchanged.',
    'Do not alter face shape, jawline, nose, eyes, lips, or any facial proportions.',
  ],
  medium: [
    'Apply medium retouching: balanced temporary blemish cleanup plus moderate under-eye shadow reduction.',
    'Even skin tone and reduce blotchy contrast while preserving realistic pore texture.',
    'Tame minor flyaway hairs around the face while keeping natural hairline and hairstyle.',
    'Allow only subtle teeth brightening when visible; keep tooth shape and smile geometry unchanged.',
    'Keep permanent identity markers (moles, freckles, scars) unchanged and preserve facial proportions.',
  ],
  high: [
    'Apply high retouching for a polished corporate portrait: thorough temporary blemish cleanup, stronger under-eye shadow correction, and stronger skin-tone evening.',
    'Smooth skin more than medium level, but keep realistic pore texture and avoid plastic or waxy skin appearance.',
    'Clean up visible flyaways and lightly brighten teeth/eye sclera when visible, without changing natural color balance aggressively.',
    'Do not reshape facial geometry or alter identity; preserve recognizable facial features, facial proportions, and permanent identity markers.',
  ],
}

const RETOUCHING_FIXES: Record<RetouchingLevel, string[]> = {
  none: [],
  light: ['temporary_blemish_cleanup', 'slight_dark_circle_softening', 'subtle_skin_tone_evening'],
  medium: [
    'temporary_blemish_cleanup',
    'moderate_dark_circle_reduction',
    'balanced_skin_tone_evening',
    'minor_flyaway_cleanup',
    'subtle_teeth_brightening',
  ],
  high: [
    'temporary_blemish_cleanup',
    'strong_dark_circle_reduction',
    'strong_skin_tone_evening',
    'enhanced_skin_smoothing_with_texture_preserved',
    'flyaway_cleanup',
    'subtle_teeth_and_eye_sclera_brightening',
  ],
}

const ACCESSORY_RULES: Record<keyof BeautificationAccessorySettings, string> = {
  glasses: 'glasses',
  facialHair: 'facial hair',
  jewelry: 'jewelry',
  piercings: 'piercings',
  tattoos: 'visible tattoos',
}

function buildAccessoryRules(
  accessories?: BeautificationAccessorySettings
): string[] {
  if (!accessories) return []

  const rules: string[] = []

  for (const [key, value] of Object.entries(accessories) as Array<
    [keyof BeautificationAccessorySettings, { action: 'keep' | 'remove' } | undefined]
  >) {
    if (!value) continue

    const label = ACCESSORY_RULES[key]
    if (value.action === 'remove') {
      const smoothSkinNote = key === 'facialHair'
        ? ' The skin where facial hair was removed must be clean and smooth with no stubble, shadow, or added skin imperfections.'
        : ''
      rules.push(`Remove ${label} if present while preserving natural anatomy and realism.${smoothSkinNote}`)
    } else {
      rules.push(`Preserve ${label} exactly as shown in the selfie references.`)
    }
  }

  return rules
}

export function generateBeautificationPrompt(value: BeautificationValue): {
  mustFollow: string[]
  retouchingMustFollow: string[]
  accessoryMustFollow: string[]
  payload: Record<string, unknown>
  metadata: Record<string, unknown>
} {
  const retouching = normalizeRetouchingLevel(value.retouching as RetouchingLevel | 'max' | undefined)
  const retouchingRules = RETOUCHING_RULES[retouching]
  const accessoryRules = buildAccessoryRules(value.accessories)

  const mustFollow = [...retouchingRules, ...accessoryRules]

  return {
    mustFollow,
    retouchingMustFollow: retouchingRules,
    accessoryMustFollow: accessoryRules,
    payload: {
      subject: {
        beautification: {
          retouching: {
            level: retouching,
            fixes: RETOUCHING_FIXES[retouching],
          },
          accessories: value.accessories ?? {},
        },
      },
    },
    metadata: {
      retouching,
      fixes: RETOUCHING_FIXES[retouching],
      accessoriesConfigured: Object.keys(value.accessories ?? {}).length,
    },
  }
}
