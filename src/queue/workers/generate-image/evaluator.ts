import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { getVertexGenerativeModel } from './gemini'
import { AI_CONFIG } from './config'
import type { Content, GenerateContentResult, Part } from '@google-cloud/vertexai'

export interface SelfieReference {
  label?: string // Optional: labels are only rendered on composite images, not individual selfies
  base64: string
  mimeType: string
}

export interface ImageEvaluationInput {
  imageBase64: string
  imageIndex: number
  actualWidth: number | null
  actualHeight: number | null
  expectedWidth: number
  expectedHeight: number
  aspectRatioId: string
  aspectRatioDescription: string
  shotLabel: string
  shotDescription: string
  generationPrompt: string
  labelInstruction?: string
  selfieReferences: SelfieReference[]
  compositeReference?: {
    base64: string
    mimeType: string
    description?: string
  }
  logoReference?: {
    base64: string
    mimeType: string
    description?: string
  }
  isClothingLogo?: boolean // True if logo is for clothing branding (enables overflow check)
  backgroundReference?: {
    base64: string
    mimeType: string
    description?: string
  }
  skipBackgroundValidation?: boolean // True to skip background validation (for Step 1a white BG)
}

export interface StructuredEvaluation {
  dimensions_and_aspect_correct: 'YES' | 'NO'
  is_fully_generated: 'YES' | 'NO' | 'UNCERTAIN'
  composition_matches_shot: 'YES' | 'NO' | 'UNCERTAIN' | 'N/A'
  identity_preserved: 'YES' | 'NO' | 'UNCERTAIN'
  proportions_realistic: 'YES' | 'NO' | 'UNCERTAIN'
  no_unauthorized_accessories: 'YES' | 'NO' | 'UNCERTAIN'
  no_visible_reference_labels: 'YES' | 'NO' | 'UNCERTAIN'
  custom_background_matches: 'YES' | 'NO' | 'N/A'
  branding_logo_matches: 'YES' | 'NO' | 'N/A'
  branding_positioned_correctly: 'YES' | 'NO' | 'N/A'
  branding_scene_aligned: 'YES' | 'NO' | 'N/A'
  clothing_logo_no_overflow: 'YES' | 'NO' | 'N/A'
  explanations: Record<string, string>
}

export interface ImageEvaluationResult {
  status: 'Approved' | 'Not Approved'
  reason: string
  rawResponse?: unknown
  structuredEvaluation?: StructuredEvaluation
  details: {
    actualWidth: number | null
    actualHeight: number | null
    dimensionMismatch: boolean
    aspectMismatch: boolean
    selfieDuplicate: boolean
    matchingReferenceLabel?: string | null
    uncertainCount?: number
    autoReject?: boolean
  }
}

const DIMENSION_TOLERANCE_PX = 50 // Generous tolerance for model variations (Gemini 3 outputs different base dims)
const ASPECT_RATIO_TOLERANCE = 0.05 // 5% tolerance

