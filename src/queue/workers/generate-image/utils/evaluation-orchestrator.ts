import { Logger } from '@/lib/logger'
import type { EvaluationFeedback } from '@/types/generation'
import type { ImageEvaluationResult, StructuredEvaluation } from '../evaluator'

/**
 * Build structured evaluation feedback from evaluation result
 * Consolidates duplicate feedback building logic
 */
export function buildEvaluationFeedback(evaluation: ImageEvaluationResult): EvaluationFeedback {
  return {
    status: evaluation.status,
    reason: evaluation.reason,
    failedCriteria: evaluation.structuredEvaluation
      ? extractFailedCriteria(evaluation.structuredEvaluation)
      : undefined,
    suggestedAdjustments: evaluation.structuredEvaluation
      ? extractSuggestedAdjustments(evaluation.structuredEvaluation)
      : evaluation.reason
  }
}

/**
 * Extract failed criteria from structured evaluation
 */
function extractFailedCriteria(structuredEvaluation: StructuredEvaluation): string[] {
  return Object.entries(structuredEvaluation)
    .filter(([key, value]) => key !== 'explanations' && (value === 'NO' || value === 'UNCERTAIN'))
    .map(([key]) => key)
}

/**
 * Extract suggested adjustments from structured evaluation
 */
function extractSuggestedAdjustments(structuredEvaluation: StructuredEvaluation): string {
  const adjustments: string[] = []

  Object.entries(structuredEvaluation.explanations || {}).forEach(([key, explanation]) => {
    const value = structuredEvaluation[key as keyof StructuredEvaluation]

    if (value === 'NO' || value === 'UNCERTAIN') {
      // Add the explanation
      adjustments.push(`❌ ${key}: ${explanation}`)

      // Add prescriptive guidance for specific failures
      if (key === 'no_unauthorized_accessories') {
        adjustments.push(
          '⚠️ CRITICAL FIX: DO NOT add ANY accessories (watch, pocket square, tie, jewelry, glasses, etc.) ' +
          'that are not visible in AT LEAST ONE reference selfie OR listed in the wardrobe.inherent_accessories. ' +
          'NOTE: An accessory appearing in ANY selfie (even just one) is authorized - it does not need to appear in ALL selfies. ' +
          'EXCEPTION: Belt and cufflinks may be inherent to certain clothing styles (check wardrobe.inherent_accessories in the prompt). ' +
          'ONLY include accessories explicitly present in at least one selfie, garment collage, or inherent_accessories list. ' +
          'If unsure whether an accessory is authorized, OMIT it entirely.'
        )
      }

      if (key === 'face_similarity') {
        adjustments.push(
          '⚠️ CRITICAL FIX: The face MUST closely match the reference selfies. ' +
          'Pay special attention to facial structure, eye shape, nose, mouth, and unique characteristics like glasses, beard, hair.'
        )
      }

      if (key === 'body_framing') {
        adjustments.push(
          '⚠️ CRITICAL FIX: Ensure proper body framing. Do NOT crop at the waist or mid-torso. ' +
          'Show at minimum 3/4 body (to mid-thigh) or full body. Bottom-border cutoffs are acceptable.'
        )
      }

      if (key === 'person_prominence') {
        adjustments.push(
          '⚠️ CRITICAL FIX: The person MUST be the dominant element, occupying 40-60% of image height. ' +
          'The person should be LARGER than any background elements (banners, logos, signs). ' +
          'Do NOT make the person small to fit background elements - let the person overlap them.'
        )
      }

      if (key === 'branding_placement') {
        adjustments.push(
          '⚠️ CRITICAL FIX: Logo must be visible and properly placed in the background. ' +
          'Partial occlusion by the person is good (adds depth). Logo should be on wall/banner behind subject.'
        )
      }
    }
  })

  return adjustments.join('\n\n')
}

/**
 * Determine if evaluation result is approved
 */
export function isApproved(evaluation: ImageEvaluationResult): boolean {
  return evaluation.status === 'Approved'
}

/**
 * Log evaluation result with appropriate level
 */
export function logEvaluationResult(
  stepName: string,
  attempt: number,
  evaluation: ImageEvaluationResult,
  approved: boolean
): void {
  const structuredEvaluation = evaluation.structuredEvaluation
  const failedCriteria = structuredEvaluation
    ? extractFailedCriteria(structuredEvaluation)
    : undefined
  const suggestedAdjustments = structuredEvaluation
    ? extractSuggestedAdjustments(structuredEvaluation)
    : undefined

  const payload = {
    attempt,
    status: evaluation.status,
    reason: evaluation.reason,
    failedCriteria,
    suggestedAdjustments,
    structuredEvaluation,
    details: evaluation.details
  }

  if (approved) {
    Logger.info(`${stepName}: Approved`, payload)
  } else {
    Logger.warn(`${stepName}: Not approved`, payload)
  }
}

/**
 * Check if maximum attempts reached and throw if evaluation failed
 */
export function checkMaxAttemptsAndThrow(
  stepName: string,
  attempt: number,
  maxAttempts: number,
  evaluation: ImageEvaluationResult
): void {
  if (attempt >= maxAttempts) {
    throw new Error(`${stepName} failed after ${maxAttempts} attempts: ${evaluation.reason}`)
  }
}

