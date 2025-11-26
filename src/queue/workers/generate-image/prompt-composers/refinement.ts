import { Logger } from '@/lib/logger'

/**
 * V3 Step 2 (formerly Step 3): Compose refinement/composition prompt
 * Takes person on white background and adds scene/camera/lighting/rendering
 * Also refines face using selfie references and applies evaluator feedback
 * Note: Subject is excluded since person is already generated
 */
export function composeRefinementPrompt(
  backgroundPromptObj: Record<string, unknown>,
  brandingRules?: string[],
  evaluatorComments?: string[],
  includeFaceRefinement = false
): string {
  try {
    const jsonPrompt = JSON.stringify(backgroundPromptObj, null, 2)
    
    // Build the structured prompt for background composition
    const structuredPrompt = [
      // Section 1: Intro & Task
      "You are a world-class professional photographer specializing in photo composition and natural integration. Your task is to take the person from the base image (currently on a white background) and composite them naturally into the scene specified below, applying the camera, lighting, and rendering specifications.",

      // Section 2: Scene Specifications (NO subject - person already generated)
      '',
      'Scene, Camera, Lighting & Rendering Specifications:',
      jsonPrompt,

      // Section 3: Composition Rules
      '',
      'Composition Rules:',
      '- **Preserve the Person**: Keep the person from the base image EXACTLY as is. Do NOT change their face, body, pose, clothing, or any person-specific details (including any logo/branding already on clothing).',
      '- **Replace Background**: Remove the white background and replace it with the background specified in the Scene Specifications above.',
      '- **Natural Integration**: Ensure the person blends naturally with the new background. Match lighting, shadows, perspective, and scale.',
      '- **Lighting Consistency**: Adjust the lighting on the person to match the background lighting. Add appropriate shadows and highlights.',
      '- **Depth & Realism**: Create realistic depth by ensuring the person appears to exist in the same 3D space as the background.',
      '- **No Artifacts**: Ensure no visible seams, halos, or compositing artifacts around the person.'
    ]
    
    // Add face refinement instructions if requested
    if (includeFaceRefinement) {
      structuredPrompt.push(
        '- **Face Refinement**: Use the provided face reference images to refine facial features. Match eyes, nose, mouth, skin tone, and overall facial structure precisely. Ensure the face looks natural and matches the reference faces exactly.'
      )
    }
    
    // Add branding rules for background/elements branding (if provided)
    if (brandingRules && brandingRules.length > 0) {
      for (const rule of brandingRules) {
        structuredPrompt.push(`- ${rule}`)
      }
    }
    
    // Add evaluator feedback/comments if provided
    if (evaluatorComments && evaluatorComments.length > 0) {
      structuredPrompt.push('', 'Refinement Instructions (from previous evaluations):')
      for (const comment of evaluatorComments) {
        structuredPrompt.push(`- ${comment}`)
      }
    }
    
    structuredPrompt.push(
      '',
      // Section 4: Quality Guidelines
      'Quality Guidelines:',
      '- Maintain the photorealistic quality of the original person.',
      '- Ensure the final image looks like a single, naturally-taken photograph.',
      '- Pay special attention to edges and transitions between the person and background.',
      '- Match color temperature and tone between foreground and background.'
    )

    return structuredPrompt.join('\n')
  } catch (error) {
    Logger.error('Failed to compose background composition prompt', {
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

