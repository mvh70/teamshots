import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { getVertexGenerativeModel } from '../gemini'
import type { Content, GenerateContentResult, Part } from '@google-cloud/vertexai'
import type { ReferenceImage, EvaluationFeedback } from '@/types/generation'

interface EvaluateCompositionInput {
  imageBase64: string
  imageIndex: number
  actualWidth: number | null
  actualHeight: number | null
  generationPrompt: string
  personReference: ReferenceImage
  backgroundReference?: ReferenceImage
  logoReference?: ReferenceImage
}

export async function evaluateComposition(
  input: EvaluateCompositionInput,
  debugMode = false
): Promise<EvaluationFeedback> {
  const { imageBase64, imageIndex, generationPrompt, personReference, backgroundReference, logoReference } = input
  
  const evalModel = Env.string('GEMINI_EVAL_MODEL', '')
  const imageModel = Env.string('GEMINI_IMAGE_MODEL', '')
  const modelName = evalModel || imageModel || 'gemini-2.5-flash'
  
  Logger.debug('Evaluating composition (Step 5)', {
    modelName,
    imageIndex,
    hasBackground: !!backgroundReference,
    hasLogo: !!logoReference
  })
  
  const model = await getVertexGenerativeModel(modelName)

  const instructions = [
    `You are evaluating Step 5 of image generation: Person + background composition.`,
    `Answer each question with ONLY: YES (criterion fully met), NO (criterion failed), UNCERTAIN (cannot determine), N/A (not applicable)`,
    '',
    'Questions:',
    '',
    '1. natural_integration',
    '   - Does the person blend naturally with the background?',
    '   - Are there no visible seams, cut/paste artifacts, or unnatural boundaries?',
    '   - Does lighting and perspective appear consistent?',
    '',
    '2. person_background_coherence',
    '   - Is the person appropriately scaled and positioned for the background?',
    '   - Does the composition look balanced and professional?',
    '',
    '3. no_visible_artifacts',
    '   - Are there no visible glitches, distortions, or compositing errors?',
    '   - Look for halo effects, mismatched colors, or unnatural shadows'
  ]

  // Add custom background matching check if background reference exists
  if (backgroundReference) {
    instructions.push(
      '',
      '4. custom_background_matches',
      '   - Does the background in the composed image reflect the style, mood, and key characteristics of the reference background?',
      '   - For close-up shots (headshot, tight framing), partial views are acceptable - not all elements need to be visible',
      '   - Focus on: overall color palette, lighting atmosphere, texture/material quality, and general environment type',
      '   - Answer YES if the background clearly derives from the reference, even if cropped or partially visible',
      '   - Answer NO only if the background is completely different or unrelated to the reference',
      '   - Missing specific elements (e.g., a window, door, or object) in close-ups should NOT trigger rejection'
    )
  } else {
    instructions.push(
      '',
      '4. custom_background_matches: N/A (no custom background required)'
    )
  }

  // Add branding checks if logo is present (for background/element branding)
  if (logoReference) {
    instructions.push(
      '',
      '5. branding_logo_matches',
      '   - Does the logo in the composed image EXACTLY match the provided brand asset?',
      '   - Are colors, proportions, and design elements preserved with NO distortion or modifications?',
      '   - Is the logo the SAME SIZE (dimensions/aspect ratio) as the reference, not enlarged or shrunk?',
      '   - Are there NO additional elements added to the logo (no boxes, borders, labels, text overlays, backgrounds)?',
      '',
      '6. branding_positioned_correctly',
      '   - Check the generation prompt for the EXACT placement instruction',
      '   - Is the logo placed in EXACTLY the location specified in the prompt?',
      '   - Does it appear exactly ONCE (not duplicated, not missing)?',
      '   - Is the positioning accurate (not shifted, not rotated incorrectly)?',
      '',
      '7. branding_scene_aligned',
      '   - Is the logo integrated naturally into the scene without looking pasted or composited?',
      '   - Does lighting, perspective, and scale match the environment realistically?',
      '   - Does the logo follow the contours of the surface it\'s placed on?'
    )
  } else {
    instructions.push(
      '',
      '5. branding_logo_matches: N/A (no branding required)',
      '6. branding_positioned_correctly: N/A (no branding required)',
      '7. branding_scene_aligned: N/A (no branding required)'
    )
  }

  instructions.push(
    '',
    'Return ONLY valid JSON with all fields and explanations.',
    'Example format:',
    '{',
    '  "natural_integration": "YES",',
    '  "person_background_coherence": "YES",',
    '  "no_visible_artifacts": "YES",',
    '  "custom_background_matches": "N/A",',
    '  "branding_logo_matches": "N/A",',
    '  "branding_positioned_correctly": "N/A",',
    '  "branding_scene_aligned": "N/A",',
    '  "explanations": {',
    '    "natural_integration": "Seamless integration achieved",',
    '    ...',
    '  }',
    '}'
  )

  const parts: Part[] = [{ text: instructions.join('\n') }]

  parts.push({ text: `Generation prompt used:\n${generationPrompt}` })
  parts.push({ text: `Step 5 candidate image ${imageIndex + 1}` })
  parts.push({ inlineData: { mimeType: 'image/png', data: imageBase64 } })

  parts.push({ text: personReference.description ?? 'Person reference from Step 1' })
  parts.push({ inlineData: { mimeType: personReference.mimeType, data: personReference.base64 } })

  if (backgroundReference) {
    parts.push({ text: backgroundReference.description ?? 'Background reference' })
    parts.push({ inlineData: { mimeType: backgroundReference.mimeType, data: backgroundReference.base64 } })
  }

  if (logoReference) {
    parts.push({ text: logoReference.description ?? 'Branding reference' })
    parts.push({ inlineData: { mimeType: logoReference.mimeType, data: logoReference.base64 } })
  }

  const contents: Content[] = [{ role: 'user', parts }]

  if (debugMode) {
    const evalPromptText = instructions.join('\n') + `\n\nGeneration prompt used:\n${generationPrompt}`
    Logger.info('V2 DEBUG - Step 6 Evaluation Prompt:', {
      step: 6,
      evaluationType: 'composition',
      prompt: evalPromptText.substring(0, 3000) + (evalPromptText.length > 3000 ? '...(truncated)' : ''),
      promptLength: evalPromptText.length,
      imageCount: 1,
      hasPersonReference: !!personReference,
      hasBackgroundReference: !!backgroundReference,
      hasLogoReference: !!logoReference
    })
  }

  try {
    const response: GenerateContentResult = await model.generateContent({
      contents,
      generationConfig: { temperature: 0.1 }
    })

    const responseParts = response.response.candidates?.[0]?.content?.parts ?? []
    const textPart = responseParts.find((part) => Boolean(part.text))?.text ?? ''

    if (textPart) {
      const evaluation = parseCompositionEvaluation(textPart, !!backgroundReference, !!logoReference)
      if (evaluation) {
        const autoReject = [
          evaluation.natural_integration === 'NO',
          evaluation.person_background_coherence === 'NO',
          evaluation.no_visible_artifacts === 'NO',
          backgroundReference && evaluation.custom_background_matches === 'NO',
          logoReference && evaluation.branding_logo_matches === 'NO',
          logoReference && evaluation.branding_positioned_correctly === 'NO',
          logoReference && evaluation.branding_scene_aligned === 'NO'
        ].some(Boolean)

        const allApproved =
          evaluation.natural_integration === 'YES' &&
          evaluation.person_background_coherence === 'YES' &&
          evaluation.no_visible_artifacts === 'YES' &&
          (!backgroundReference || evaluation.custom_background_matches === 'YES') &&
          (!logoReference || 
            (evaluation.branding_logo_matches === 'YES' &&
             evaluation.branding_positioned_correctly === 'YES' &&
             evaluation.branding_scene_aligned === 'YES'))

        const finalStatus: 'Approved' | 'Not Approved' = autoReject || !allApproved ? 'Not Approved' : 'Approved'

        const failedCriteria: string[] = []
        Object.entries(evaluation).forEach(([key, value]) => {
          if (key === 'explanations') return
          if (value === 'NO' || value === 'UNCERTAIN') {
            const explanation = evaluation.explanations[key] || 'No explanation provided'
            failedCriteria.push(`${key}: ${value} (${explanation})`)
          }
        })

        return {
          status: finalStatus,
          reason: failedCriteria.length > 0 ? failedCriteria.join(' | ') : 'All criteria met',
          failedCriteria: failedCriteria.length > 0 ? failedCriteria : undefined,
          suggestedAdjustments: finalStatus === 'Not Approved' ? generateAdjustmentSuggestions(failedCriteria) : undefined
        }
      }
    }
  } catch (error) {
    Logger.error('Failed to evaluate composition', {
      error: error instanceof Error ? error.message : String(error),
      imageIndex
    })
    throw error
  }

  return {
    status: 'Not Approved',
    reason: 'Evaluation did not return a valid structured response.'
  }
}

