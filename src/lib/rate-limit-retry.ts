/**
 * Rate Limit Retry Utility
 * 
 * Centralized utility for handling rate-limited API calls with automatic retry logic.
 * Used across worker queue and V2 workflow to ensure consistent behavior.
 */

import { Logger } from './logger'

/**
 * Checks if an error is a rate limit error (429 or "too many requests")
 */
export function isRateLimitError(error: unknown): boolean {
  const metadata = collectErrorMetadata(error)
  
  // Check for 429 status code
  if (metadata.statusCodes.includes(429)) {
    return true
  }

  // Check for rate limit messages
  return metadata.messages.some((message) => {
    const normalized = message.toLowerCase()
    return normalized.includes('too many requests') || 
           normalized.includes('resource exhausted') ||
           normalized.includes('rate limit')
  })
}

/**
 * Options for rate limit retry behavior
 */
export interface RateLimitRetryOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number
  /** Delay between retries in milliseconds (default: 60000) */
  delayMs?: number
  /** Callback invoked before each retry */
  onRetry?: (attempt: number, maxAttempts: number, waitMs: number) => Promise<void>
  /** Context for logging */
  context?: Record<string, unknown>
}

/**
 * Executes an operation with automatic retry on rate limit errors
 * 
 * @example
 * ```typescript
 * const result = await withRateLimitRetry(
 *   () => geminiApi.generate(prompt),
 *   {
 *     maxRetries: 3,
 *     onRetry: async (attempt, max, waitMs) => {
 *       await job.updateProgress({
 *         message: `Rate limited, retrying in ${waitMs/1000}s (${attempt}/${max})...`
 *       })
 *     }
 *   }
 * )
 * ```
 */
export async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  options: RateLimitRetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3
  const delayMs = options.delayMs ?? 60_000
  let retries = 0

  while (true) {
    try {
      return await operation()
    } catch (error) {
      // If not a rate limit error, throw immediately
      if (!isRateLimitError(error)) {
        throw error
      }

      retries += 1
      
      // If we've exceeded max retries, throw
      if (retries > maxRetries) {
        Logger.error('Exceeded rate limit retries', {
          retries,
          maxRetries,
          ...options.context
        })
        throw error
      }

      // Log the retry
      Logger.warn('Rate limited, waiting before retry', {
        attempt: retries,
        maxRetries,
        waitMs: delayMs,
        ...options.context
      })

      // Invoke retry callback if provided
      if (options.onRetry) {
        await options.onRetry(retries, maxRetries, delayMs)
      }

      // Wait before retrying
      await delay(delayMs)
    }
  }
}

/**
 * Delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Collects error metadata for analysis
 */
function collectErrorMetadata(error: unknown): { statusCodes: number[]; messages: string[] } {
  const statusCodes: number[] = []
  const messages: string[] = []
  const seen = new Set<unknown>()
  const queue: unknown[] = [error]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || seen.has(current)) {
      continue
    }
    seen.add(current)

    if (typeof current === 'string') {
      messages.push(current)
      try {
        const parsed = JSON.parse(current) as unknown
        queue.push(parsed)
      } catch {
        // ignore parse errors
      }
      continue
    }

    if (typeof current !== 'object') {
      continue
    }

    const maybeStatus = (current as { status?: unknown }).status
    if (typeof maybeStatus === 'number') {
      statusCodes.push(maybeStatus)
    }

    const maybeCode = (current as { code?: unknown }).code
    if (typeof maybeCode === 'number') {
      statusCodes.push(maybeCode)
    }

    const maybeMessage = (current as { message?: unknown }).message
    if (typeof maybeMessage === 'string') {
      messages.push(maybeMessage)
    }

    const nestedCandidates: unknown[] = []
    const maybeResponse = (current as { response?: unknown }).response
    if (maybeResponse) nestedCandidates.push(maybeResponse)

    const maybeError = (current as { error?: unknown }).error
    if (maybeError) nestedCandidates.push(maybeError)

    const maybeDetails = (current as { details?: unknown }).details
    if (maybeDetails) nestedCandidates.push(maybeDetails)

    const maybeCause = (current as { cause?: unknown }).cause
    if (maybeCause) nestedCandidates.push(maybeCause)

    for (const candidate of nestedCandidates) {
      if (candidate !== undefined && candidate !== null) {
        queue.push(candidate)
      }
    }
  }

  return {
    statusCodes,
    messages
  }
}

// Export constants for backward compatibility
export const RATE_LIMIT_SLEEP_MS = 60_000
export const MAX_RATE_LIMIT_RETRIES = 3

