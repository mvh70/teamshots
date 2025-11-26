import { Logger } from '@/lib/logger'
import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Compose composition prompt from package-built base prompt (JSON only) and element rules
 * Base prompt contains only JSON - rules are passed separately from elements
 * Backward compatible: if rules are embedded in basePrompt (V2), they will be extracted
 */
export function composeCompositionPrompt(
  basePrompt: string, // JSON only (no rules) for V3, or JSON + rules for V2 (backward compat)
  aspectRatioDescription?: string,
  styleSettings?: PhotoStyleSettings,
  shotDescription?: string,
  mustFollowRules?: string[], // Rules from elements (V3)
  freedomRules?: string[] // Freedom rules from elements (V3)
): string {
  try {
    // Check if basePrompt contains rules section (V2 backward compatibility)
    const parts = basePrompt.split('## Rules to Follow')
    const jsonPart = parts[0].trim()
    const rulesSection = parts[1] ? parts[1].trim() : ''
    
    // Parse the JSON prompt from package builder
    const promptObj = JSON.parse(jsonPart)
    
    // For V3: Use the complete prompt object (includes subject, scene, framing, camera, lighting, rendering)
    // This is a full composition in one call, not split like V2
    const jsonPrompt = JSON.stringify(promptObj, null, 2)
    
    // Build the structured prompt with four distinct sections
    const structuredPrompt = [
      // Section 1: Intro & Task
      "You are a world-class professional photographer with an IQ of 145, specializing in corporate and professional portraits. Your task is to create a photorealistic portrait composition from the attached selfies and scene specifications. Below first you'll find a JSON describing the complete scene, subject, framing, camera, lighting, and rendering. Below that there are rules you must absolutely follow.",

      // Section 2: Composition JSON
      '',
      'Composition JSON',
      jsonPrompt,

      // Section 3: Must Follow Rules
      '',
      'Must Follow Rules:',
      '- Scene Specifications: Apply ALL specifications from the JSON above (scene, framing, camera, lighting, rendering, subject).',
      '- Integration: Blend the person naturally with the background. Ensure consistent lighting, perspective, and scale. No visible seams, artifacts, or compositing errors.',
      '- Quality: Make the image as realistic as possible, with all the natural imperfections. Add realistic effects, taken from the selfies, like some hairs sticking out',
      
      aspectRatioDescription
        ? `- Format Frame (${aspectRatioDescription}): The FORMAT reference image defines the exact output bounds. Compose the final ${shotDescription ? shotDescription.toLowerCase() : 'image'} so all important content stays inside this frame without cropping.`
        : '- Aspect Ratio: Match the requested aspect ratio exactly.',
      shotDescription
        ? `- Shot Type: Respect the requested shot type (${shotDescription}) and ensure proper framing.`
        : '- Shot Type: Follow the shot type specifications in the JSON.'
    ]
    
    // Add element-specific must follow rules
    // Priority: passed rules (V3) > extracted rules from basePrompt (V2 backward compat)
    const rulesToAdd = mustFollowRules && mustFollowRules.length > 0 
      ? mustFollowRules 
      : rulesSection 
        ? (() => {
            // Extract rules from V2 format (backward compatibility)
            const extractedRules: string[] = []
            const ruleLines = rulesSection.split('\n').filter(line => line.trim())
            for (const line of ruleLines) {
              const match = line.match(/^\d+\.\s+(.+)$/)
              if (match && match[1]) {
                extractedRules.push(match[1])
              }
            }
            return extractedRules
          })()
        : []
    
    if (rulesToAdd.length > 0) {
      for (const rule of rulesToAdd) {
        structuredPrompt.push(`- ${rule}`)
      }
    }
    
    // Section 4: Freedom Rules
    structuredPrompt.push('')
    structuredPrompt.push('Freedom Rules:')
    structuredPrompt.push('- You are free to optimize lighting, shadows, and micro-details to ensure realistic 3D volume, texture, and natural scene integration.')
    structuredPrompt.push('- You may adjust subtle color grading and contrast to enhance the professional appearance, provided all specifications from the JSON are maintained.')
    
    // Add element-specific freedom rules
    if (freedomRules && freedomRules.length > 0) {
      for (const rule of freedomRules) {
        structuredPrompt.push(`- ${rule}`)
      }
    }

    return structuredPrompt.join('\n')
  } catch (error) {
    Logger.error('Failed to parse base prompt for composition', {
      error: error instanceof Error ? error.message : String(error)
    })
    // Fallback: use base prompt as-is
    return basePrompt
  }
}

