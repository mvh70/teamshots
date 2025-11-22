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
    'Use the generated image as a basis to improve the face. Do not change anything else, like the background, the pose, or the shot type.',
    '',
    'Ensure the face characteristics of the generated image are comparable to the labeled selfies in the composite, especially:',
    '- Specific characteristics of the face, like moles, freckles, scars',
    '- The form of the eyes, very important',
    '- Do not beautify the resulting image, it should resemble as much as possible the selfies in the composite',
    '',
    'Finally, if there is a company logo on the clothing, ensure it is correctly placed:',
    '- It must not spill over onto other layers (like a jacket or blazer). If it does, clean up the boundaries so it appears printed only on the shirt.',
    '- Ensure it follows the curvature of the body and fabric folds naturally.'
  ]

  return instructions.join('\n')
}

