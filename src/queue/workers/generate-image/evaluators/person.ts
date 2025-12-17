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
  garmentCollageReference?: ReferenceImage // Garment collage from custom clothing
}

export async function evaluatePersonGeneration(
  input: EvaluatePersonInput,
  debugMode = false
): Promise<EvaluationFeedback> {
  const { imageBase64, imageIndex, generationPrompt, selfieReferences, logoReference, brandingPosition, garmentCollageReference } = input
  
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
    '3. proportions_realistic',
    '   - Is head size proportional and realistic compared to the rest of the body?',
    '   - Does the head appear neither too large (like a caricature) nor too small relative to torso, limbs, and overall body?',
    '   - Are there NO exaggerated or shrunken anatomical features?',
    '   - Pay special attention to head-to-body ratio - it should match realistic human proportions',
    '',
    '4. no_unauthorized_accessories',
    '   - Compare the reference selfies AND garment collage (if provided) to the generated image',
    '   - Are there NO accessories (glasses, jewelry, piercings, tattoos, hats, belt, watch, pocket square)',
    '     that are ABSENT from BOTH the reference selfies AND the garment collage?',
    '   - If a garment collage is provided, accessories visible in the collage are AUTHORIZED',
    '   - Answer YES if all accessories appear in either the selfies OR the garment collage'
  ]

  // Add branding checks if logo is on clothing
  if (logoReference && brandingPosition === 'clothing') {
    instructions.push(
      '',
      '5. branding_logo_matches',
      '   - Logo can be covered by parts of the wardrobe or the arms. The visible parts of the logo should have all the images and letters of the logo, each in the same size, position, and color of the original logo.',
      '',
      '6. branding_positioned_correctly',
      '   - Is the logo placed on the CHEST AREA of the shirt/t-shirt/polo (NOT on jacket, background, or accessories)?',
      '   - Very important: Is the logo positioned naturally on the base garment surface, and does it not overflow on eg the outer layer (jacket, blazer, cardigan)?',
      '',
      '7. branding_scene_aligned',
      '   - Does the logo look like it\'s physically printed on the fabric with proper lighting and shadows, followingthe natural contours and perspective of the clothing?',
      '   - Is the logo integrated naturally without looking artificially pasted or composited?',
      '   - Is the logo size proportional to the garment (not too small to see, not overwhelmingly large)?'
    )
  } else {
    instructions.push(
      '',
      '5. branding_logo_matches: N/A (no clothing branding required)',
      '6. branding_positioned_correctly: N/A (no clothing branding required)',
      '7. branding_scene_aligned: N/A (no clothing branding required)'
    )
  }

  instructions.push(
    '',
    'Return ONLY valid JSON with all fields and explanations.',
    'Example format:',
    '{',
    '  "person_present": "YES",',
    '  "white_background": "YES",',
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

  if (garmentCollageReference) {
    parts.push({ text: garmentCollageReference.description ?? 'Garment collage showing authorized clothing and accessories' })
    parts.push({ inlineData: { mimeType: garmentCollageReference.mimeType, data: garmentCollageReference.base64 } })
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
      prompt: evalPromptText.substring(0,8000) + (evalPromptText.length > 8000 ? '...(truncated)' : ''),
      promptLength: evalPromptText.length,
      imageCount: 1,
      selfieCount: selfieReferences.length
    })
  }

  try {
    const response: GenerateContentResult = await model.generateContent({
      contents,
      generationConfig: { temperature: 0.2 }
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
          evaluation.proportions_realistic === 'NO',
          evaluation.no_unauthorized_accessories === 'NO',
          logoReference && brandingPosition === 'clothing' && evaluation.branding_logo_matches === 'NO',
          logoReference && brandingPosition === 'clothing' && evaluation.branding_positioned_correctly === 'NO',
          logoReference && brandingPosition === 'clothing' && evaluation.branding_scene_aligned === 'NO'
        ].some(Boolean)

        const allApproved =
          evaluation.person_present === 'YES' &&
          evaluation.white_background === 'YES' &&
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