function parseCompositionEvaluation(text: string, hasBackground: boolean, hasBranding: boolean) {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    return {
      natural_integration: normalizeYesNoUncertain(parsed.natural_integration),
      person_background_coherence: normalizeYesNoUncertain(parsed.person_background_coherence),
      no_visible_artifacts: normalizeYesNoUncertain(parsed.no_visible_artifacts),
      custom_background_matches: hasBackground ? normalizeYesNoUncertain(parsed.custom_background_matches) : 'N/A',
      branding_logo_matches: hasBranding ? normalizeYesNoUncertain(parsed.branding_logo_matches) : 'N/A',
      branding_positioned_correctly: hasBranding ? normalizeYesNoUncertain(parsed.branding_positioned_correctly) : 'N/A',
      branding_scene_aligned: hasBranding ? normalizeYesNoUncertain(parsed.branding_scene_aligned) : 'N/A',
      explanations: (parsed.explanations as Record<string, string>) || {}
    }
  } catch (error) {
    Logger.warn('Failed to parse composition evaluation JSON', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

function normalizeYesNoUncertain(value: unknown): 'YES' | 'NO' | 'UNCERTAIN' | 'N/A' {
  if (typeof value !== 'string') return 'UNCERTAIN'
  const normalized = value.trim().toUpperCase()
  if (normalized === 'YES') return 'YES'
  if (normalized === 'NO') return 'NO'
  if (normalized === 'N/A') return 'N/A'
  return 'UNCERTAIN'
}

function generateAdjustmentSuggestions(failedCriteria: string[]): string {
  const suggestions: string[] = []
  
  for (const criterion of failedCriteria) {
    if (criterion.includes('natural_integration')) {
      suggestions.push('Improve blending between person and background; ensure consistent lighting and perspective')
    }
    if (criterion.includes('person_background_coherence')) {
      suggestions.push('Adjust person scale and positioning to match background context')
    }
    if (criterion.includes('no_visible_artifacts')) {
      suggestions.push('Remove visible compositing artifacts, halos, or color mismatches')
    }
    if (criterion.includes('custom_background_matches')) {
      suggestions.push('Ensure background matches reference style, mood, color palette, and lighting atmosphere')
    }
    if (criterion.includes('branding_logo_matches')) {
      suggestions.push('Ensure logo exactly matches reference: correct colors, proportions, size, no added elements or distortions')
    }
    if (criterion.includes('branding_positioned_correctly')) {
      suggestions.push('Place logo in exact location specified in prompt; ensure it appears once and is not shifted or rotated')
    }
    if (criterion.includes('branding_scene_aligned')) {
      suggestions.push('Integrate logo naturally into scene with proper lighting, perspective, and surface contours')
    }
  }
  
  return suggestions.join('; ')
}

