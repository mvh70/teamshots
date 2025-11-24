/**
 * Compose refinement prompt for face matching
 * Structured with Must Follow Rules and Freedom Rules like Step 1
 */
export function composeRefinementPrompt(selfieCount: number): string {
  const structuredPrompt = [
    // Section 1: Intro & Task
    `You're the best photo forger in the world, with an IQ of 145. Your task is to refine the face in the base image to EXACTLY match the ${selfieCount} ${selfieCount === 1 ? 'selfie' : 'selfies'} provided.`,
    '',
    'The selfies are provided in a composite reference image with clear labels (SUBJECT1-SELFIE1, SUBJECT1-SELFIE2, etc.). Study these selfies CAREFULLY - they are the SOURCE OF TRUTH for the face.',
    '',
    
    // Section 2: Must Follow Rules
    'Must Follow Rules:',
    '',
    '- Base Image: Keep the EXACT composition, background, pose, clothing, shot type, and lighting from the base image. ONLY refine the face.',
    '',
    '- Facial Structure: Match the exact bone structure, face shape, and proportions from the selfies. Do not alter or "improve" the face shape.',
    '',
    '- Eyes (CRITICAL): The eyes must be IDENTICAL to the selfies: exact eye shape, size, and spacing; precise eye color and iris pattern; eyelid shape and crease; eyebrow shape, thickness, and color; under-eye characteristics (bags, lines, etc.).',
    '',
    '- Nose: Match the exact nose shape, width, bridge height, and nostril size from the selfies.',
    '',
    '- Mouth and Lips: Exact lip shape, size, cupid\'s bow, and natural lip color. Match any asymmetry or unique characteristics.',
    '',
    '- Skin Characteristics: Include ALL visible features from the selfies: every mole, freckle, and birthmark in their exact locations; scars, blemishes, and skin texture; skin tone and undertones; wrinkles, lines, and age characteristics. Do NOT smooth or perfect the skin.',
    '',
    '- Hair (CRITICAL): Match EXACTLY: hair color, including highlights and natural variations; hair texture (straight, wavy, curly) and thickness; hairline shape and any receding areas; style, length, and how it falls; gray hairs, if present.',
    '',
    '- Facial Hair: Match beard, mustache, or stubble exactly as shown in selfies, including density and color.',
    '',
    '- Expression: Match the natural expression and facial features - do not create an artificial "smile" or "perfect" expression.',
    '',
    '- Reference Images: The selfie composite is for YOUR REFERENCE ONLY. CRITICAL: DO NOT include, embed, paste, or show the original selfie reference images, labels, or composite grid in the final output. Only the refined face should be in the output.',
    '',
    '- Identity Preservation: The goal is to create a face that is INDISTINGUISHABLE from the selfies when compared side-by-side. If someone who knows the person looks at the result, they should immediately recognize it as the same person from the selfies.',
    '',
    '- Composition Integrity: Do NOT change the background, pose, clothing, shot type, or overall lighting. Keep everything except the face identical to the base image.',
    '',
    '- Branding / Logo: If a logo is present on the base layer of the wardrobe and overlaps with the outer layer, hide the parts of the logo that should be covered by the outer layer.',
    '',
    
    // Section 3: Freedom Rules
    'Freedom Rules:',
    '',
    '- You are free to adjust micro-details of facial texture and subtle lighting on the face to ensure the most accurate match with the selfies, while maintaining consistency with the overall scene lighting.'
  ]

  return structuredPrompt.join('\n')
}

