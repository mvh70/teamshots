import { Logger } from '@/lib/logger'

/**
 * Log the start of a workflow step
 */
export function logStepStart(stepName: string, generationId: string) {
  Logger.info(`>>> STARTING ${stepName.toUpperCase()} [${generationId}] <<<`)
}

/**
 * Log the prompt used for a step
 * Uses the special 'prompt' key to trigger the logger's special formatting
 */
export function logPrompt(stepName: string, prompt: string) {
  Logger.info(`[${stepName}] Prompt used:`, { prompt })
}

/**
 * Log the result of a step
 */
export function logStepResult(
  stepName: string,
  result: {
    success: boolean
    provider?: string
    model?: string
    imageSize?: number
    error?: string
    durationMs?: number
  }
) {
  Logger.info(`[${stepName}] Result:`, {
    status: result.success ? 'SUCCESS' : 'FAILURE',
    provider: result.provider || 'unknown',
    model: result.model || 'unknown',
    size: result.imageSize ? `${Math.round(result.imageSize / 1024)}KB` : undefined,
    duration: result.durationMs ? `${Math.round(result.durationMs)}ms` : undefined,
    error: result.error
  })
}
