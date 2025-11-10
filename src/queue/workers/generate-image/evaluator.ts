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

export interface ImageEvaluationResult {
  status: 'Approved' | 'Not Approved'
  reason: string
  rawResponse?: unknown
  details: {
    actualWidth: number | null
    actualHeight: number | null
    dimensionMismatch: boolean
    aspectMismatch: boolean
    selfieDuplicate: boolean
    matchingReferenceLabel?: string | null
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
    `Evaluate candidate portrait variation ${imageIndex + 1}.`,
    `Expected dimensions: ${expectedWidth}x${expectedHeight}px (tolerance ±${DIMENSION_TOLERANCE_PX}px).`,
    `Actual dimensions: ${actualWidth ?? 'unknown'}x${actualHeight ?? 'unknown'}px.`,
    `Expected aspect ratio [${aspectRatioId}]: ${aspectRatioDescription} (≈ ${expectedRatio.toFixed(4)}).`,
    actualRatio
      ? `Actual aspect ratio: ${(actualRatio || 0).toFixed(4)}`
      : 'Actual aspect ratio cannot be determined from metadata.',
    `Shot guidance: ${shotLabel} — ${shotDescription}.`,
    'Criteria:',
    '1. Dimensions respect the expected size (within tolerance).',
    '2. Aspect ratio is correct.',
    '3. The generated image is not simply one of the provided selfies (it must be a new render).',
    '4. Composition/layout matches the shot guidance (subject positioning, framing, background) without awkward cropping.',
    '5. Identity fidelity: the face must clearly resemble the provided selfies. Do not introduce accessories or features (like glasses, piercings, tattoos) that are absent from the selfies.',
    '6. Subject proportions must be realistic: head size should be consistent with the body, limbs, and torso—no exaggerated or shrunken anatomy.',
    'Return ONLY JSON with fields "status" (Approved | Not Approved) and "reason" (short explanation).'
  ]

  if (logoReference) {
    baseInstructions.splice(
      baseInstructions.length - 1,
      0,
      '7. Branding: place the logo exactly once in the designated location shown in the reference assets. The logo must match the provided brand asset (no color or aspect distortion) and should not appear elsewhere.'
    )
  }

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

  let parsedStatus: 'Approved' | 'Not Approved' = 'Not Approved'
  let parsedReason = 'Evaluation did not return a valid response.'
  let rawResponse: unknown = null

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
      const parsed = parseJsonSafely(textPart)
      if (parsed) {
        const normalizedStatus = normalizeStatus(parsed.status)
        parsedStatus = normalizedStatus
        parsedReason =
          typeof parsed.reason === 'string'
            ? parsed.reason.trim()
            : Array.isArray(parsed.reason)
              ? parsed.reason.join(' | ')
              : parsedReason
      }
    }
  } catch (error) {
    Logger.error('Failed to run Gemini evaluation for generated image', {
      error: error instanceof Error ? error.message : String(error),
      imageIndex
    })
    throw error
  }

  const overrideReasons: string[] = []
  if (dimensionMismatch) {
    overrideReasons.push(
      `Dimension mismatch (expected ${expectedWidth}x${expectedHeight}px, actual ${actualWidth ?? 'unknown'}x${actualHeight ?? 'unknown'}px)`
    )
  }
  if (aspectMismatch) {
    overrideReasons.push(
      `Aspect ratio mismatch (expected ≈${expectedRatio.toFixed(4)}, actual ${
        actualRatio !== null ? actualRatio.toFixed(4) : 'unknown'
      })`
    )
  }
  if (selfieDuplicate) {
    overrideReasons.push(
      `Generated image matches reference selfie ${
        matchingReference?.label ?? 'unknown'
      } exactly`
    )
  }

  let finalStatus = parsedStatus
  let finalReason = parsedReason

  if (overrideReasons.length > 0) {
    finalStatus = 'Not Approved'
    const reasonParts = [...overrideReasons]
    if (parsedReason && parsedReason !== 'Evaluation did not return a valid response.') {
      reasonParts.push(parsedReason)
    }
    finalReason = reasonParts.join(' | ')
  }

  return {
    status: finalStatus,
    reason: finalReason,
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

function parseJsonSafely(
  text: string
): { status?: unknown; reason?: unknown } | null {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return null
  }
  try {
    return JSON.parse(jsonMatch[0]) as { status?: unknown; reason?: unknown }
  } catch (error) {
    Logger.warn('Failed to parse evaluation JSON response', {
      error: error instanceof Error ? error.message : String(error),
      response: text
    })
    return null
  }
}

function normalizeStatus(value: unknown): 'Approved' | 'Not Approved' {
  if (typeof value !== 'string') {
    return 'Not Approved'
  }
  const normalized = value.trim().toLowerCase()
  return normalized === 'approved' ? 'Approved' : 'Not Approved'
}

