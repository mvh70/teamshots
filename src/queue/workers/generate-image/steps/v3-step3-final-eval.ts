import { Logger } from '@/lib/logger'
import sharp from 'sharp'
import type { Step8Output } from '@/types/generation'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { hasValue } from '@/domain/style/elements/base/element-types'
import { detectImageFormat } from '@/lib/image-format'
import { generateTextWithGemini, type GeminiReferenceImage } from '../gemini'
import { AI_CONFIG, EVALUATION_CONFIG, PROMINENCE, STAGE_MODEL } from '../config'
import type { CostTrackingHandler } from '../workflow-v3'
import { logPrompt } from '../utils/logging'
import {
  normalizeYesNoUncertain,
  getFaceSimilarityScore,
  parseLastJsonObject,
  safeCostTrack,
} from '../utils/evaluation-helpers'
import {
  buildStep3FinalEvalPrompt,
  generateStep3AdjustmentSuggestions,
} from './prompts/v3-step3-eval-prompt'

function toEvaluationReference(
  reference: Pick<BaseReferenceImage, 'base64' | 'mimeType'>
): { base64: string; mimeType: string } {
  return {
    base64: reference.base64,
    mimeType: reference.mimeType || 'image/png',
  }
}

export interface V3Step3EvalArtifacts {
  mustFollowRules: string[]
  freedomRules: string[]
}

