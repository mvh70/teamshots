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
  return Object.entries(structuredEvaluation.explanations || {})
    .filter(([key]) => {
      const value = structuredEvaluation[key as keyof StructuredEvaluation]
      return value === 'NO' || value === 'UNCERTAIN'
    })
    .map(([, explanation]) => explanation)
    .join('; ')
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

