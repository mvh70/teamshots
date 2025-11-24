import { Logger } from '@/lib/logger'

/**
 * Compose person generation prompt from package-built base prompt
 * Extracts person-related elements and adds white background instruction
 */
export function composePersonPrompt(
  basePrompt: string
): string {
  try {
    // Split base prompt into JSON and rules sections
    const parts = basePrompt.split('## Rules to Follow')
    const jsonPart = parts[0].trim()
    const rulesText = parts[1]?.trim() || ''
    
    // Parse the JSON prompt from package builder
    const promptObj = JSON.parse(jsonPart)
    
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
    
    // Build the person setting JSON
    const personSettingJson = JSON.stringify(personPrompt, null, 2)
    
    // Parse rules from the base prompt (numbered list format)
    const extractedRules: string[] = []
    if (rulesText) {
      const ruleLines = rulesText.split('\n').filter(line => line.trim())
      for (const line of ruleLines) {
        // Match lines starting with number and period (e.g., "1. Rule text")
        const match = line.match(/^\d+\.\s+(.+)$/)
        if (match && match[1]) {
          extractedRules.push(match[1])
        }
      }
    }
    
    // Build the structured prompt with four distinct sections
    const structuredPrompt = [
      // Section 1: Intro & Task
      "You're the best photo forger in the world, with an IQ of 145. Your task is to make an image of a person, from the attached selfies. Below first you'll find a JSON describing the pose and clothes of the person. Below that there are rules you must absolutely follow.",

      // Section 2: Person Setting JSON
      '',
      'Person Setting JSON',
      personSettingJson,

      // Section 3: Must Follow Rules
      '',
      'Must Follow Rules:',
      '- Background: Pure white background only. No environments, backdrops, or background elements.',
      '- Person: Generate the person with all pose, clothing, expression, and lighting details from the person setting JSON above.',
      '- Body Composition: Pay special attention to body composition and proportions. Ensure the head is properly proportioned relative to the rest of the body. The head size should be natural and realistic - not too large or too small compared to the torso, shoulders, and overall body frame. Maintain correct anatomical proportions throughout the entire body.',
      '- Face Characteristics: Preserve specific characteristics of the face, like moles, freckles, scars.',
      '- Eyes: Pay special attention to the form of the eyes, which are very important for identity.',
      '- Hair: Hair style, texture, and color must match the selfies exactly - pay special attention to making hair look natural using the selfies as reference. Make some hairs stick out as natural, not all flattened.',
      '- Identity Preservation: Stay as close as possible to the original selfies. Do not invent details unless indicated specifically. If the selfies do not show glasses, do not add glasses. Keep the hairstyle as much as possible as in the selfies.',
      '- Reference Images: Reference images are supplied with clear labels. Inside the stacked selfie reference, choose the face that best matches the requested pose and lighting as the primary likeness. Use the remaining selfies to reinforce 3D facial structure, hair, glasses, and fine details. Do not show the original selfies in the final image.',
      '- Composition: Focus on the person only. No background composition needed in this step.'
    ]
    
    // Add extracted rules from base prompt (e.g., branding rules)
    if (extractedRules.length > 0) {
      for (const rule of extractedRules) {
        structuredPrompt.push(`- ${rule}`)
      }
    }
    
    // Section 4: Freedom Rules
    structuredPrompt.push('')
    structuredPrompt.push('Freedom Rules:')
    structuredPrompt.push('- You are free to optimize lighting and micro-details to ensure realistic 3D volume and texture, provided the person is isolated on white.')

    return structuredPrompt.join('\n')
  } catch (error) {
    Logger.error('Failed to parse base prompt for person composition', {
      error: error instanceof Error ? error.message : String(error)
    })
    // Fallback: use base prompt with white background instruction
    return basePrompt + '\n\nGenerate the person on a pure white background only.'
  }
}


