import { Logger } from '@/lib/logger'
import { generateTextWithGemini, type GeminiReferenceImage } from '../gemini'
import { AI_CONFIG, EVALUATION_CONFIG, STAGE_MODEL } from '../config'
import sharp from 'sharp'
import { z } from 'zod'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import type { ImageEvaluationResult, StructuredEvaluation } from '../evaluator'
import type { ReferenceImage } from '../utils/reference-builder'
import type { CostTrackingHandler } from '../workflow-v3'
import { logPrompt } from '../utils/logging'
import { detectImageFormat } from '@/lib/image-format'
import {
  parseLastJsonObject,
  normalizeYesNo,
  normalizeYesNoNA,
  normalizeYesNoUncertain,
  getFaceSimilarityScore,
  safeCostTrack,
} from '../utils/evaluation-helpers'
import {
  buildStep1aEvalPrompt,
  STEP1A_EVAL_DEFAULT_EXPLANATIONS,
} from './prompts/v3-step1a-eval-prompt'
import { projectStep1aPromptPayload } from './prompts/v3-step1a-prompt'

function toEvaluationReference(
  reference: Pick<BaseReferenceImage, 'base64' | 'mimeType'>
): { base64: string; mimeType: string } {
  return {
    base64: reference.base64,
    mimeType: reference.mimeType || 'image/png',
  }
}

function extensionFromMimeType(mimeType?: string): string {
  const normalized = (mimeType || '').toLowerCase()
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('webp')) return 'webp'
  return 'jpg'
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export interface V3Step1aEvalInput {
  imageBuffer: Buffer
  selfieReferences: ReferenceImage[]
  selfieComposite?: BaseReferenceImage
  faceComposite?: BaseReferenceImage
  bodyComposite?: BaseReferenceImage
  expectedWidth: number
  expectedHeight: number
  aspectRatioConfig: { id: string; width: number; height: number }
  generationPrompt: string
  garmentCollageReference?: BaseReferenceImage
  generationId?: string
  personId?: string
  teamId?: string
  intermediateS3Key?: string
  onCostTracking?: CostTrackingHandler
}

export interface V3Step1aEvalOutput {
  evaluation: ImageEvaluationResult
}

const structuredSchema = z.object({
  dimensions_and_aspect_correct: z.unknown().optional(),
  is_fully_generated: z.unknown().optional(),
  composition_matches_shot: z.unknown().optional(),
  identity_preserved: z.unknown().optional(),
  proportions_realistic: z.unknown().optional(),
  no_unauthorized_add_ons: z.unknown().optional(),
  no_unauthorized_accessories: z.unknown().optional(),
  no_visible_reference_labels: z.unknown().optional(),
  custom_background_matches: z.unknown().optional(),
  branding_logo_matches: z.unknown().optional(),
  branding_positioned_correctly: z.unknown().optional(),
  branding_scene_aligned: z.unknown().optional(),
  clothing_logo_no_overflow: z.unknown().optional(),
  explanations: z.record(z.string(), z.string().max(500)).optional(),
})

