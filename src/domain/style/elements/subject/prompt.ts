import type { DemographicProfile } from '@/domain/selfie/selfieDemographics'

export interface SubjectPersonPromptInput {
  selfieCount: number
  hasFaceComposite: boolean
  hasBodyComposite: boolean
  demographics?: DemographicProfile
  hasBeautification?: boolean
  preferSoftSmileSelfie?: boolean
}

export interface SubjectCompositionPromptInput {
  hasFaceComposite: boolean
  hasBodyComposite: boolean
  hasBeautification?: boolean
  preferSoftSmileSelfie?: boolean
}

const SUBJECT_GROOMING_RULE =
  '- Groom the subject slighly for professional look. Make the subject look energectic, radiating energy and freshness, eg if there are eye bags under the eyes, make them less prominent (but keep them), make the hair groomed for photos, remove any sign of tiredness, make the person look like the best version of themselves without changing them.'
const SUBJECT_ACCESSORY_RULE =
  '-Preserve accessories shown in the selfies. Do NOT add accessories not shown in selfies (glasses, earrings, watches).'

export const SUBJECT_IDENTITY_RULES = [
  'Use the uploaded composite images as a strict identity source.',
  '- Hyper-realistic skin texture with visible pores and natural micro-details.',
  '- Preserve authentic appearance including moles, scars, freckles.',
  '- Preserve eye, hair, and lip color, shape, and texture.',  
  SUBJECT_GROOMING_RULE,
  'Build the rest of the anatomy carefully from the body references; avoid distorted hands, extra fingers, or malformed limbs.',
  '- For females, preserve chest/breast shape naturally.',
  '- For males, preserve chest shape naturally.',
  SUBJECT_ACCESSORY_RULE,
]

function getSubjectIdentityRules(hasBeautification?: boolean): string[] {
  if (!hasBeautification) {
    return SUBJECT_IDENTITY_RULES
  }

  return SUBJECT_IDENTITY_RULES.filter(
    (rule) => rule !== SUBJECT_GROOMING_RULE && rule !== SUBJECT_ACCESSORY_RULE
  )
}

function buildSubjectComposites(input: SubjectPersonPromptInput): string[] {
  const composites: string[] = []
  const hasCombinedOnly = !input.hasFaceComposite && !input.hasBodyComposite

  if (input.hasFaceComposite) {
    composites.push('FACE COMPOSITE for facial structure, features, skin texture')
  }
  if (input.hasBodyComposite) {
    composites.push('BODY COMPOSITE for body proportions, posture, hands')
  }
  if (hasCombinedOnly) {
    composites.push('SELFIE COMPOSITE as reference for complete subject')
  }

  return composites
}

function buildDemographicGuidance(
  demographics?: DemographicProfile
): Record<string, unknown> | undefined {
  if (!demographics) return undefined

  const guidance: Record<string, unknown> = {}

  if (demographics.gender) {
    guidance.gender = demographics.gender
  }
  if (demographics.ageRange) {
    guidance.age_range = demographics.ageRange
  }
  if (demographics.ethnicity) {
    guidance.ethnicity = demographics.ethnicity.replace(/_/g, ' ')
  }

  if (Object.keys(guidance).length === 0) {
    return undefined
  }

  guidance.note = 'Supplementary context only. Selfie references remain the primary source of truth for identity.'
  return guidance
}

export function generateSubjectPersonPrompt(input: SubjectPersonPromptInput): {
  mustFollow: string[]
  identityPayload: Record<string, unknown>
  demographicGuidance?: Record<string, unknown>
} {
  const composites = buildSubjectComposites(input)
  const demographicGuidance = buildDemographicGuidance(input.demographics)
  const primarySelfieGuidance = input.preferSoftSmileSelfie
    ? 'Select ONE selfie as primary face basis, prioritizing the selfie that most closely matches a soft smile expression. Never average or blend faces into a new person.'
    : 'Select ONE selfie as primary face basis - never average or blend faces into a new person.'
  const identityPayload: Record<string, unknown> = {
    source: `Use the attached composites as a reference. ${primarySelfieGuidance} The result must be instantly recognizable as this specific person`,
  }

  
  if (composites.length > 0) {
    identityPayload.composites = composites
  }

  // Keep these as structured subject prompt constraints in JSON payload.
  identityPayload.hard_requirements = getSubjectIdentityRules(input.hasBeautification)

  if (input.selfieCount === 0) {
    return { mustFollow: [], identityPayload, demographicGuidance }
  }

  return {
    mustFollow: [],
    identityPayload,
    demographicGuidance,
  }
}

export function generateSubjectCompositionPrompt(input: SubjectCompositionPromptInput): {
  mustFollow: string[]
  identityPayload: Record<string, unknown>
} {
  const identityPayload: Record<string, unknown> = {
    source: 'The subject comes from the attached step1a image.',
    refinement_goal: input.preferSoftSmileSelfie
      ? 'Refine facial resemblance using selfies for macro identity only (facial structure, proportions, expression), using the most soft-smile-like selfie as the expression baseline. Do not synthesize new micro skin details.'
      : 'Refine facial resemblance using selfies for macro identity only (facial structure and proportions). Do not synthesize new micro skin details.',
    skin_quality:
      'Preserve skin exactly as visible in STEP1A/BASE IMAGE. Do NOT add, remove, or invent pores, moles, freckles, blemishes, scars, wrinkles, or pigmentation changes. If a detail is not clearly visible in STEP1A/BASE IMAGE, do not introduce it.',
    selfie_reference_scope:
      'Use selfies to verify identity resemblance only; do not transfer or invent new skin marks from selfies.',
  }
  if (!input.hasBeautification) {
    identityPayload.grooming =
      'Groom the subject slightly for a professional look while keeping the person recognizably the same. Keep hair tidy if needed, but do not retouch skin or alter under-eye details.'
  }

  const composites: string[] = []
  const hasCombinedOnly = !input.hasFaceComposite && !input.hasBodyComposite
  if (input.hasFaceComposite) {
    composites.push('FACE COMPOSITE to refine head shape, facial structure, proportions')
  }
  if (input.hasBodyComposite) {
    composites.push('BODY COMPOSITE to adjust body proportions and hands')
  }
  if (hasCombinedOnly) {
    composites.push('SELFIE COMPOSITE as reference for complete subject')
  }
  if (composites.length > 0) {
    identityPayload.composites = composites
  }

  return {
    mustFollow: [],
    identityPayload,
  }
}
