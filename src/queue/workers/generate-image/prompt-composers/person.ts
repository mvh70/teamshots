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
      '- Specific characteristics of the face, like moles, freckles, scars, ',
      '- The form of the eyes, very important',
      '- Hair style, texture, and color must match the selfies exactly - pay special attention to making hair look natural using the selfies as reference. Make some hairs stick out as natural, not all flattened',
      '- Composition: Focus on the person only. No background composition needed in this step.',
      '',
      'REFERENCE IMAGES:',
      '- Selfies are provided in a composite image with clear labels (SUBJECT1-SELFIE1, SUBJECT1-SELFIE2, etc.) for easy reference.',
      '- Use the labeled examples in the composite image as references for the person\'s appearance.',
      '',
      'BRANDING / LOGO INSTRUCTIONS (If logo reference provided separately):',
      '- CRITICAL: The logo MUST be placed on the clothing/upper body area and be clearly visible.',
      '- Logo placement: Position the logo on the chest area of the shirt/t-shirt/polo underneath any jacket layers.',
      '- Logo visibility: The logo must be clearly visible and not obscured by jacket layers unless the jacket is open.',
      '- Logo size: Scale the logo proportionally to the garment (typically 10-15% of chest width).',
      '- Logo integration: Make the logo appear as if it\'s physically printed on the fabric, with proper lighting and perspective.',
      '- IMPORTANT: Do NOT place the logo on the background, walls, accessories, or any non-clothing surfaces.',
      '- If wearing a jacket: Either place logo on visible shirt underneath OR open jacket to reveal logo prominently.'
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


