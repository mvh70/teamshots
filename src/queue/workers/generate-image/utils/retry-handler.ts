import { Logger } from '@/lib/logger'
import { isRateLimitError, RATE_LIMIT_SLEEP_MS } from '@/lib/rate-limit-retry'
import type { Job } from 'bullmq'

export interface RetryConfig {
  maxRetries: number
  sleepMs: number
  operationName: string
}

export interface ProgressUpdateConfig {
  job: Job
  progress: number
  message: string
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  sleepMs: RATE_LIMIT_SLEEP_MS,
  operationName: 'operation'
}

/**
 * Delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute an async operation with rate limit retry logic
 * Consolidates duplicate retry patterns from workflow-v3.ts and other files
 */
export async function executeWithRateLimitRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, waitSeconds: number) => Promise<void>
): Promise<T> {
  const { maxRetries, sleepMs, operationName } = { ...DEFAULT_RETRY_CONFIG, ...config }
  
  let rateLimitRetries = 0

  while (true) {
    try {
      return await operation()
    } catch (error) {
      if (isRateLimitError(error)) {
        rateLimitRetries++
        
        if (rateLimitRetries > maxRetries) {
          Logger.error(`Exceeded rate-limit retries for ${operationName}`, {
            rateLimitRetries,
            maxRetries
          })
          throw error
        }

        const waitSeconds = Math.round(sleepMs / 1000)
        Logger.warn(`${operationName} rate limited; waiting before retry`, {
          waitSeconds,
          rateLimitRetries,
          maxRetries
        })

        // Call optional retry callback (for progress updates)
        if (onRetry) {
          await onRetry(rateLimitRetries, waitSeconds)
        }

        await delay(sleepMs)
        continue
      }
      
      // Not a rate limit error, rethrow
      throw error
    }
  }
}

/**
 * Helper to format progress messages with attempt info
 * Consolidates duplicate formatting logic
 */
export function formatProgressWithAttempt(
  progressMessage: { message: string; emoji?: string },
  progress: number,
  currentAttempt: number
): string {
  const formatted = progressMessage.emoji 
    ? `${progressMessage.emoji} ${progressMessage.message}`
    : progressMessage.message
  return `Generation #${currentAttempt}\n${progress}% - ${formatted}`
}

/**
 * Safe progress update with error handling
 * Consolidates duplicate progress update patterns
 */
export async function updateJobProgress(
  job: Job,
  progress: number,
  message: string
): Promise<void> {
  try {
    await job.updateProgress({ progress, message })
  } catch (error) {
    Logger.warn('Failed to update job progress', {
      progress,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Create a retry callback for progress updates during rate limit retries
 */
export function createProgressRetryCallback(
  job: Job,
  progress: number
): (attempt: number, waitSeconds: number) => Promise<void> {
  return async (attempt: number, waitSeconds: number) => {
    await updateJobProgress(
      job,
      progress,
      `⏳ Gemini is busy. Trying again in ${waitSeconds} seconds... (attempt ${attempt})`
    )
  }
}

