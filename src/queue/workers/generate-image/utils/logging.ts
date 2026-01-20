import { Logger } from '@/lib/logger'

// Track which prompts have been logged to avoid duplicates
const loggedPrompts = new Set<string>()

/**
 * Log the start of a workflow step (consolidated - only major phases)
 */
export function logStepStart(stepName: string, generationId: string) {
  Logger.info(`>>> ${stepName.toUpperCase()} [${generationId}] <<<`)
}

/**
 * Log the full prompt used for a step - only logs once per step per generation
 * Shows the complete prompt text that is sent to the model
 */
export function logPrompt(stepName: string, prompt: string, generationId?: string) {
  const key = `${stepName}-${generationId || 'default'}`
  if (loggedPrompts.has(key)) {
    return // Already logged this prompt
  }
  loggedPrompts.add(key)
  
  // Clean up old entries periodically (keep last 50)
  if (loggedPrompts.size > 50) {
    const entries = Array.from(loggedPrompts)
    entries.slice(0, entries.length - 50).forEach(e => loggedPrompts.delete(e))
  }
  
  // Log the full prompt text directly (not as object) so it's visible in terminal
  Logger.info(`[${stepName}] Prompt:\n${prompt}`)
}

/**
 * Log the result of a step (consolidated format)
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
    imagesGenerated?: number
    imagesReturned?: number // How many images the model returned (may differ from imagesGenerated)
  }
) {
  const status = result.success ? 'SUCCESS' : 'FAILURE'
  const details = [
    result.provider,
    result.durationMs ? `${Math.round(result.durationMs / 1000)}s` : null,
    result.imageSize ? `${Math.round(result.imageSize / 1024)}KB` : null,
    result.imagesReturned ? `${result.imagesReturned} img returned` : null
  ].filter(Boolean).join(', ')
  
  Logger.info(`[${stepName}] ${status}${details ? ` (${details})` : ''}${result.error ? ` - ${result.error}` : ''}`)
}

/**
 * Reset the logged prompts cache (useful for testing)
 */
export function resetLoggedPrompts() {
  loggedPrompts.clear()
}