export async function executeV3Step1aEval(
  input: V3Step1aEvalInput
): Promise<V3Step1aEvalOutput> {
  const {
    imageBuffer,
    selfieReferences,
    selfieComposite,
    faceComposite,
    bodyComposite,
    expectedWidth,
    expectedHeight,
    generationPrompt,
    garmentCollageReference,
  } = input

  let promptObj: Record<string, unknown>
  try {
    const parsed = JSON.parse(generationPrompt) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Generation prompt must be a JSON object')
    }
    promptObj = parsed as Record<string, unknown>
  } catch (error) {
    throw new Error(
      `V3 Step 1a Eval: Invalid generation prompt JSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  // Keep eval context in lockstep with Step 1a generation prompt projection.
  const step1aPromptContext = projectStep1aPromptPayload(promptObj)

  const shotType =
    ((step1aPromptContext.framing as { shot_type?: string } | undefined)?.shot_type as
      | string
      | undefined) || 'medium-shot'
  const shotLabel = shotType.replace(/-/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase())

  const subjectObj = asObject(step1aPromptContext.subject)
  const subjectWardrobe = asObject(subjectObj?.wardrobe)
  const topLevelWardrobe = asObject(step1aPromptContext.wardrobe)

  const inherentAccessories = [
    ...asStringArray(subjectWardrobe?.inherent_accessories),
    ...asStringArray(topLevelWardrobe?.inherent_accessories),
  ]
  const userAccessories = [
    ...asStringArray(subjectWardrobe?.accessories),
    ...asStringArray(topLevelWardrobe?.accessories),
  ]
  const authorizedAccessories = [...new Set([...inherentAccessories, ...userAccessories])]
  const subjectGender =
    ((asObject(subjectObj?.demographic_guidance)?.gender as string | undefined) || '')
      .trim()
      .toLowerCase()
  const hasFaceReference = Boolean(faceComposite || selfieComposite)
  const hasBodyReference = Boolean(bodyComposite || selfieComposite)

  const metadata = await sharp(imageBuffer).metadata()
  const actualWidth = metadata.width ?? null
  const actualHeight = metadata.height ?? null
  const detectedCandidateFormat = await detectImageFormat(imageBuffer)
  const candidateForEvaluation = {
    base64: imageBuffer.toString('base64'),
    mimeType: detectedCandidateFormat.mimeType,
  }

  const expectedRatio = expectedWidth / expectedHeight
  const actualRatio =
    actualWidth && actualHeight && actualHeight !== 0 ? actualWidth / actualHeight : null

  const dimensionMismatch =
    actualWidth === null ||
    actualHeight === null ||
    Math.abs(actualWidth - expectedWidth) > EVALUATION_CONFIG.DIMENSION_TOLERANCE_PX ||
    Math.abs(actualHeight - expectedHeight) > EVALUATION_CONFIG.DIMENSION_TOLERANCE_PX

  const aspectMismatch =
    actualRatio === null
      ? true
      : Math.abs(actualRatio - expectedRatio) > EVALUATION_CONFIG.ASPECT_RATIO_TOLERANCE

  // Removed unreliable PNG-vs-JPEG base64 equality check.
  const selfieDuplicate = false

  const fullPrompt = buildStep1aEvalPrompt({
    authorizedAccessories,
    promptContext: step1aPromptContext,
    hasFaceReference,
    hasBodyReference,
    subjectGender,
  })
  logPrompt('V3 Step 1a Eval', fullPrompt, input.generationId)

  const evalImages: GeminiReferenceImage[] = [
    {
      name: `step1a-candidate.${extensionFromMimeType(candidateForEvaluation.mimeType)}`,
      mimeType: candidateForEvaluation.mimeType,
      base64: candidateForEvaluation.base64,
      description: 'Candidate image to evaluate',
    },
  ]

  if (selfieComposite) {
    const evalSelfieComposite = toEvaluationReference(selfieComposite)
    evalImages.push({
      name:
        selfieComposite.name ||
        `selfie-composite.${extensionFromMimeType(evalSelfieComposite.mimeType)}`,
      mimeType: evalSelfieComposite.mimeType,
      base64: evalSelfieComposite.base64,
      description:
        selfieComposite.description ??
        'SELFIE COMPOSITE REFERENCE - Use face regions for identity and face/head accessories; use body regions for body proportions/form.',
    })
  } else {
    if (faceComposite) {
      const evalFaceComposite = toEvaluationReference(faceComposite)
      evalImages.push({
        name:
          faceComposite.name ||
          `face-reference.${extensionFromMimeType(evalFaceComposite.mimeType)}`,
        mimeType: evalFaceComposite.mimeType,
        base64: evalFaceComposite.base64,
        description:
          'FACE REFERENCE - Source of truth for facial identity and face/head accessories (e.g., glasses, earrings).',
      })
    }
    if (bodyComposite) {
      const evalBodyComposite = toEvaluationReference(bodyComposite)
      evalImages.push({
        name:
          bodyComposite.name ||
          `body-reference.${extensionFromMimeType(evalBodyComposite.mimeType)}`,
        mimeType: evalBodyComposite.mimeType,
        base64: evalBodyComposite.base64,
        description:
          subjectGender === 'female'
            ? 'BODY REFERENCE - Use ONLY for body proportions/form and natural female chest/breast shape. Do not use for face/head accessories.'
            : 'BODY REFERENCE - Use ONLY for body proportions/form. Do not use for face/head accessories.',
      })
    }
  }

  if (!selfieComposite && !faceComposite && !bodyComposite && selfieReferences.length > 0) {
    for (let i = 0; i < selfieReferences.length; i += 1) {
      const selfie = selfieReferences[i]
      evalImages.push({
        name:
          selfie.label && selfie.label.trim().length > 0
            ? selfie.label
            : `reference-selfie-${i + 1}.${extensionFromMimeType(selfie.mimeType)}`,
        mimeType: selfie.mimeType,
        base64: selfie.base64,
        description: `Reference selfie ${i + 1}`,
      })
    }
  }

  if (garmentCollageReference) {
    const evalGarmentCollage = toEvaluationReference(garmentCollageReference)
    evalImages.push({
      name:
        garmentCollageReference.name ||
        `garment-collage.${extensionFromMimeType(evalGarmentCollage.mimeType)}`,
      mimeType: evalGarmentCollage.mimeType,
      base64: evalGarmentCollage.base64,
      description:
        garmentCollageReference.description ??
        'Garment collage showing authorized clothing and accessories for this outfit.',
    })
  }

  let rawResponse: unknown = null
  let structuredEvaluation: StructuredEvaluation | null = null
  let evalDurationMs = 0
  let usageMetadata: { inputTokens?: number; outputTokens?: number } | undefined
  let providerUsed: 'vertex' | 'gemini-rest' | 'openrouter' | undefined

  for (let evalAttempt = 1; evalAttempt <= EVALUATION_CONFIG.MAX_EVAL_RETRIES; evalAttempt += 1) {
    const evalStartTime = Date.now()
    rawResponse = null
    structuredEvaluation = null

    try {
      const response = await generateTextWithGemini(fullPrompt, evalImages, {
        temperature: AI_CONFIG.EVALUATION_TEMPERATURE,
        stage: 'EVALUATION',
      })

      evalDurationMs = response.usage.durationMs
      usageMetadata = {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      }
      providerUsed = response.providerUsed
      rawResponse = response.text

      if (response.text) {
        structuredEvaluation = parseStructuredEvaluation(response.text)
      }

      if (structuredEvaluation) {
        break
      }

      Logger.warn('V3 Step 1a Eval: Parsing failed, retrying evaluation', {
        evalAttempt,
        maxRetries: EVALUATION_CONFIG.MAX_EVAL_RETRIES,
        rawResponsePreview:
          typeof rawResponse === 'string' ? rawResponse.substring(0, 500) : String(rawResponse),
      })
    } catch (error) {
      evalDurationMs = Date.now() - evalStartTime
      const message = error instanceof Error ? error.message : String(error)

      await safeCostTrack(
        input.onCostTracking
          ? () =>
              input.onCostTracking!({
                stepName: 'step1a-eval',
                reason: 'evaluation',
                result: 'failure',
                model: STAGE_MODEL.EVALUATION,
                provider: providerUsed,
                durationMs: evalDurationMs,
                errorMessage: message,
              })
          : undefined,
        { step: 'V3 Step 1a Eval', generationId: input.generationId }
      )

      if (evalAttempt === EVALUATION_CONFIG.MAX_EVAL_RETRIES) {
        throw error
      }
    }
  }

  if (!structuredEvaluation) {
    const rejectionReason = `Evaluation did not return a valid structured response after ${EVALUATION_CONFIG.MAX_EVAL_RETRIES} attempts.`

    await safeCostTrack(
      input.onCostTracking
        ? () =>
            input.onCostTracking!({
              stepName: 'step1a-eval',
              reason: 'evaluation',
              result: 'success',
              model: STAGE_MODEL.EVALUATION,
              provider: providerUsed,
              inputTokens: usageMetadata?.inputTokens,
              outputTokens: usageMetadata?.outputTokens,
              durationMs: evalDurationMs,
              evaluationStatus: 'rejected',
              rejectionReason,
              intermediateS3Key: input.intermediateS3Key,
            })
        : undefined,
      { step: 'V3 Step 1a Eval', generationId: input.generationId }
    )

    return {
      evaluation: {
        status: 'Not Approved',
        reason: rejectionReason,
        rawResponse: typeof rawResponse === 'string' ? rawResponse.substring(0, 500) : rawResponse,
        details: {
          actualWidth,
          actualHeight,
          dimensionMismatch,
          aspectMismatch,
          selfieDuplicate,
          matchingReferenceLabel: null,
          uncertainCount: undefined,
          autoReject: undefined,
        },
      },
    }
  }

  structuredEvaluation.dimensions_and_aspect_correct = 'YES'
  structuredEvaluation.explanations.dimensions_and_aspect_correct =
    'N/A (not evaluated in Step 1a - dimensions checked programmatically)'

  structuredEvaluation.custom_background_matches = 'N/A'
  structuredEvaluation.explanations.custom_background_matches =
    STEP1A_EVAL_DEFAULT_EXPLANATIONS.custom_background_matches

  structuredEvaluation.branding_logo_matches = 'N/A'
  structuredEvaluation.branding_positioned_correctly = 'N/A'
  structuredEvaluation.branding_scene_aligned = 'N/A'
  structuredEvaluation.clothing_logo_no_overflow = 'N/A'
  structuredEvaluation.explanations.branding_logo_matches =
    STEP1A_EVAL_DEFAULT_EXPLANATIONS.branding_logo_matches
  structuredEvaluation.explanations.branding_positioned_correctly =
    STEP1A_EVAL_DEFAULT_EXPLANATIONS.branding_positioned_correctly
  structuredEvaluation.explanations.branding_scene_aligned =
    STEP1A_EVAL_DEFAULT_EXPLANATIONS.branding_scene_aligned
  structuredEvaluation.explanations.clothing_logo_no_overflow =
    STEP1A_EVAL_DEFAULT_EXPLANATIONS.clothing_logo_no_overflow

  const autoReject = [
    structuredEvaluation.is_fully_generated === 'NO',
    structuredEvaluation.is_fully_generated === 'UNCERTAIN',
    structuredEvaluation.identity_preserved === 'NO',
    structuredEvaluation.proportions_realistic === 'NO',
    structuredEvaluation.no_unauthorized_add_ons === 'NO',
    structuredEvaluation.no_unauthorized_add_ons === 'UNCERTAIN',
    structuredEvaluation.no_unauthorized_accessories === 'NO',
    structuredEvaluation.no_unauthorized_accessories === 'UNCERTAIN',
    structuredEvaluation.no_visible_reference_labels === 'NO',
    structuredEvaluation.no_visible_reference_labels === 'UNCERTAIN',
  ].some(Boolean)

  const uncertainCount = Object.entries(structuredEvaluation)
    .filter(([key]) => key !== 'explanations')
    .filter(([, value]) => value === 'UNCERTAIN').length

  const allApproved =
    structuredEvaluation.is_fully_generated === 'YES' &&
    (structuredEvaluation.composition_matches_shot === 'YES' ||
      structuredEvaluation.composition_matches_shot === 'N/A') &&
    structuredEvaluation.identity_preserved === 'YES' &&
    structuredEvaluation.proportions_realistic === 'YES' &&
    structuredEvaluation.no_unauthorized_add_ons === 'YES' &&
    structuredEvaluation.no_unauthorized_accessories === 'YES' &&
    structuredEvaluation.no_visible_reference_labels === 'YES' &&
    uncertainCount === 0

  const finalStatus: 'Approved' | 'Not Approved' = autoReject || !allApproved ? 'Not Approved' : 'Approved'

  const failedCriteria: string[] = []
  for (const [key, value] of Object.entries(structuredEvaluation)) {
    if (key === 'explanations') continue
    if (value === 'NO' || value === 'UNCERTAIN') {
      const explanation = structuredEvaluation.explanations[key] || 'No explanation provided'
      failedCriteria.push(`${key}: ${value} (${explanation})`)
    }
  }

  const finalReason = failedCriteria.length > 0 ? failedCriteria.join(' | ') : 'All criteria met'

  Logger.info(`V3 Step 1a Eval: ${finalStatus}`, {
    generationId: input.generationId,
    shotLabel,
    reasonPreview: finalReason.substring(0, 120),
    identityScore: getFaceSimilarityScore(structuredEvaluation.identity_preserved),
  })

  await safeCostTrack(
    input.onCostTracking
      ? () =>
          input.onCostTracking!({
            stepName: 'step1a-eval',
            reason: 'evaluation',
            result: 'success',
            model: STAGE_MODEL.EVALUATION,
            provider: providerUsed,
            inputTokens: usageMetadata?.inputTokens,
            outputTokens: usageMetadata?.outputTokens,
            durationMs: evalDurationMs,
            evaluationStatus: finalStatus === 'Approved' ? 'approved' : 'rejected',
            rejectionReason: finalStatus === 'Not Approved' ? finalReason : undefined,
            intermediateS3Key: input.intermediateS3Key,
          })
      : undefined,
    { step: 'V3 Step 1a Eval', generationId: input.generationId }
  )

  return {
    evaluation: {
      status: finalStatus,
      reason: finalReason,
      rawResponse: typeof rawResponse === 'string' ? rawResponse.substring(0, 500) : rawResponse,
      structuredEvaluation,
      details: {
        actualWidth,
        actualHeight,
        dimensionMismatch,
        aspectMismatch,
        selfieDuplicate,
        matchingReferenceLabel: null,
        uncertainCount,
        autoReject,
      },
    },
  }
}

function parseStructuredEvaluation(text: string): StructuredEvaluation | null {
  const jsonText = parseLastJsonObject(text)
  if (!jsonText) {
    Logger.warn('No JSON found in evaluation response', {
      responsePreview: text.substring(0, 500),
    })
    return null
  }

  try {
    const parsedRaw = JSON.parse(jsonText) as unknown
    const parsed = structuredSchema.parse(parsedRaw)

    return {
      dimensions_and_aspect_correct: normalizeYesNo(parsed.dimensions_and_aspect_correct),
      is_fully_generated: normalizeYesNoUncertain(parsed.is_fully_generated),
      composition_matches_shot: 'N/A',
      identity_preserved: normalizeYesNoUncertain(parsed.identity_preserved),
      proportions_realistic: normalizeYesNoUncertain(parsed.proportions_realistic),
      no_unauthorized_add_ons: normalizeYesNoUncertain(parsed.no_unauthorized_add_ons),
      no_unauthorized_accessories: normalizeYesNoUncertain(parsed.no_unauthorized_accessories),
      no_visible_reference_labels: normalizeYesNoUncertain(parsed.no_visible_reference_labels),
      custom_background_matches: normalizeYesNoNA(parsed.custom_background_matches),
      branding_logo_matches: normalizeYesNoNA(parsed.branding_logo_matches),
      branding_positioned_correctly: normalizeYesNoNA(parsed.branding_positioned_correctly),
      branding_scene_aligned: normalizeYesNoNA(parsed.branding_scene_aligned),
      clothing_logo_no_overflow: normalizeYesNoNA(parsed.clothing_logo_no_overflow),
      explanations: parsed.explanations || {},
    }
  } catch (error) {
    Logger.warn('Failed to parse structured evaluation JSON', {
      error: error instanceof Error ? error.message : String(error),
      responsePreview: text.substring(0, 500),
    })
    return null
  }
}