export async function evaluateGeneratedImage({
  imageBase64,
  imageIndex,
  actualWidth,
  actualHeight,
  expectedWidth,
  expectedHeight,
  aspectRatioId,
  aspectRatioDescription,
  shotLabel,
  shotDescription,
  generationPrompt,
  labelInstruction,
  selfieReferences,
  compositeReference,
  logoReference,
  isClothingLogo = false,
  backgroundReference
}: ImageEvaluationInput): Promise<ImageEvaluationResult> {
  const evalModel = Env.string('GEMINI_EVAL_MODEL', '')
  const imageModel = Env.string('GEMINI_IMAGE_MODEL', '')
  const modelName = evalModel || imageModel || 'gemini-2.5-flash'
  
  Logger.debug('Using evaluation model', {
    GEMINI_EVAL_MODEL: evalModel || '(not set)',
    GEMINI_IMAGE_MODEL: imageModel || '(not set)',
    selectedModel: modelName
  })
  
  const model = await getVertexGenerativeModel(modelName)

  const expectedRatio = expectedWidth / expectedHeight
  const actualRatio =
    actualWidth && actualHeight && actualHeight !== 0 ? actualWidth / actualHeight : null

  const dimensionMismatch =
    actualWidth === null ||
    actualHeight === null ||
    Math.abs(actualWidth - expectedWidth) > DIMENSION_TOLERANCE_PX ||
    Math.abs(actualHeight - expectedHeight) > DIMENSION_TOLERANCE_PX

  const aspectMismatch =
    actualRatio === null ? true : Math.abs(actualRatio - expectedRatio) > ASPECT_RATIO_TOLERANCE

  const matchingReference = selfieReferences.find((selfie) => selfie.base64 === imageBase64)
  const selfieDuplicate = Boolean(matchingReference)

  const baseInstructions = [
    `You are evaluating a generated portrait variation ${imageIndex + 1}. Answer each question with ONLY:`,
    '- YES (criterion fully met)',
    '- NO (criterion failed)',
    '- UNCERTAIN (cannot determine)',
    '- N/A (not applicable)',
    '',
    'CRITICAL: The generated image must be FULLY AI-GENERATED. If you see ANY portions of the reference selfies literally embedded (cut/pasted/composited) into the output, answer "NO" to is_fully_generated.',
    '',
    'Questions:',
    '',
    '1. dimensions_and_aspect_correct',
    `   - Expected: ${expectedWidth}x${expectedHeight}px (tolerance ±${DIMENSION_TOLERANCE_PX}px)`,
    `   - Actual: ${actualWidth ?? 'unknown'}x${actualHeight ?? 'unknown'}px`,
    `   - Expected aspect ratio [${aspectRatioId}]: ${aspectRatioDescription} (≈ ${expectedRatio.toFixed(4)})`,
    actualRatio
      ? `   - Actual aspect ratio: ${actualRatio.toFixed(4)}`
      : '   - Actual aspect ratio: unknown',
    '   - Does the image meet BOTH dimension AND aspect ratio requirements?',
    '',
    '2. is_fully_generated',
    '   - Is the ENTIRE image AI-generated from scratch?',
    '   - Are there NO visible portions of the reference selfies literally embedded?',
    '   - Look for: cut-and-paste artifacts, mismatched lighting on body parts,',
    '     sharp boundaries between face/body, original photo backgrounds, unnatural compositing',
    '',
    '3. composition_matches_shot: N/A (temporarily disabled)',
    '',
    '4. identity_preserved',
    '   - Does the face clearly resemble the reference selfies?',
    '   - Is facial identity consistent and recognizable?',
    '',
    '5. proportions_realistic',
    '   - Is head size proportional and realistic compared to the rest of the body?',
    '   - Does the head appear neither too large (like a caricature) nor too small relative to torso, limbs, and overall body?',
    '   - Are there NO exaggerated or shrunken anatomical features?',
    '   - Pay special attention to head-to-body ratio - it should match realistic human proportions',
    '',
    '6. no_unauthorized_accessories',
    '   - Compare the reference selfies to the generated image',
    '   - Are there NO accessories (glasses, jewelry, piercings, tattoos, hats)',
    '     that are ABSENT from the reference selfies?',
    '',
    '7. no_visible_reference_labels',
    '   - Are there NO visible labels, text overlays, or bordered text boxes containing words like:',
    '     SUBJECT, SELFIE, LOGO, FORMAT, REFERENCE, ADDITIONAL, or similar labeling patterns?',
    '   - Look specifically for: white/light boxes with borders containing text, labels with patterns like',
    '     "SUBJECT1-SELFIE#", "FORMAT #:#", or any text that appears to be from reference materials',
    '   - Legitimate scene text (signs, badges, documents) is acceptable if contextually appropriate',
    '   - Answer NO if you see ANY bordered labels with our reference keywords'
  ]

  if (backgroundReference) {
    baseInstructions.push(
      '',
      '8. custom_background_matches',
      '   - Does the background in the generated image reflect the style, mood, and key characteristics of the reference background?',
      '   - For close-up shots (headshot, tight framing), partial views are acceptable - not all elements need to be visible',
      '   - Focus on: overall color palette, lighting atmosphere, texture/material quality, and general environment type',
      '   - Answer YES if the background clearly derives from the reference, even if cropped or partially visible',
      '   - Answer NO only if the background is completely different or unrelated to the reference',
      '   - Missing specific elements (e.g., a window, door, or object) in close-ups should NOT trigger rejection'
    )
  } else {
    baseInstructions.push(
      '',
      '8. custom_background_matches: N/A (no custom background required)'
    )
  }

  if (logoReference) {
    baseInstructions.push(
      '',
      '9. branding_logo_matches',
      isClothingLogo
        ? '   - Does the logo on the clothing EXACTLY match the provided brand asset?'
        : '   - Does the VISIBLE portion of the logo match the provided brand asset?',
      isClothingLogo
        ? '   - Are colors, proportions, and design elements preserved with NO distortion or modifications?'
        : '   - CRITICAL: Occlusion by the foreground person is DESIRABLE and creates professional depth.',
      isClothingLogo
        ? '   - Is the logo the SAME SIZE (dimensions/aspect ratio) as the reference, not enlarged or shrunk?'
        : '   - If the person covers part of the logo (hiding text like "Pro" or portions), this is EXCELLENT composition.',
      isClothingLogo
        ? '   - Are there NO additional elements added to the logo (no boxes, borders, labels, text overlays, backgrounds)?'
        : '   - Focus ONLY on visible portions: are colors, proportions, and design elements correct where visible?',
      isClothingLogo
        ? '   - Look specifically for: reference label artifacts (e.g., "LOGO", "BRAND"), white/colored boxes around the logo, or any UI elements'
        : '   - Answer YES if visible portions match the reference, even if person occludes large parts.',
      isClothingLogo
        ? '   - The logo should appear clean and isolated, exactly as provided in the reference'
        : '   - Answer NO only if visible portions are distorted, wrong color, or have added artifacts.',
      '',
      '10. branding_positioned_correctly',
      isClothingLogo
        ? '   - Check the generation prompt for the EXACT placement instruction (e.g., "left chest", "center chest", "sleeve")'
        : '   - Check the generation prompt for the placement instruction (e.g., "background", "wall", "scene element")',
      isClothingLogo
        ? '   - Is the logo placed in EXACTLY the location specified in the prompt?'
        : '   - Is the logo placed in the background scene as a 3D physical element?',
      isClothingLogo
        ? '   - Does it appear exactly ONCE (not duplicated, not missing)?'
        : '   - CRITICAL: Logo being partially hidden behind the person still counts as correctly positioned.',
      isClothingLogo
        ? '   - Is the positioning accurate (not shifted, not rotated incorrectly, not placed on wrong body part)?'
        : '   - Answer YES if the logo is in the right general area, even if person covers most of it.',
      '',
      '11. branding_scene_aligned',
      '   - Is the logo integrated naturally into the scene without looking pasted or composited?',
      '   - Does lighting, perspective, and scale match the environment realistically?',
      isClothingLogo
        ? '   - Does the logo follow the contours of the clothing/surface it\'s placed on?'
        : '   - Does the logo appear as a 3D physical installation (e.g., brushed metal, carved stone, illuminated acrylic)?',
      isClothingLogo
        ? ''
        : '   - Partial obscuring by the person or foreground elements adds depth and should be answered YES.'
    )
    
    // Only add clothing overflow check when logo is specifically for clothing
    if (isClothingLogo) {
      baseInstructions.push(
        '',
        '12. clothing_logo_no_overflow (CRITICAL CHECK FOR CLOTHING LOGOS)',
        '   - **This is a STRICT rejection criterion**: The logo MUST be confined to the BASE LAYER ONLY',
        '   - Check if the person is wearing OUTER LAYERS such as: jackets, blazers, coats, cardigans, hoodies, vests, or any open outerwear',
        '   - If outer layers are present: Is the logo COMPLETELY HIDDEN beneath the outer layer, or ONLY visible on the base layer (shirt/polo) in the exposed area?',
        '   - Answer NO (REJECT) if: The logo overflows, bleeds through, or appears ON TOP of any outer layer (jacket, blazer, etc.)',
        '   - Answer NO (REJECT) if: The logo is partially visible on both the base layer AND the outer layer simultaneously',
        '   - Answer YES (APPROVE) if: No outer layers are present, OR the logo is fully confined to the visible base layer area with no overflow',
        '   - This check ensures the logo respects clothing layer hierarchy and doesn\'t create unrealistic compositing artifacts'
      )
    } else {
      baseInstructions.push(
        '',
        '12. clothing_logo_no_overflow: N/A (logo is for background/elements, not clothing)'
      )
    }
  } else {
    baseInstructions.push(
      '',
      '9. branding_logo_matches: N/A (no logo required)',
      '10. branding_positioned_correctly: N/A (no logo required)',
      '11. branding_scene_aligned: N/A (no logo required)',
      '12. clothing_logo_no_overflow: N/A (no logo required)'
    )
  }

  baseInstructions.push(
    '',
    'Return ONLY valid JSON with all fields and an explanations object.',
    'Example format:',
    '{',
    '  "dimensions_and_aspect_correct": "YES",',
    '  "is_fully_generated": "YES",',
    '  "composition_matches_shot": "N/A",',
    '  "identity_preserved": "YES",',
    '  "proportions_realistic": "YES",',
    '  "no_unauthorized_accessories": "YES",',
    '  "no_visible_reference_labels": "YES",',
    '  "custom_background_matches": "N/A",',
    '  "branding_logo_matches": "N/A",',
    '  "branding_positioned_correctly": "N/A",',
    '  "branding_scene_aligned": "N/A",',
    '  "clothing_logo_no_overflow": "N/A",',
    '  "explanations": {',
    '    "dimensions_and_aspect_correct": "Image meets size requirements",',
    '    "is_fully_generated": "Fully AI-generated, no selfie portions visible",',
    '    "no_visible_reference_labels": "No reference labels detected",',
    '    "custom_background_matches": "Custom background properly applied",',
    '    ...',
    '  }',
    '}'
  )

  const parts: Part[] = [{ text: baseInstructions.join('\n') }]

  parts.push({ text: `Generation prompt used:\n${generationPrompt}` })

  if (labelInstruction) {
    parts.push({ text: `Labeling & composite guidance:\n${labelInstruction}` })
  }

  parts.push({
    text: `Candidate image variation ${imageIndex + 1}`
  })
  parts.push({
    inlineData: { mimeType: 'image/png', data: imageBase64 }
  })

  if (compositeReference) {
    parts.push({
      text:
        compositeReference.description ??
        'Composite reference containing labeled selfies and brand placement guidance.'
    })
    parts.push({
      inlineData: { mimeType: compositeReference.mimeType, data: compositeReference.base64 }
    })
  }

  if (backgroundReference) {
    parts.push({
      text: backgroundReference.description ?? 'Custom background reference for comparison.'
    })
    parts.push({
      inlineData: { mimeType: backgroundReference.mimeType, data: backgroundReference.base64 }
    })
  }

  if (logoReference) {
    parts.push({
      text: logoReference.description ?? 'Official branding/logo asset for comparison.'
    })
    parts.push({
      inlineData: { mimeType: logoReference.mimeType, data: logoReference.base64 }
    })
  }

  // Optimization: If a composite is provided, the AI can use that for identity verification.
  // We only send individual selfies if no composite is available (e.g. V2 workflow).
  if (!compositeReference && selfieReferences.length > 0) {
    parts.push({
      text: 'Reference selfies provided for comparison:'
    })

    // Labels are only shown on composite images, not individual selfies
    for (let i = 0; i < selfieReferences.length; i += 1) {
      const selfie = selfieReferences[i]
      parts.push({ text: `Reference selfie ${i + 1}` })
      parts.push({
        inlineData: { mimeType: selfie.mimeType, data: selfie.base64 }
      })
    }
  }

  const contents: Content[] = [
    {
      role: 'user',
      parts
    }
  ]

  let rawResponse: unknown = null
  let structuredEvaluation: StructuredEvaluation | null = null

  try {
    const response: GenerateContentResult = await model.generateContent({
      contents,
      generationConfig: {
        temperature: AI_CONFIG.EVALUATION_TEMPERATURE
      }
    })

    const responseParts = response.response.candidates?.[0]?.content?.parts ?? []
    const textPart = responseParts.find((part) => Boolean(part.text))?.text ?? ''
    rawResponse = textPart

    if (textPart) {
      structuredEvaluation = parseStructuredEvaluation(textPart)
    }
  } catch (error) {
    Logger.error('Failed to run Gemini evaluation for generated image', {
      error: error instanceof Error ? error.message : String(error),
      imageIndex
    })
    throw error
  }

  // Default to rejection if parsing failed
  if (!structuredEvaluation) {
    return {
      status: 'Not Approved',
      reason: 'Evaluation did not return a valid structured response.',
      rawResponse,
      details: {
        actualWidth,
        actualHeight,
        dimensionMismatch,
        aspectMismatch,
        selfieDuplicate,
        matchingReferenceLabel: matchingReference?.label ?? null
      }
    }
  }

  // Override dimension/aspect check with our precise calculations
  if (dimensionMismatch || aspectMismatch) {
    structuredEvaluation.dimensions_and_aspect_correct = 'NO'
    const dimIssue = dimensionMismatch
      ? `Dimension mismatch (expected ${expectedWidth}x${expectedHeight}px, actual ${actualWidth ?? 'unknown'}x${actualHeight ?? 'unknown'}px)`
      : ''
    const aspectIssue = aspectMismatch
      ? `Aspect ratio mismatch (expected ≈${expectedRatio.toFixed(4)}, actual ${
          actualRatio !== null ? actualRatio.toFixed(4) : 'unknown'
        })`
      : ''
    structuredEvaluation.explanations.dimensions_and_aspect_correct =
      [dimIssue, aspectIssue].filter(Boolean).join('; ')
  }

  // Override if exact selfie duplicate detected
  if (selfieDuplicate) {
    structuredEvaluation.is_fully_generated = 'NO'
    structuredEvaluation.explanations.is_fully_generated =
      `Generated image matches reference selfie ${matchingReference?.label ?? 'unknown'} exactly (base64 match)`
  }

  // Auto-reject conditions
  const autoReject = [
    structuredEvaluation.dimensions_and_aspect_correct === 'NO',
    structuredEvaluation.is_fully_generated === 'NO',
    structuredEvaluation.is_fully_generated === 'UNCERTAIN', // Critical field
    // composition_matches_shot temporarily disabled - not checking
    structuredEvaluation.identity_preserved === 'NO',
    structuredEvaluation.proportions_realistic === 'NO',
    structuredEvaluation.no_unauthorized_accessories === 'NO',
    structuredEvaluation.no_visible_reference_labels === 'NO',
    structuredEvaluation.no_visible_reference_labels === 'UNCERTAIN', // Critical field - auto-reject uncertainty
    structuredEvaluation.custom_background_matches === 'NO',
    structuredEvaluation.branding_logo_matches === 'NO',
    structuredEvaluation.branding_positioned_correctly === 'NO',
    structuredEvaluation.branding_scene_aligned === 'NO',
    structuredEvaluation.clothing_logo_no_overflow === 'NO' // Critical: Logo must not overflow onto outer layers
  ].some(Boolean)

  // Count uncertain responses
  const uncertainCount = Object.values(structuredEvaluation).filter((v) => v === 'UNCERTAIN').length

  // Approval: ALL must be YES (or N/A for custom background/branding)
  const allApproved =
    structuredEvaluation.dimensions_and_aspect_correct === 'YES' &&
    structuredEvaluation.is_fully_generated === 'YES' &&
    // composition_matches_shot temporarily disabled - always treated as approved
    (structuredEvaluation.composition_matches_shot === 'YES' || structuredEvaluation.composition_matches_shot === 'N/A') &&
    structuredEvaluation.identity_preserved === 'YES' &&
    structuredEvaluation.proportions_realistic === 'YES' &&
    structuredEvaluation.no_unauthorized_accessories === 'YES' &&
    structuredEvaluation.no_visible_reference_labels === 'YES' &&
    (structuredEvaluation.custom_background_matches === 'YES' ||
      structuredEvaluation.custom_background_matches === 'N/A') &&
    (structuredEvaluation.branding_logo_matches === 'YES' ||
      structuredEvaluation.branding_logo_matches === 'N/A') &&
    (structuredEvaluation.branding_positioned_correctly === 'YES' ||
      structuredEvaluation.branding_positioned_correctly === 'N/A') &&
    (structuredEvaluation.branding_scene_aligned === 'YES' ||
      structuredEvaluation.branding_scene_aligned === 'N/A') &&
    (structuredEvaluation.clothing_logo_no_overflow === 'YES' ||
      structuredEvaluation.clothing_logo_no_overflow === 'N/A') &&
    uncertainCount === 0

  const finalStatus: 'Approved' | 'Not Approved' = autoReject || !allApproved ? 'Not Approved' : 'Approved'

  // Build detailed reason from failed criteria
  const failedCriteria: string[] = []
  Object.entries(structuredEvaluation).forEach(([key, value]) => {
    if (key === 'explanations') return
    if (value === 'NO' || value === 'UNCERTAIN') {
      const explanation = structuredEvaluation!.explanations[key] || 'No explanation provided'
      failedCriteria.push(`${key}: ${value} (${explanation})`)
    }
  })

  const finalReason =
    failedCriteria.length > 0
      ? failedCriteria.join(' | ')
      : 'All criteria met'

  Logger.info('Structured evaluation result', {
    imageIndex,
    evaluation: structuredEvaluation,
    finalStatus,
    uncertainCount,
    autoReject
  })

  return {
    status: finalStatus,
    reason: finalReason,
    rawResponse,
    structuredEvaluation,
    details: {
      actualWidth,
      actualHeight,
      dimensionMismatch,
      aspectMismatch,
      selfieDuplicate,
      matchingReferenceLabel: matchingReference?.label ?? null,
      uncertainCount,
      autoReject
    }
  }
}

