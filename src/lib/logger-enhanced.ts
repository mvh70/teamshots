/**
 * Enhanced Logger with Structured Logging
 *
 * Provides:
 * - Structured JSON logging for production
 * - Human-readable formatting for development
 * - Request ID tracking
 * - Performance metrics
 * - Integration points for Sentry, DataDog, etc.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
  requestId?: string
  userId?: string
  duration?: number
  error?: Error | string
}

interface PerformanceTimer {
  start: number
  label: string
}

const timers = new Map<string, PerformanceTimer>()

// ANSI escape codes for terminal formatting
const COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

/**
 * Format log for production (structured JSON)
 */
function formatProduction(level: Level, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level,
    message,
    ...context,
    // Ensure error objects are serializable
    ...(context?.error instanceof Error && {
      error: {
        name: context.error.name,
        message: context.error.message,
        stack: context.error.stack,
      }
    })
  }

  return JSON.stringify(logEntry)
}

/**
 * Format log for development (human-readable)
 */
function formatDevelopment(level: Level, message: string, context?: LogContext): string {
  const color = COLORS[level]
  const reset = COLORS.reset
  const timestamp = new Date().toISOString().substring(11, 23) // HH:MM:SS.mmm

  let output = `${COLORS.dim}${timestamp}${reset} ${color}${level.toUpperCase().padEnd(5)}${reset} ${message}`

  if (context && Object.keys(context).length > 0) {
    const contextStr = JSON.stringify(context, null, 2)
    output += `\n${COLORS.dim}${contextStr}${reset}`
  }

  return output
}

/**
 * Core logging function
 */
function log(level: Level, message: string, context?: LogContext): void {
  const isProduction = process.env.NODE_ENV === 'production'
  const formatted = isProduction
    ? formatProduction(level, message, context)
    : formatDevelopment(level, message, context)

  // Use appropriate console method
  console[level](formatted)

  // Send to external services in production
  // Note: To enable Sentry error tracking, configure sentry.ts following sentry.config.example.ts
  if (isProduction && level === 'error') {
    // Reserved for external error tracking integrations (Sentry, DataDog, etc.)
    // Add integration here when configured
  }
}

export const EnhancedLogger = {
  /**
   * Debug-level logging (disabled in production)
   */
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== 'production') {
      log('debug', message, context)
    }
  },

  /**
   * Info-level logging
   */
  info: (message: string, context?: LogContext) => {
    log('info', message, context)
  },

  /**
   * Warning-level logging
   */
  warn: (message: string, context?: LogContext) => {
    log('warn', message, context)
  },

  /**
   * Error-level logging
   */
  error: (message: string, context?: LogContext) => {
    log('error', message, context)
  },

  /**
   * Start a performance timer
   */
  startTimer: (label: string): void => {
    timers.set(label, { start: Date.now(), label })
  },

  /**
   * End a performance timer and log duration
   */
  endTimer: (label: string, context?: LogContext): void => {
    const timer = timers.get(label)
    if (!timer) {
      EnhancedLogger.warn(`Timer not found: ${label}`)
      return
    }

    const duration = Date.now() - timer.start
    timers.delete(label)

    EnhancedLogger.info(`${label} completed`, {
      ...context,
      duration,
      durationMs: duration,
    })
  },

  /**
   * Log with request context
   */
  withRequest: (requestId: string) => ({
    debug: (message: string, context?: LogContext) =>
      EnhancedLogger.debug(message, { ...context, requestId }),
    info: (message: string, context?: LogContext) =>
      EnhancedLogger.info(message, { ...context, requestId }),
    warn: (message: string, context?: LogContext) =>
      EnhancedLogger.warn(message, { ...context, requestId }),
    error: (message: string, context?: LogContext) =>
      EnhancedLogger.error(message, { ...context, requestId }),
  }),

  /**
   * Log with user context
   */
  withUser: (userId: string) => ({
    debug: (message: string, context?: LogContext) =>
      EnhancedLogger.debug(message, { ...context, userId }),
    info: (message: string, context?: LogContext) =>
      EnhancedLogger.info(message, { ...context, userId }),
    warn: (message: string, context?: LogContext) =>
      EnhancedLogger.warn(message, { ...context, userId }),
    error: (message: string, context?: LogContext) =>
      EnhancedLogger.error(message, { ...context, userId }),
  }),
}

/**
 * Create a scoped logger with automatic context
 */
export function createLogger(scope: string, context?: LogContext) {
  return {
    debug: (message: string, extra?: LogContext) =>
      EnhancedLogger.debug(`[${scope}] ${message}`, { ...context, ...extra }),
    info: (message: string, extra?: LogContext) =>
      EnhancedLogger.info(`[${scope}] ${message}`, { ...context, ...extra }),
    warn: (message: string, extra?: LogContext) =>
      EnhancedLogger.warn(`[${scope}] ${message}`, { ...context, ...extra }),
    error: (message: string, extra?: LogContext) =>
      EnhancedLogger.error(`[${scope}] ${message}`, { ...context, ...extra }),
  }
}
