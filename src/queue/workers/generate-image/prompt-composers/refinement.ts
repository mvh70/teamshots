/**
 * Compose refinement prompt for face matching
 * Minimal, focused instructions to refine facial features only
 */
export function composeRefinementPrompt(selfieCount: number): string {
  const instructions = [
    `I have uploaded an image generated from ${selfieCount} ${selfieCount === 1 ? 'selfie' : 'selfies'}.`,
    '',
    'The selfies are provided in a single composite image with clear labels (SUBJECT1-SELFIE1, SUBJECT1-SELFIE2, etc.) for easy reference.',
    '',
    'Use the selfies as a reference to swap the face in the generated image. Do not change anything else, like the background, the pose, or the shot type.',
    '',
    'Ensure the face characteristics of the generated image are exactly the same as in the labeled selfies in the composite, especially:',
    '- Specific characteristics of the face, like moles, freckles, scars',
    '- The form of the eyes, very important',
    '- Hair style, texture, and color must match the selfies exactly - pay special attention to making hair look natural using the selfies as reference',
    '- Do not beautify the resulting image, it should resemble as much as possible the selfies in the composite',

    'Branding / Logo instructions (If logo reference provided separately):',
    '- If the logo is present on the base layer of the wardrobe, and overlaps over the toplayer, hide the parts of the logo that should be covered by the outer layer. ',
  ]

  return instructions.join('\n')
}

