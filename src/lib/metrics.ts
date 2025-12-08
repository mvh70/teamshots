/**
 * Metrics Tracking for Production Monitoring
 *
 * Track key business metrics and performance indicators
 */

import { EnhancedLogger } from './logger-enhanced'

export interface Metric {
  name: string
  value: number
  unit?: string
  tags?: Record<string, string>
  timestamp?: Date
}

/**
 * Metric aggregation for dashboards
 */
class MetricsCollector {
  private metrics: Map<string, number[]> = new Map()

  /**
   * Record a metric value
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags)
    const values = this.metrics.get(key) || []
    values.push(value)
    this.metrics.set(key, values)

    // Log metric for external aggregation
    EnhancedLogger.info('Metric recorded', {
      metric: name,
      value,
      tags,
      timestamp: new Date().toISOString(),
    })

    // Send to PostHog if available
    this.sendToPostHog(name, value, tags)
  }

  /**
   * Increment a counter
   */
  increment(name: string, amount = 1, tags?: Record<string, string>): void {
    this.record(name, amount, tags)
  }

  /**
   * Record timing in milliseconds
   */
  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.record(name, durationMs, { ...tags, unit: 'ms' })
  }

  /**
   * Get aggregated statistics for a metric
   */
  getStats(name: string, tags?: Record<string, string>): {
    count: number
    sum: number
    avg: number
    min: number
    max: number
  } | null {
    const key = this.getKey(name, tags)
    const values = this.metrics.get(key)

    if (!values || values.length === 0) {
      return null
    }

    const sum = values.reduce((a, b) => a + b, 0)
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear()
  }

  private getKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',')
    return `${name}{${tagStr}}`
  }

  private sendToPostHog(name: string, value: number, tags?: Record<string, string>): void {
    // Only in production
    if (process.env.NODE_ENV !== 'production') return

    try {
      // Dynamic import to avoid build issues
      import('@/lib/analytics/server').then(({ captureServerEvent }) => {
        captureServerEvent({
          event: `metric:${name}`,
          distinctId: 'system',
          properties: {
            value,
            ...tags,
            timestamp: new Date().toISOString(),
          },
        }).catch(() => {
          // Silently ignore metrics errors
        })
      }).catch(() => {
        // PostHog not available
      })
    } catch {
      // Ignore errors
    }
  }
}

// Global metrics collector instance
export const metrics = new MetricsCollector()

/**
 * Business Metrics Helpers
 */
export const BusinessMetrics = {
  /**
   * Track user signup
   */
  userSignup: (userType: 'individual' | 'team', locale: string) => {
    metrics.increment('user.signup', 1, { userType, locale })
  },

  /**
   * Track generation started
   */
  generationStarted: (packageId: string, personId: string) => {
    metrics.increment('generation.started', 1, { packageId })
    EnhancedLogger.info('Generation started', { packageId, personId })
  },

  /**
   * Track generation completed
   */
  generationCompleted: (packageId: string, durationMs: number, success: boolean) => {
    metrics.increment('generation.completed', 1, { packageId, success: success.toString() })
    metrics.timing('generation.duration', durationMs, { packageId })
  },

  /**
   * Track generation failed
   */
  generationFailed: (packageId: string, reason: string) => {
    metrics.increment('generation.failed', 1, { packageId, reason })
  },

  /**
   * Track credit transaction
   */
  creditTransaction: (type: string, amount: number, source: string) => {
    metrics.record('credits.transaction', amount, { type, source })
  },

  /**
   * Track subscription event
   */
  subscription: (event: 'created' | 'cancelled' | 'renewed', tier: string) => {
    metrics.increment(`subscription.${event}`, 1, { tier })
  },

  /**
   * Track payment
   */
  payment: (amount: number, currency: string, success: boolean) => {
    metrics.record('payment.amount', amount, { currency, success: success.toString() })
  },
}

/**
 * Performance Metrics Helpers
 */
export const PerformanceMetrics = {
  /**
   * Track API endpoint performance
   */
  apiRequest: (endpoint: string, method: string, statusCode: number, durationMs: number) => {
    metrics.timing('api.request.duration', durationMs, { endpoint, method })
    metrics.increment('api.request.count', 1, {
      endpoint,
      method,
      status: statusCode.toString(),
    })
  },

  /**
   * Track database query performance
   */
  dbQuery: (operation: string, durationMs: number) => {
    metrics.timing('db.query.duration', durationMs, { operation })
  },

  /**
   * Track queue job performance
   */
  queueJob: (jobType: string, durationMs: number, success: boolean) => {
    metrics.timing('queue.job.duration', durationMs, { jobType, success: success.toString() })
  },

  /**
   * Track external API calls
   */
  externalApi: (service: string, endpoint: string, durationMs: number, success: boolean) => {
    metrics.timing('external.api.duration', durationMs, { service, endpoint })
    metrics.increment('external.api.calls', 1, {
      service,
      endpoint,
      success: success.toString(),
    })
  },
}

/**
 * Helper to measure function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start
    metrics.timing(name, duration, { ...tags, success: 'true' })
    return result
  } catch (error) {
    const duration = Date.now() - start
    metrics.timing(name, duration, { ...tags, success: 'false' })
    throw error
  }
}

/**
 * Helper to measure synchronous function execution time
 */
export function measure<T>(
  name: string,
  fn: () => T,
  tags?: Record<string, string>
): T {
  const start = Date.now()
  try {
    const result = fn()
    const duration = Date.now() - start
    metrics.timing(name, duration, { ...tags, success: 'true' })
    return result
  } catch (error) {
    const duration = Date.now() - start
    metrics.timing(name, duration, { ...tags, success: 'false' })
    throw error
  }
}
