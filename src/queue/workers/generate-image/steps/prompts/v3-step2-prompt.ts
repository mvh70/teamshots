export type Step2PromptMode = 'immutable' | 'studio' | 'environmental'
export type Step2RetouchingLevel = 'none' | 'light' | 'medium' | 'high'

export function getStep2Intro(mode: Step2PromptMode): string[] {
  return [
    'You are a world-class graphics professional specializing in photo realistic composition and integration.',
    mode === 'immutable'
      ? 'Your task is to take the person from the attached image labeled "BASE IMAGE" (currently on a grey background) and composite them naturally into the attached image labeled "BACKGROUND REFERENCE".'
      : 'Your task is to take the person from the attached image labeled "BASE IMAGE" (currently on a grey background) and composite them naturally into the scene specified below.',
    'The person is the primary subject and the background is the secondary subject.',
  ]
}

export function getStep2PersonProminenceInstructions(prominenceLabel: string): string[] {
  return [
    '**Person Prominence:**',
    `- Person must be DOMINANT in frame (${prominenceLabel} of image height minimum).`,
    '- Person must remain larger and more visually important than background elements.',
    '- Match implied camera height and perspective so the person feels naturally placed in-scene.',
  ]
}

export function getStep2RealismAndNegativeGuidelines(): string[] {
  return [
    '- Maintain phone-camera realism with subtle sensor grain and slight edge softness.',
    '- Edges where subject meets background must be clean and natural (no glow, halo, fringe, or artificial sharpening artifacts).',
    '- Negatives: avoid AI glow, plastic skin, skincare-ad look, cinematic lighting, visible studio equipment, pastel/faded colors, flat lighting, cartoon/3D style, and new logos/text not present in references.',
  ]
}

export function getStep2QualityGuidelines(realismAndNegativeGuidelines: string[]): string[] {
  return [
    '- Maintain the photorealistic quality of the original person.',
    '- Ensure the final image looks like a single, naturally-taken photograph.',
    '- Match color temperature and tone between subject and background.',
    '- Preserve existing skin micro-details from BASE IMAGE exactly; do not invent or remove pores, moles, freckles, blemishes, scars, wrinkles, or pigmentation shifts.',
    ...realismAndNegativeGuidelines,
  ]
}

export function getStep2BaseImageReferenceDescription(
  retouchingLevel?: Step2RetouchingLevel,
  hasSelfieComposite?: boolean
): string {
  if (retouchingLevel && retouchingLevel !== 'none') {
    const resemblanceRef = hasSelfieComposite
      ? ' Use the SELFIE COMPOSITE to verify face resemblance.'
      : ''
    return `BASE IMAGE - Composite this person into the target background and apply retouching as specified in Element Constraints.${resemblanceRef} Keep permanent identity markers unchanged and do NOT reshape or de-age beyond what retouching rules allow.`
  }

  return 'BASE IMAGE - Composite this person into the target background with no retouching or skin grooming. Treat BASE IMAGE as source of truth for skin detail. Do NOT add, remove, or invent pores, moles, freckles, blemishes, scars, wrinkles, or pigmentation changes. Do NOT redraw, reshape, or de-age the person.'
}

export function getStep2SelfieCompositeReferenceDescription(): string {
  return 'SELFIE COMPOSITE - Original selfie reference for identity resemblance verification. Compare the final result against this reference to ensure the person is recognizable. Do NOT copy background or composition from this reference.'
}

export function getStep2FaceReferenceDescription(retouchingLevel?: Step2RetouchingLevel): string {
  if (retouchingLevel && retouchingLevel !== 'none') {
    return 'FACE REFERENCE - Use for identity resemblance refinement. Refine the face to closely match this reference while applying retouching as specified in Element Constraints.'
  }

  return 'FACE REFERENCE - Identity verification only (macro features). Confirm the composite face matches this reference. Do NOT transfer skin texture or skin marks from FACE REFERENCE when they are not visible in BASE IMAGE.'
}

export function getStep2BodyReferenceDescription(): string {
  return 'BODY REFERENCE - Proportions verification only. Confirm body proportions are consistent. Do NOT recompose from this reference.'
}
