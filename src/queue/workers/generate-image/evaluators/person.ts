import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateTextWithGemini, type GeminiReferenceImage } from '../gemini'
import { AI_CONFIG, STAGE_MODEL, type ModelName } from '../config'
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

  // Model selection - supports both Gemini and Grok models via OpenRouter
  const evalModel = Env.string('GEMINI_EVAL_MODEL', '')
  const modelName: ModelName = (evalModel as ModelName) || STAGE_MODEL.EVALUATION

  Logger.debug('Evaluating person generation (Step 1)', {
    modelName,
    imageIndex
  })

  // Extract inherent accessories from wardrobe - these are authorized by the clothing style
  let authorizedAccessories: string[] = []
  try {
    const promptObj = JSON.parse(generationPrompt)
    const wardrobeObj = promptObj.wardrobe as { inherent_accessories?: string[], accessories?: string[] } | undefined
    const inherentAccessories = wardrobeObj?.inherent_accessories || []
    const userAccessories = wardrobeObj?.accessories || []
    authorizedAccessories = [...new Set([...inherentAccessories, ...userAccessories])]
  } catch {
    // If parsing fails, continue with empty authorized accessories
    Logger.warn('Failed to parse generation prompt for authorized accessories')
  }

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
    '   - IMPORTANT: If an accessory appears in AT LEAST ONE reference selfie, it is AUTHORIZED.',
    '   - Do NOT require accessories to appear in ALL selfies - appearing in ANY selfie is sufficient authorization.',
    '   - Are there NO accessories (glasses, jewelry, piercings, tattoos, hats, watch, pocket square)',
    '     that are ABSENT from ALL of the reference selfies AND the garment collage?',
    '   - NOTE: Belt and cufflinks may be inherent to the clothing style and should not be rejected',
    '   - If a garment collage is provided, accessories visible in the collage are AUTHORIZED',
    authorizedAccessories.length > 0
      ? `   - INHERENT ACCESSORIES: The following are AUTHORIZED by the clothing style: ${authorizedAccessories.join(', ')}`
      : '   - No inherent accessories specified for this clothing style',
    '   - Answer YES if all accessories in the generated image appear in AT LEAST ONE selfie OR the garment collage OR the inherent accessories list'
  ]

  // Add branding checks if logo is on clothing
  if (logoReference && brandingPosition === 'clothing') {
    instructions.push(
      '',
      '5. branding_logo_matches',
      '   - CHROMA KEY: The logo reference image may have a bright GREEN background. This green is a CHROMA KEY added for visibility only - it is NOT part of the logo. IGNORE the green background entirely when comparing. Only compare the actual logo elements (text, icons, shapes, colors) against what appears in the generated image.',
      '   - The logo may be PARTIALLY COVERED by outer layers (jacket, blazer, cardigan) or arms - this is EXPECTED and REALISTIC. Do NOT reject an image because the logo is partially hidden behind clothing layers.',
      '   - Only evaluate the VISIBLE portions of the logo. The visible parts should faithfully reproduce the actual logo elements (text, icons, shapes) with correct colors and proportions.',
      '   - Answer YES if the visible portion of the logo is recognizable, correctly colored, and properly rendered on the fabric - even if 30-50% is hidden behind an outer garment.',
      '   - Answer NO only if the visible portion has wrong text, distorted shapes, wrong colors (ignoring the green chroma background), or the logo is completely invisible.',
      '',
      '6. branding_positioned_correctly',
      '   - Is the logo placed on the CHEST AREA of the base layer garment (shirt/t-shirt/polo), NOT on the jacket, background, or accessories?',
      '   - The logo should be rendered on the base garment surface. It is ACCEPTABLE and EXPECTED for outer layers (jacket, blazer, cardigan) to cover parts of the logo - this adds realism.',
      '   - Answer NO only if the logo is placed on the WRONG garment (e.g., on the jacket instead of the shirt) or on non-clothing surfaces.',
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

  // Build images array for multi-provider text generation
  const images: GeminiReferenceImage[] = []

  // Add generated image to evaluate
  images.push({
    base64: imageBase64,
    mimeType: 'image/png',
    description: `Step 1 candidate image ${imageIndex + 1}`
  })

  // Add selfie references
  for (const selfie of selfieReferences) {
    images.push({
      base64: selfie.base64,
      mimeType: selfie.mimeType,
      description: `Reference ${selfie.description || 'selfie'}`
    })
  }

  // Add garment collage if provided
  if (garmentCollageReference) {
    images.push({
      base64: garmentCollageReference.base64,
      mimeType: garmentCollageReference.mimeType,
      description: garmentCollageReference.description ?? 'Garment collage showing authorized clothing and accessories'
    })
  }

  // Add logo if branding on clothing
  if (logoReference && brandingPosition === 'clothing') {
    images.push({
      base64: logoReference.base64,
      mimeType: logoReference.mimeType,
      description: logoReference.description ?? 'Official branding/logo reference. NOTE: If this logo has a bright GREEN background, that is a CHROMA KEY for visibility only - it is NOT part of the actual logo. Ignore the green background when comparing against the generated image.'
    })
  }

  // Build full prompt text
  const promptText = instructions.join('\n') + `\n\nGeneration prompt used:\n${generationPrompt}`

  if (debugMode) {
    Logger.info('V2 DEBUG - Step 2 Evaluation Prompt:', {
      step: 2,
      evaluationType: 'person_generation',
      prompt: promptText.substring(0, 8000) + (promptText.length > 8000 ? '...(truncated)' : ''),
      promptLength: promptText.length,
      imageCount: 1,
      selfieCount: selfieReferences.length
    })
  }

  try {
    // Use multi-provider text generation (supports Gemini, Grok via OpenRouter)
    const result = await generateTextWithGemini(promptText, images, {
      temperature: AI_CONFIG.EVALUATION_TEMPERATURE,
      stage: 'EVALUATION'
    })

    Logger.debug('V3 Step 1 Eval: Provider used', {
      provider: result.providerUsed,
      model: modelName,
      evalAttempt: 1
    })

    const textPart = result.text

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

