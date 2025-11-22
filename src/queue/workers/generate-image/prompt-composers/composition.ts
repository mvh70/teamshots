import { Logger } from '@/lib/logger'

/**
 * Compose composition prompt from package-built base prompt and scene specifications
 * Uses full base prompt with scene specifications and adds integration instructions
 */
export function composeCompositionPrompt(
  basePrompt: string,
  hasCustomBackground: boolean,
  aspectRatioDescription?: string
): string {
  try {
    // Parse the JSON prompt from package builder
    const promptObj = JSON.parse(basePrompt)
    
    // Build composition prompt with scene-related elements only
    // Subject is already generated in Step 1, so we only need:
    // - scene (environment, background)
    // - framing (shot_type, crop_points, composition)
    // - camera (lens, focal_length, depth_of_field, etc.)
    // - lighting (all lighting specifications)
    // - rendering (rendering settings)
    const compositionPrompt: Record<string, unknown> = {
      scene: promptObj.scene || {},
      framing: promptObj.framing || {},
      camera: promptObj.camera || {},
      lighting: promptObj.lighting || {},
      rendering: promptObj.rendering || {}
    }
    
    const jsonPrompt = JSON.stringify(compositionPrompt, null, 2)
    
    // Add step-specific instructions
    const instructions = [
      '',
      '=== STEP 5: PERSON + BACKGROUND COMPOSITION ===',
      '',
      'Combine the person from the first reference image with the specified background.',
      '',
      'REQUIREMENTS:',
      '- Integration: Blend the person naturally with the background. Ensure consistent lighting, perspective, and scale.',
      '- Scene Specifications: Apply ALL specifications from the JSON above (framing, camera, lighting, rendering, scene).',
      '- Quality: Ensure professional appearance with no visible seams, artifacts, or compositing errors.',
      hasCustomBackground 
        ? '- Background: Use the provided background image reference.'
        : '- Background: Generate the background as specified in the scene environment description.',
      aspectRatioDescription 
        ? `- Format Frame (${aspectRatioDescription}): The FORMAT reference image defines the exact output bounds. Compose the final image so all important content stays inside this frame without cropping.`
        : '',
      '',
      'The person should appear naturally placed in the scene with proper integration.'
    ].filter(line => line !== '')
    
    return jsonPrompt + '\n' + instructions.join('\n')
  } catch (error) {
    Logger.error('Failed to parse base prompt for composition', {
      error: error instanceof Error ? error.message : String(error)
    })
    // Fallback: use base prompt with composition instruction
    return basePrompt + '\n\nCombine the person with the background ensuring natural integration.'
  }
}

