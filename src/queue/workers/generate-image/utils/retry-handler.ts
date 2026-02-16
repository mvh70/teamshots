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

const progressHighWaterMark = new Map<string, number>()

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

        const jitterMs = Math.floor(Math.random() * sleepMs * 0.5)
        const jitteredSleepMs = sleepMs + jitterMs
        const waitSeconds = Math.round(jitteredSleepMs / 1000)
        Logger.warn(`${operationName} rate limited; waiting before retry`, {
          waitSeconds,
          jitterMs,
          rateLimitRetries,
          maxRetries
        })

        // Call optional retry callback (for progress updates)
        if (onRetry) {
          await onRetry(rateLimitRetries, waitSeconds)
        }

        await delay(jitteredSleepMs)
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
 * Ensures progress never goes backwards
 *
 * BullMQ stores job.progress in Redis, so it's shared across all workers.
 * We use this as the source of truth instead of an in-memory Map.
 *
 * @param job - The BullMQ job
 * @param targetProgress - The desired progress percentage (0-100)
 * @param message - The status message to display
 * @param forceUpdate - Force the update even if progress hasn't increased (for message-only updates)
 */
export async function updateJobProgress(
  job: Job,
  targetProgress: number,
  message: string,
  forceUpdate = false
): Promise<void> {
  try {
    const jobId = job.id ?? 'unknown'
    const currentProgress = progressHighWaterMark.get(String(jobId)) ?? 0

    // Only update if progress increases OR if force update is requested
    if (targetProgress > currentProgress || forceUpdate) {
      // Never let progress go backwards - use the higher value
      const actualProgress = Math.max(targetProgress, currentProgress)
      await job.updateProgress({ progress: actualProgress, message })
      progressHighWaterMark.set(String(jobId), actualProgress)

      Logger.debug('Updated job progress', {
        jobId,
        targetProgress,
        actualProgress,
        currentProgress,
        messagePreview: message.substring(0, 50)
      })
    } else {
      Logger.debug('Skipped progress update (would go backwards)', {
        jobId,
        targetProgress,
        currentProgress,
        messagePreview: message.substring(0, 50)
      })
    }
  } catch (error) {
    Logger.warn('Failed to update job progress', {
      progress: targetProgress,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * @deprecated No longer needed - progress is stored in Redis via job.progress
 * Keeping for backwards compatibility but it does nothing
 */
export function cleanupProgressTracker(_jobId: string): void {
  progressHighWaterMark.delete(_jobId)
}

/**
 * Friendly rate limit messages that don't reveal the AI provider
 */
const RATE_LIMIT_MESSAGES = [
  "Our photo chef is plating someone else's order right now",
  "High demand! Your photos are worth the wait",
  "Taking a quick breather to make your photos extra crispy",
  "The creativity hamsters need a water break",
  "So many people want photos today (good taste, everyone)",
]

/**
 * Get a consistent message based on attempt number
 */
function getRateLimitMessage(attempt: number): string {
  return RATE_LIMIT_MESSAGES[(attempt - 1) % RATE_LIMIT_MESSAGES.length]
}

/**
 * Create a retry callback for progress updates during rate limit retries
 */
export function createProgressRetryCallback(
  job: Job,
  progress: number
): (attempt: number, waitSeconds: number) => Promise<void> {
  return async (attempt: number, waitSeconds: number) => {
    const message = getRateLimitMessage(attempt)
    await updateJobProgress(
      job,
      progress,
      `⏳ ${message}. We'll try again in ${waitSeconds}s...`
    )
  }
}
