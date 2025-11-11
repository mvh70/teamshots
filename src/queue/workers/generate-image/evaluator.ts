import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { getVertexGenerativeModel } from './gemini'
import type { Content, GenerateContentResult, Part } from '@google-cloud/vertexai'

export interface SelfieReference {
  label: string
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
}

export interface StructuredEvaluation {
  dimensions_and_aspect_correct: 'YES' | 'NO'
  is_fully_generated: 'YES' | 'NO' | 'UNCERTAIN'
  composition_matches_shot: 'YES' | 'NO' | 'UNCERTAIN'
  identity_preserved: 'YES' | 'NO' | 'UNCERTAIN'
  proportions_realistic: 'YES' | 'NO' | 'UNCERTAIN'
  no_unauthorized_accessories: 'YES' | 'NO' | 'UNCERTAIN'
  branding_logo_matches: 'YES' | 'NO' | 'N/A'
  branding_positioned_correctly: 'YES' | 'NO' | 'N/A'
  branding_scene_aligned: 'YES' | 'NO' | 'N/A'
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

const DIMENSION_TOLERANCE_PX = 2
const ASPECT_RATIO_TOLERANCE = 0.02

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
  logoReference
}: ImageEvaluationInput): Promise<ImageEvaluationResult> {
  const modelName = Env.string('GEMINI_EVAL_MODEL', Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash'))
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
    '3. composition_matches_shot',
    `   - Shot guidance: ${shotLabel} — ${shotDescription}`,
    '   - Does subject positioning, framing, and background match without awkward cropping?',
    '',
    '4. identity_preserved',
    '   - Does the face clearly resemble the reference selfies?',
    '   - Is facial identity consistent and recognizable?',
    '',
    '5. proportions_realistic',
    '   - Is head size consistent with body, limbs, and torso?',
    '   - Are there NO exaggerated or shrunken anatomical features?',
    '',
    '6. no_unauthorized_accessories',
    '   - Compare the reference selfies to the generated image',
    '   - Are there NO accessories (glasses, jewelry, piercings, tattoos, hats)',
    '     that are ABSENT from the reference selfies?'
  ]

  if (logoReference) {
    baseInstructions.push(
      '',
      '7. branding_logo_matches',
      '   - Does the logo in the generated image match the provided brand asset?',
      '   - Are colors, proportions, and design elements preserved (no distortion)?',
      '',
      '8. branding_positioned_correctly',
      '   - Is the logo placed in the designated location shown in reference assets?',
      '   - Does it appear exactly ONCE (not duplicated or missing)?',
      '',
      '9. branding_scene_aligned',
      '   - Is the logo integrated naturally into the scene?',
      '   - Does lighting, perspective, and scale match the environment?'
    )
  } else {
    baseInstructions.push(
      '',
      '7. branding_logo_matches: N/A (no logo required)',
      '8. branding_positioned_correctly: N/A (no logo required)',
      '9. branding_scene_aligned: N/A (no logo required)'
    )
  }

  baseInstructions.push(
    '',
    'Return ONLY valid JSON with all fields and an explanations object.',
    'Example format:',
    '{',
    '  "dimensions_and_aspect_correct": "YES",',
    '  "is_fully_generated": "YES",',
    '  "composition_matches_shot": "YES",',
    '  "identity_preserved": "YES",',
    '  "proportions_realistic": "YES",',
    '  "no_unauthorized_accessories": "YES",',
    '  "branding_logo_matches": "N/A",',
    '  "branding_positioned_correctly": "N/A",',
    '  "branding_scene_aligned": "N/A",',
    '  "explanations": {',
    '    "dimensions_and_aspect_correct": "Image meets size requirements",',
    '    "is_fully_generated": "Fully AI-generated, no selfie portions visible",',
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

  if (logoReference) {
    parts.push({
      text: logoReference.description ?? 'Official branding/logo asset for comparison.'
    })
    parts.push({
      inlineData: { mimeType: logoReference.mimeType, data: logoReference.base64 }
    })
  }

  if (selfieReferences.length > 0) {
    parts.push({
      text: 'Reference selfies provided for comparison:'
    })
  }

  for (const selfie of selfieReferences) {
    parts.push({ text: `Reference ${selfie.label}` })
    parts.push({
      inlineData: { mimeType: selfie.mimeType, data: selfie.base64 }
    })
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
        temperature: 0.1
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
    structuredEvaluation.composition_matches_shot === 'NO',
    structuredEvaluation.identity_preserved === 'NO',
    structuredEvaluation.proportions_realistic === 'NO',
    structuredEvaluation.no_unauthorized_accessories === 'NO',
    structuredEvaluation.branding_logo_matches === 'NO',
    structuredEvaluation.branding_positioned_correctly === 'NO',
    structuredEvaluation.branding_scene_aligned === 'NO'
  ].some(Boolean)

  // Count uncertain responses
  const uncertainCount = Object.values(structuredEvaluation).filter((v) => v === 'UNCERTAIN').length

  // Approval: ALL must be YES (or N/A for branding)
  const allApproved =
    structuredEvaluation.dimensions_and_aspect_correct === 'YES' &&
    structuredEvaluation.is_fully_generated === 'YES' &&
    structuredEvaluation.composition_matches_shot === 'YES' &&
    structuredEvaluation.identity_preserved === 'YES' &&
    structuredEvaluation.proportions_realistic === 'YES' &&
    structuredEvaluation.no_unauthorized_accessories === 'YES' &&
    (structuredEvaluation.branding_logo_matches === 'YES' ||
      structuredEvaluation.branding_logo_matches === 'N/A') &&
    (structuredEvaluation.branding_positioned_correctly === 'YES' ||
      structuredEvaluation.branding_positioned_correctly === 'N/A') &&
    (structuredEvaluation.branding_scene_aligned === 'YES' ||
      structuredEvaluation.branding_scene_aligned === 'N/A') &&
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
      composition_matches_shot: normalizeYesNoUncertain(parsed.composition_matches_shot),
      identity_preserved: normalizeYesNoUncertain(parsed.identity_preserved),
      proportions_realistic: normalizeYesNoUncertain(parsed.proportions_realistic),
      no_unauthorized_accessories: normalizeYesNoUncertain(parsed.no_unauthorized_accessories),
      branding_logo_matches: normalizeYesNoNA(parsed.branding_logo_matches),
      branding_positioned_correctly: normalizeYesNoNA(parsed.branding_positioned_correctly),
      branding_scene_aligned: normalizeYesNoNA(parsed.branding_scene_aligned),
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