function parseStructuredEvaluation(text: string): StructuredEvaluation | null {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    Logger.warn('No JSON found in evaluation response', { response: text })
    return null
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // Normalize and validate all required fields
    const evaluation: StructuredEvaluation = {
      dimensions_and_aspect_correct: normalizeYesNo(parsed.dimensions_and_aspect_correct),
      is_fully_generated: normalizeYesNoUncertain(parsed.is_fully_generated),
      composition_matches_shot: 'N/A' as const, // Temporarily disabled
      identity_preserved: normalizeYesNoUncertain(parsed.identity_preserved),
      proportions_realistic: normalizeYesNoUncertain(parsed.proportions_realistic),
      no_unauthorized_accessories: normalizeYesNoUncertain(parsed.no_unauthorized_accessories),
      no_visible_reference_labels: normalizeYesNoUncertain(parsed.no_visible_reference_labels),
      custom_background_matches: normalizeYesNoNA(parsed.custom_background_matches),
      branding_logo_matches: normalizeYesNoNA(parsed.branding_logo_matches),
      branding_positioned_correctly: normalizeYesNoNA(parsed.branding_positioned_correctly),
      branding_scene_aligned: normalizeYesNoNA(parsed.branding_scene_aligned),
      clothing_logo_no_overflow: normalizeYesNoNA(parsed.clothing_logo_no_overflow),
      explanations:
        typeof parsed.explanations === 'object' && parsed.explanations !== null
          ? (parsed.explanations as Record<string, string>)
          : {}
    }

    return evaluation
  } catch (error) {
    Logger.warn('Failed to parse structured evaluation JSON', {
      error: error instanceof Error ? error.message : String(error),
      response: text
    })
    return null
  }
}

function normalizeYesNo(value: unknown): 'YES' | 'NO' {
  if (typeof value !== 'string') {
    return 'NO'
  }
  const normalized = value.trim().toUpperCase()
  return normalized === 'YES' ? 'YES' : 'NO'
}

function normalizeYesNoUncertain(value: unknown): 'YES' | 'NO' | 'UNCERTAIN' {
  if (typeof value !== 'string') {
    return 'UNCERTAIN'
  }
  const normalized = value.trim().toUpperCase()
  if (normalized === 'YES') return 'YES'
  if (normalized === 'NO') return 'NO'
  return 'UNCERTAIN'
}

function normalizeYesNoNA(value: unknown): 'YES' | 'NO' | 'N/A' {
  if (typeof value !== 'string') {
    return 'N/A'
  }
  const normalized = value.trim().toUpperCase()
  if (normalized === 'YES') return 'YES'
  if (normalized === 'NO') return 'NO'
  return 'N/A'
}

