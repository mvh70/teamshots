import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { getVertexGenerativeModel } from '../gemini'
import type { Content, GenerateContentResult, Part } from '@google-cloud/vertexai'
import type { ReferenceImage, EvaluationFeedback } from '@/types/generation'

interface EvaluatePersonInput {
  imageBase64: string
  imageIndex: number
  actualWidth: number | null
  actualHeight: number | null
  generationPrompt: string
  selfieReferences: ReferenceImage[]
  logoReference?: ReferenceImage
  brandingPosition?: string
}

export async function evaluatePersonGeneration(
  input: EvaluatePersonInput,
  debugMode = false
): Promise<EvaluationFeedback> {
  const { imageBase64, imageIndex, generationPrompt, selfieReferences, logoReference, brandingPosition } = input
  
  const evalModel = Env.string('GEMINI_EVAL_MODEL', '')
  const imageModel = Env.string('GEMINI_IMAGE_MODEL', '')
  const modelName = evalModel || imageModel || 'gemini-2.5-flash'
  
  Logger.debug('Evaluating person generation (Step 1)', {
    modelName,
    imageIndex
  })
  
  const model = await getVertexGenerativeModel(modelName)

  const instructions = [
    `You are evaluating Step 1 of image generation: Person on white background.`,
    `Answer each question with ONLY: YES (criterion fully met), NO (criterion failed), UNCERTAIN (cannot determine)`,
    '',
    'Questions:',
    '',
    '1. person_present',
    '   - Is there a clearly visible human subject in the image?',
    '   - The person should be the main focus and well-defined',
    '',
    '2. white_background',
    '   - Is the background pure white or very close to white?',
    '   - Should be clean and isolated, no other colors or patterns',
    '',
    '3. correct_pose_and_clothing',
    '   - Does the person\'s pose and clothing match the generation prompt?',
    '   - Check for professional attire, posture, and positioning as requested',
    '',
    '4. proportions_realistic',
    '   - Is head size proportional and realistic compared to the rest of the body?',
    '   - Does the head appear neither too large (like a caricature) nor too small relative to torso, limbs, and overall body?',
    '   - Are there NO exaggerated or shrunken anatomical features?',
    '   - Pay special attention to head-to-body ratio - it should match realistic human proportions',
    '',
    '5. no_unauthorized_accessories',
    '   - Compare the reference selfies to the generated image',
    '   - Are there NO accessories (glasses, jewelry, piercings, tattoos, hats)',
    '     that are ABSENT from the reference selfies?'
  ]

  // Add branding checks if logo is on clothing
  if (logoReference && brandingPosition === 'clothing') {
    instructions.push(
      '',
      '6. branding_logo_matches',
      '   - Does the logo on the clothing EXACTLY match the provided brand asset?',
      '   - Are colors, proportions, and design elements preserved with NO distortion or modifications?',
      '   - Is the logo the SAME SIZE (dimensions/aspect ratio) as the reference, not enlarged or shrunk?',
      '   - Are there NO additional elements added to the logo (no boxes, borders, labels, text overlays, backgrounds)?',
      '',
      '7. branding_positioned_correctly',
      '   - Check the generation prompt for the EXACT placement instruction (e.g., "left chest", "center chest", "sleeve")',
      '   - Is the logo placed in EXACTLY the location specified in the prompt?',
      '   - Does it appear exactly ONCE (not duplicated, not missing)?',
      '   - Is the positioning accurate (not shifted, not rotated incorrectly, not placed on wrong body part)?',
      '',
      '8. branding_scene_aligned',
      '   - Is the logo integrated naturally into the clothing without looking pasted or composited?',
      '   - Does lighting, perspective, and scale match the environment realistically?',
      '   - Does the logo follow the contours of the clothing/fabric it\'s placed on?'
    )
  } else {
    instructions.push(
      '',
      '6. branding_logo_matches: N/A (no clothing branding required)',
      '7. branding_positioned_correctly: N/A (no clothing branding required)',
      '8. branding_scene_aligned: N/A (no clothing branding required)'
    )
  }

  instructions.push(
    '',
    'Return ONLY valid JSON with all fields and explanations.',
    'Example format:',
    '{',
    '  "person_present": "YES",',
    '  "white_background": "YES",',
    '  "correct_pose_and_clothing": "YES",',
    '  "proportions_realistic": "YES",',
    '  "no_unauthorized_accessories": "YES",',
    '  "branding_logo_matches": "N/A",',
    '  "branding_positioned_correctly": "N/A",',
    '  "branding_scene_aligned": "N/A",',
    '  "explanations": {',
    '    "person_present": "Clear human subject visible",',
    '    "white_background": "Clean white background",',
    '    ...',
    '  }',
    '}'
  )

  const parts: Part[] = [{ text: instructions.join('\n') }]

  parts.push({ text: `Generation prompt used:\n${generationPrompt}` })
  parts.push({ text: `Step 1 candidate image ${imageIndex + 1}` })
  parts.push({ inlineData: { mimeType: 'image/png', data: imageBase64 } })

  for (const selfie of selfieReferences) {
    parts.push({ text: `Reference ${selfie.description || 'selfie'}` })
    parts.push({ inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } })
  }

  if (logoReference && brandingPosition === 'clothing') {
    parts.push({ text: logoReference.description ?? 'Official branding/logo asset for clothing' })
    parts.push({ inlineData: { mimeType: logoReference.mimeType, data: logoReference.base64 } })
  }

  const contents: Content[] = [{ role: 'user', parts }]

  if (debugMode) {
    const evalPromptText = instructions.join('\n') + `\n\nGeneration prompt used:\n${generationPrompt}`
    Logger.info('V2 DEBUG - Step 2 Evaluation Prompt:', {
      step: 2,
      evaluationType: 'person_generation',
      prompt: evalPromptText.substring(0,3000) + (evalPromptText.length > 3000 ? '...(truncated)' : ''),
      promptLength: evalPromptText.length,
      imageCount: 1,
      selfieCount: selfieReferences.length
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
      const hasBranding = !!(logoReference && brandingPosition === 'clothing')
      const evaluation = parsePersonEvaluation(textPart, hasBranding)
      if (evaluation) {
        const autoReject = [
          evaluation.person_present === 'NO',
          evaluation.white_background === 'NO',
          evaluation.correct_pose_and_clothing === 'NO',
          evaluation.proportions_realistic === 'NO',
          evaluation.no_unauthorized_accessories === 'NO',
          logoReference && brandingPosition === 'clothing' && evaluation.branding_logo_matches === 'NO',
          logoReference && brandingPosition === 'clothing' && evaluation.branding_positioned_correctly === 'NO',
          logoReference && brandingPosition === 'clothing' && evaluation.branding_scene_aligned === 'NO'
        ].some(Boolean)

        const allApproved =
          evaluation.person_present === 'YES' &&
          evaluation.white_background === 'YES' &&
          evaluation.correct_pose_and_clothing === 'YES' &&
          evaluation.proportions_realistic === 'YES' &&
          evaluation.no_unauthorized_accessories === 'YES' &&
          (!logoReference || brandingPosition !== 'clothing' || 
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
    Logger.error('Failed to evaluate person generation', {
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

function parsePersonEvaluation(text: string, hasBranding: boolean) {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    return {
      person_present: normalizeYesNoUncertain(parsed.person_present),
      white_background: normalizeYesNoUncertain(parsed.white_background),
      correct_pose_and_clothing: normalizeYesNoUncertain(parsed.correct_pose_and_clothing),
      proportions_realistic: normalizeYesNoUncertain(parsed.proportions_realistic),
      no_unauthorized_accessories: normalizeYesNoUncertain(parsed.no_unauthorized_accessories),
      branding_logo_matches: hasBranding ? normalizeYesNoUncertain(parsed.branding_logo_matches) : 'N/A',
      branding_positioned_correctly: hasBranding ? normalizeYesNoUncertain(parsed.branding_positioned_correctly) : 'N/A',
      branding_scene_aligned: hasBranding ? normalizeYesNoUncertain(parsed.branding_scene_aligned) : 'N/A',
      explanations: (parsed.explanations as Record<string, string>) || {}
    }
  } catch (error) {
    Logger.warn('Failed to parse person evaluation JSON', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

function normalizeYesNoUncertain(value: unknown): 'YES' | 'NO' | 'UNCERTAIN' {
  if (typeof value !== 'string') return 'UNCERTAIN'
  const normalized = value.trim().toUpperCase()
  if (normalized === 'YES') return 'YES'
  if (normalized === 'NO') return 'NO'
  return 'UNCERTAIN'
}

function generateAdjustmentSuggestions(failedCriteria: string[]): string {
  const suggestions: string[] = []
  
  for (const criterion of failedCriteria) {
    if (criterion.includes('person_present')) {
      suggestions.push('Ensure the person is clearly visible and well-defined in the frame')
    }
    if (criterion.includes('white_background')) {
      suggestions.push('Emphasize pure white background with no other elements or colors')
    }
    if (criterion.includes('correct_pose_and_clothing')) {
      suggestions.push('Verify pose and clothing match the specified style requirements')
    }
    if (criterion.includes('proportions_realistic')) {
      suggestions.push('Adjust head-to-body proportions to match realistic human anatomy; avoid caricature-like features')
    }
    if (criterion.includes('no_unauthorized_accessories')) {
      suggestions.push('Remove any accessories (glasses, jewelry, piercings, tattoos, hats) not present in reference selfies')
    }
    if (criterion.includes('branding_logo_matches')) {
      suggestions.push('Ensure logo exactly matches reference: correct colors, proportions, size, no added elements or distortions')
    }
    if (criterion.includes('branding_positioned_correctly')) {
      suggestions.push('Place logo in exact location specified in prompt; ensure it appears once and is not shifted or rotated')
    }
    if (criterion.includes('branding_scene_aligned')) {
      suggestions.push('Integrate logo naturally into clothing with proper lighting, perspective, and fabric contours')
    }
  }
  
  return suggestions.join('; ')
}

