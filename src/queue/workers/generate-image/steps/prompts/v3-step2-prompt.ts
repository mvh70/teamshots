export type Step2PromptMode = 'immutable' | 'studio' | 'environmental'

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
    ...realismAndNegativeGuidelines,
  ]
}

export function getStep2BaseImageReferenceDescription(): string {
  return 'BASE IMAGE - Composite this person into the target background. Subtle professional grooming (skin tone balancing, slight under-eye shadow reduction, mild micro-contrast cleanup) is allowed. Do NOT redraw, reshape, or de-age the person.'
}

export function getStep2FaceReferenceDescription(): string {
  return 'FACE REFERENCE - Identity verification only. Confirm the composite face matches this reference. Do NOT redraw features already correct in BASE IMAGE.'
}

export function getStep2BodyReferenceDescription(): string {
  return 'BODY REFERENCE - Proportions verification only. Confirm body proportions are consistent. Do NOT recompose from this reference.'
}
