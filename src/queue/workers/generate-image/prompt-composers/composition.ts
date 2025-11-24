import { Logger } from '@/lib/logger'
import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Compose composition prompt from package-built base prompt and scene specifications
 * Uses full base prompt with scene specifications and adds integration instructions
 */
export function composeCompositionPrompt(
  basePrompt: string,
  hasCustomBackground: boolean,
  aspectRatioDescription?: string,
  styleSettings?: PhotoStyleSettings,
  shotDescription?: string
): string {
  try {
    // Split base prompt into JSON and rules sections
    const parts = basePrompt.split('## Rules to Follow')
    const jsonPart = parts[0].trim()
    
    // Parse the JSON prompt from package builder
    const promptObj = JSON.parse(jsonPart)
    
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
    const instructionLines: string[] = [
      '',
      '=== STEP 5: PERSON + BACKGROUND COMPOSITION ===',
      '',
      'Combine the person from the first reference image with the specified background.',
      '',
      'REQUIREMENTS:',
      '- Integration: Blend the person naturally with the background. Ensure consistent lighting, perspective, and scale.',
      '- Scene Specifications: Apply ALL specifications from the JSON above (framing, camera, lighting, rendering, scene).',
      '- Quality: Ensure professional appearance with no visible seams, artifacts, or compositing errors.'
    ]

    // Add custom background rule if applicable
    if (hasCustomBackground) {
      instructionLines.push(
        '- **Custom Background:** Use the provided custom background image and match the background to the final aspect ratio determined by the FORMAT frame.'
      )
    } else {
      instructionLines.push(
        '- Background: Generate the background as specified in the scene environment description.'
      )
    }

    // Add branding rules if branding is on background or elements
    if (styleSettings?.branding?.type === 'include' && 
        styleSettings.branding.position && 
        ['background', 'elements'].includes(styleSettings.branding.position)) {
      instructionLines.push(
        '- **Branding:** Place the logo exactly once following the BRANDING guidance from the reference assets. Recreate the placement faithfully and ensure the composite reference itself is not visible in the final image.'
      )
    }

    // Add format frame rule
    if (aspectRatioDescription) {
      const shotDesc = shotDescription ? shotDescription.toLowerCase() : 'image'
      instructionLines.push(
        `- **Format Frame (${aspectRatioDescription}):** This empty frame defines the exact output bounds. Compose the final ${shotDesc} so all important content stays inside this frame without cropping.`
      )
    }

    instructionLines.push('')
    
    // Add final instruction about respecting shot type and aspect ratio
    if (aspectRatioDescription) {
      const shotDesc = shotDescription || 'image'
      instructionLines.push(
        `Respect the requested shot type (${shotDesc}) and match the ${aspectRatioDescription} aspect ratio exactly by following the FORMAT frame.`
      )
    } else {
      instructionLines.push(
        'The person should appear naturally placed in the scene with proper integration.'
      )
    }

    const instructions = instructionLines.filter(line => line !== '')
    
    return jsonPrompt + '\n' + instructions.join('\n')
  } catch (error) {
    Logger.error('Failed to parse base prompt for composition', {
      error: error instanceof Error ? error.message : String(error)
    })
    // Fallback: use base prompt with composition instruction
    return basePrompt + '\n\nCombine the person with the background ensuring natural integration.'
  }
}