export interface V3Step3FinalInput {
  refinedBuffer: Buffer
  selfieComposite?: BaseReferenceImage
  faceComposite?: BaseReferenceImage
  bodyComposite?: BaseReferenceImage
  expectedWidth: number
  expectedHeight: number
  aspectRatio: string
  logoReference?: BaseReferenceImage
  styleSettings?: PhotoStyleSettings
  evaluateBrandingPlacement?: boolean
  canonicalPrompt?: Record<string, unknown>
  step3EvalArtifacts: V3Step3EvalArtifacts
  generationId?: string
  intermediateS3Key?: string
  onCostTracking?: CostTrackingHandler
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function normalizeRule(rule: string): string {
  return rule.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function isBrandingSpecificRule(rule: string): boolean {
  const normalized = normalizeRule(rule)
  return (
    normalized.includes('logo') ||
    normalized.includes('brand') ||
    normalized.includes('trademark') ||
    normalized.includes('chroma') ||
    normalized.includes('branding placement')
  )
}

export async function executeV3Step3(input: V3Step3FinalInput): Promise<Step8Output> {
  const {
    refinedBuffer,
    selfieComposite,
    faceComposite,
    bodyComposite,
    expectedWidth,
    expectedHeight,
    aspectRatio,
    logoReference,
    styleSettings,
    evaluateBrandingPlacement,
    canonicalPrompt,
    step3EvalArtifacts,
  } = input

  const metadata = await sharp(refinedBuffer).metadata()
  const detectedRefinedFormat = await detectImageFormat(refinedBuffer)
  const refinedForEvaluation = {
    base64: refinedBuffer.toString('base64'),
    mimeType: detectedRefinedFormat.mimeType,
  }

  let brandingInfo: { position?: string; placement?: string } | undefined
  const sceneBranding = asObject(asObject(canonicalPrompt?.scene)?.branding)
  const styleBranding =
    styleSettings?.branding && hasValue(styleSettings.branding) ? styleSettings.branding.value : undefined
  const defaultShouldEvaluateBrandingPlacement =
    styleBranding?.type === 'include' &&
    (styleBranding.position === 'background' || styleBranding.position === 'elements')
  const shouldEvaluateBrandingPlacement =
    evaluateBrandingPlacement ?? defaultShouldEvaluateBrandingPlacement

  if (shouldEvaluateBrandingPlacement && logoReference) {
    brandingInfo = {
      position:
        (sceneBranding?.position as string | undefined) ||
        (styleBranding?.position as string | undefined),
      placement: sceneBranding?.placement as string | undefined,
    }
  }

  const actualWidth = metadata.width
  const actualHeight = metadata.height

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

  if (dimensionMismatch || aspectMismatch) {
    const dimIssue = dimensionMismatch
      ? `Dimension mismatch (expected ${expectedWidth}x${expectedHeight}px, actual ${actualWidth ?? 'unknown'}x${actualHeight ?? 'unknown'}px)`
      : ''
    const aspectIssue = aspectMismatch
      ? `Aspect ratio mismatch (expected ${aspectRatio} ≈${expectedRatio.toFixed(4)}, actual ${actualRatio !== null ? actualRatio.toFixed(4) : 'unknown'})`
      : ''
    const reason = [dimIssue, aspectIssue].filter(Boolean).join('; ')

    return {
      evaluation: {
        status: 'Not Approved',
        reason,
        failedCriteria: [reason],
      },
    }
  }

  const evalPromptText = buildStep3FinalEvalPrompt({
    prominenceEvalLabel: PROMINENCE.evalLabel,
    brandingInfo,
    includeBrandingCriterion: Boolean(brandingInfo && logoReference),
    mustFollowRules: shouldEvaluateBrandingPlacement
      ? step3EvalArtifacts.mustFollowRules
      : step3EvalArtifacts.mustFollowRules.filter((rule) => !isBrandingSpecificRule(rule)),
    freedomRules: shouldEvaluateBrandingPlacement
      ? step3EvalArtifacts.freedomRules
      : step3EvalArtifacts.freedomRules.filter((rule) => !isBrandingSpecificRule(rule)),
  })
  logPrompt('V3 Step 3 Eval', evalPromptText, input.generationId)

  const evalImages: GeminiReferenceImage[] = [
    {
      mimeType: refinedForEvaluation.mimeType,
      base64: refinedForEvaluation.base64,
      description: 'Final refined image to evaluate',
    },
  ]

  if (selfieComposite) {
    const evalSelfieComposite = toEvaluationReference(selfieComposite)
    evalImages.push({
      mimeType: evalSelfieComposite.mimeType,
      base64: evalSelfieComposite.base64,
      description: selfieComposite.description || 'Selfie composite reference',
    })
  } else {
    if (faceComposite) {
      const evalFaceComposite = toEvaluationReference(faceComposite)
      evalImages.push({
        mimeType: evalFaceComposite.mimeType,
        base64: evalFaceComposite.base64,
        description: faceComposite.description || 'FACE REFERENCE',
      })
    }
    if (bodyComposite) {
      const evalBodyComposite = toEvaluationReference(bodyComposite)
      evalImages.push({
        mimeType: evalBodyComposite.mimeType,
        base64: evalBodyComposite.base64,
        description: bodyComposite.description || 'BODY REFERENCE',
      })
    }
  }

  if (brandingInfo && logoReference) {
    const evalLogoReference = toEvaluationReference(logoReference)
    evalImages.push({
      mimeType: evalLogoReference.mimeType,
      base64: evalLogoReference.base64,
      description: logoReference.description || 'Logo reference',
    })
  }

  let evalDurationMs = 0
  let usageMetadata: { inputTokens?: number; outputTokens?: number } | undefined
  let providerUsed: 'vertex' | 'gemini-rest' | 'openrouter' | undefined
  let parsedEvaluation:
    | {
        face_similarity: 'YES' | 'NO' | 'UNCERTAIN'
        characteristic_preservation: 'YES' | 'NO' | 'UNCERTAIN'
        person_prominence: 'YES' | 'NO' | 'UNCERTAIN'
        overall_quality: 'YES' | 'NO' | 'UNCERTAIN'
        branding_placement?: 'YES' | 'NO' | 'UNCERTAIN'
        explanations: Record<string, string>
      }
    | null = null

  for (let evalAttempt = 1; evalAttempt <= EVALUATION_CONFIG.MAX_EVAL_RETRIES; evalAttempt++) {
    const evalStartTime = Date.now()
    try {
      const response = await generateTextWithGemini(evalPromptText, evalImages, {
        temperature: AI_CONFIG.EVALUATION_TEMPERATURE,
        stage: 'EVALUATION',
      })

      evalDurationMs = response.usage.durationMs
      usageMetadata = {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      }
      providerUsed = response.providerUsed

      parsedEvaluation = parseFinalEvaluation(response.text)
      if (parsedEvaluation) break

      Logger.warn('V3 Step 3: Parsing failed, retrying evaluation', {
        evalAttempt,
        maxRetries: EVALUATION_CONFIG.MAX_EVAL_RETRIES,
        responsePreview: response.text.substring(0, 500),
      })
    } catch (error) {
      evalDurationMs = Date.now() - evalStartTime
      const message = error instanceof Error ? error.message : String(error)

      await safeCostTrack(
        input.onCostTracking
          ? () =>
              input.onCostTracking!({
                stepName: 'step3-final-eval',
                reason: 'evaluation',
                result: 'failure',
                model: STAGE_MODEL.EVALUATION,
                provider: providerUsed,
                durationMs: evalDurationMs,
                errorMessage: message,
              })
          : undefined,
        { step: 'V3 Step 3', generationId: input.generationId }
      )

      if (evalAttempt === EVALUATION_CONFIG.MAX_EVAL_RETRIES) {
        throw error
      }
    }
  }

  if (!parsedEvaluation) {
    const rejectionReason = `Evaluation did not return a valid structured response after ${EVALUATION_CONFIG.MAX_EVAL_RETRIES} attempts.`

    await safeCostTrack(
      input.onCostTracking
        ? () =>
            input.onCostTracking!({
              stepName: 'step3-final-eval',
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
      { step: 'V3 Step 3', generationId: input.generationId }
    )

    return {
      evaluation: {
        status: 'Not Approved',
        reason: rejectionReason,
      },
    }
  }

  const autoReject =
    parsedEvaluation.face_similarity === 'NO' ||
    parsedEvaluation.characteristic_preservation === 'NO'

  const baseApproved =
    parsedEvaluation.face_similarity === 'YES' &&
    parsedEvaluation.characteristic_preservation === 'YES' &&
    parsedEvaluation.person_prominence === 'YES' &&
    parsedEvaluation.overall_quality === 'YES'

  const brandingApproved = brandingInfo && logoReference
    ? parsedEvaluation.branding_placement === 'YES'
    : true

  const finalStatus: 'Approved' | 'Not Approved' = autoReject || !(baseApproved && brandingApproved)
    ? 'Not Approved'
    : 'Approved'

  const failedCriteria: string[] = []
  const brandingCriterionActive = Boolean(brandingInfo && logoReference)
  for (const [key, value] of Object.entries(parsedEvaluation)) {
    if (key === 'explanations') continue
    if (key === 'branding_placement' && !brandingCriterionActive) continue
    if (value === 'NO' || value === 'UNCERTAIN') {
      const explanation = parsedEvaluation.explanations[key] || 'No explanation provided'
      failedCriteria.push(`${key}: ${value} (${explanation})`)
    }
  }

  const finalReason = failedCriteria.length > 0 ? failedCriteria.join(' | ') : 'All criteria met'

  Logger.info('V3 Step 3: Evaluation result', {
    generationId: input.generationId,
    status: finalStatus,
    faceSimilarityScore: getFaceSimilarityScore(parsedEvaluation.face_similarity),
    failedCount: failedCriteria.length,
  })

  await safeCostTrack(
    input.onCostTracking
      ? () =>
          input.onCostTracking!({
            stepName: 'step3-final-eval',
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
    { step: 'V3 Step 3', generationId: input.generationId }
  )

  return {
    evaluation: {
      status: finalStatus,
      reason: finalReason,
      failedCriteria: failedCriteria.length > 0 ? failedCriteria : undefined,
      suggestedAdjustments:
        finalStatus === 'Not Approved'
          ? generateStep3AdjustmentSuggestions(failedCriteria, PROMINENCE.evalLabel)
          : undefined,
    },
  }
}

function parseFinalEvaluation(text: string) {
  const jsonText = parseLastJsonObject(text)
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const explanations: Record<string, string> =
      typeof parsed.explanations === 'object' &&
      parsed.explanations !== null &&
      !Array.isArray(parsed.explanations)
        ? Object.entries(parsed.explanations as Record<string, unknown>).reduce<Record<string, string>>(
            (acc, [key, value]) => {
              if (key.length <= 100 && typeof value === 'string' && value.length <= 500) {
                acc[key] = value
              }
              return acc
            },
            {}
          )
        : {}

    const result: {
      face_similarity: 'YES' | 'NO' | 'UNCERTAIN'
      characteristic_preservation: 'YES' | 'NO' | 'UNCERTAIN'
      person_prominence: 'YES' | 'NO' | 'UNCERTAIN'
      overall_quality: 'YES' | 'NO' | 'UNCERTAIN'
      branding_placement?: 'YES' | 'NO' | 'UNCERTAIN'
      explanations: Record<string, string>
    } = {
      face_similarity: normalizeYesNoUncertain(parsed.face_similarity),
      characteristic_preservation: normalizeYesNoUncertain(parsed.characteristic_preservation),
      person_prominence: normalizeYesNoUncertain(parsed.person_prominence),
      overall_quality: normalizeYesNoUncertain(parsed.overall_quality),
      explanations,
    }

    if (parsed.branding_placement !== undefined) {
      result.branding_placement = normalizeYesNoUncertain(parsed.branding_placement)
    }

    return result
  } catch (error) {
    Logger.warn('Failed to parse final evaluation JSON', {
      error: error instanceof Error ? error.message : String(error),
      responsePreview: text.substring(0, 500),
    })
    return null
  }
}
