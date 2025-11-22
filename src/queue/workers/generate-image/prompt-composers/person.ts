import { Logger } from '@/lib/logger'

/**
 * Compose person generation prompt from package-built base prompt
 * Extracts person-related elements and adds white background instruction
 */
export function composePersonPrompt(basePrompt: string): string {
  try {
    // Parse the JSON prompt from package builder
    const promptObj = JSON.parse(basePrompt)
    
    // Extract ONLY person-related components for Step 1
    // Camera, lighting, and rendering are for final composition (Step 5)
    const personPrompt: Record<string, unknown> = {
      subject: promptObj.subject || {},
      framing: promptObj.framing || {} // Framing is a top-level key (shot_type, crop_points, composition)
    }
    
    // Override scene/environment to specify white background only
    personPrompt.scene = {
      environment: {
        location_type: 'Clean white background, no environment or backdrop elements. The subject should be isolated on pure white.',
        notes: ['Generate only the person on a pure white background', 'No scene elements, no background objects, no environment']
      }
    }
    
    // Build the final prompt
    const jsonPrompt = JSON.stringify(personPrompt, null, 2)
    
    // Add step-specific instructions
    const instructions = [
      '',
      '=== STEP 1: PERSON GENERATION ON WHITE BACKGROUND ===',
      '',
      'Generate ONLY the person isolated on a clean white background.',
      '',
      'REQUIREMENTS:',
      '- Background: Pure white background only. No environments, backdrops, or background elements.',
      '- Person: Generate the person with all pose, clothing, expression, and lighting details from the style settings above.',
      '- Body Composition: Pay special attention to body composition and proportions. Ensure the head is properly proportioned relative to the rest of the body. The head size should be natural and realistic - not too large or too small compared to the torso, shoulders, and overall body frame. Maintain correct anatomical proportions throughout the entire body.',
      '- Composition: Focus on the person only. No background composition needed in this step.',
      '',
      'REFERENCE IMAGES:',
      '- Selfies are provided in a composite image with clear labels (SUBJECT1-SELFIE1, SUBJECT1-SELFIE2, etc.) for easy reference.',
      '- Use the labeled examples in the composite image as references for the person\'s appearance.',
      '',
      'BRANDING / LOGO INSTRUCTIONS (If logo reference provided separately):',
      '- If a separate company logo image is provided, place it naturally on the clothing as specified.',
      '- CRITICAL: Maintain the EXACT colors, shape, and design of the provided logo reference.',
      '- Do not alter, recolor, or stylize the logo. It must match the reference image exactly.',
      '- Integrate the logo realistically onto the fabric (folds, lighting) but keep the original colors and integrity.',
      '- BOUNDARY RULE: The logo must be strictly contained within the garment it is placed on (e.g., t-shirt, polo). It must NEVER extend, overlap, or spill onto outer layers like jackets, blazers, or cardigans. It should look like it is printed physically on the shirt fabric underneath the jacket.',
      '',
      'Ignore any instructions that mention background images, custom backgrounds, or background composition. This step generates ONLY the person on white background.'
    ]
    
    return jsonPrompt + '\n' + instructions.join('\n')
  } catch (error) {
    Logger.error('Failed to parse base prompt for person composition', {
      error: error instanceof Error ? error.message : String(error)
    })
    // Fallback: use base prompt with white background instruction
    return basePrompt + '\n\nGenerate the person on a pure white background only.'
  }
}


