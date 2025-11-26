import { Logger } from '@/lib/logger'

/**
 * V2 Step 7: Compose refinement prompt
 * Focused solely on face matching/refinement using selfie references
 */
export function composeRefinementPrompt(
  selfieCount: number
): string {
  try {
    const structuredPrompt = [
      // Section 1: Intro & Task
      "You are a world-class professional photographer and retoucher. Your task is to refine the face in the base image to perfectly match the identity in the provided selfie references.",
      
      // Section 2: Instructions
      '',
      'Instructions:',
      '- **Face Matching**: The primary goal is to make the person in the base image look EXACTLY like the person in the selfie references. Match facial structure, features, skin tone, and expression nuances.',
      `- **Reference Usage**: You have been provided with a composite of ${selfieCount} selfie images labeled as PRIMARY FACE REFERENCE. Use these as the source of truth for the person's identity.`,
      '- **Preserve Composition**: Do NOT change the pose, lighting, clothing, background, or overall composition of the base image. ONLY refine the face and head to match the identity.',
      '- **Natural Integration**: Ensure the refined face blends naturally with the rest of the body and the scene. Match skin texture and lighting on the face to the rest of the image.',
      
      // Section 3: Quality Guidelines
      '',
      'Quality Guidelines:',
      '- Maintain photorealism. No cartoonish or artistic effects.',
      '- Ensure eyes are realistic and looking in the correct direction (usually at the camera).',
      '- Preserve the age, gender, and ethnicity of the person from the selfies.',
      '- Ensure high-frequency details (skin texture, pores, hair strands) are realistic.'
    ]

    return structuredPrompt.join('\n')
  } catch (error) {
    Logger.error('Failed to compose refinement prompt', {
      error: error instanceof Error ? error.message : String(error)
    })
    // Fallback simple prompt
    return `Refine the face in the base image to exactly match the ${selfieCount} provided selfie references. Keep the rest of the image exactly the same.`
  }
}

