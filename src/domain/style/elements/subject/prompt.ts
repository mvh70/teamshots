import type { DemographicProfile } from '@/domain/selfie/selfieDemographics'

export interface SubjectPersonPromptInput {
  selfieCount: number
  hasFaceComposite: boolean
  hasBodyComposite: boolean
  demographics?: DemographicProfile
}

export interface SubjectCompositionPromptInput {
  hasFaceComposite: boolean
  hasBodyComposite: boolean
}

export const SUBJECT_IDENTITY_RULES = [
  'Use the uploaded composite images as a strict identity source.',
  '- Hyper-realistic skin texture with visible pores and natural micro-details.',
  '- Preserve authentic appearance including moles, scars, freckles.',
  '- Preserve eye, hair, and lip color, shape, and texture.',  
  '- Groom the subject slighly for professional look. Make the subject look energectic, radiating energy and freshness, eg if there are eye bags under the eyes, make them less prominent (but keep them), make the hair groomed for photos, remove any sign of tiredness, make the person look like the best version of themselves without changing them.',
  'Build the rest of the anatomy carefully from the body references; avoid distorted hands, extra fingers, or malformed limbs.',
  '- For females, preserve chest/breast shape naturally.',
  '- For males, preserve chest shape naturally.',
  '-Preserve accessories shown in the selfies. Do NOT add accessories not shown in selfies (glasses, earrings, watches).',
]

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
  const identityPayload: Record<string, unknown> = {
    source: 'Use the attached composites as a reference. Select ONE selfie as primary face basis - never average or blend faces into a new person. The result must be instantly recognizable as this specific person',
  }

  
  if (composites.length > 0) {
    identityPayload.composites = composites
  }

  // Keep these as structured subject prompt constraints in JSON payload.
  identityPayload.hard_requirements = SUBJECT_IDENTITY_RULES

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
    refinement_goal: 'Refine the face so that it resembles the person in the selfies.',
    skin_quality:
      'Make the skin hyper realistic, with visible pores, moles, and natural imperfections. Avoid the plastic skin look.',
    grooming:
      'Groom the subject slightly for a professional look: make them look energetic and fresh, reduce under-eye bags slightly (without removing them), groom hair for photos, remove signs of tiredness, and keep the person recognizably the same.',
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
