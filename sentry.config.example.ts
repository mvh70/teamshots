/**
 * Sentry Configuration (Example)
 *
 * To enable Sentry error tracking:
 * 1. Install Sentry: npm install @sentry/nextjs
 * 2. Copy this file to sentry.config.ts
 * 3. Set NEXT_PUBLIC_SENTRY_DSN in your environment variables
 * 4. Import and initialize in instrumentation.ts
 */

import * as Sentry from '@sentry/nextjs'

export function initializeSentry() {
  const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
  const ENVIRONMENT = process.env.NODE_ENV || 'development'

  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured - error tracking disabled')
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,

    // Performance monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Error sampling
    sampleRate: 1.0, // Capture 100% of errors

    // Session replay for debugging
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of error sessions

    // Integrations
    integrations: [
      Sentry.replayIntegration(),
      Sentry.browserTracingIntegration(),
    ],

    // Filter sensitive data
    beforeSend(event, hint) {
      // Remove sensitive data from error reports
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }

      // Filter out known non-critical errors
      const error = hint.originalException
      if (error instanceof Error) {
        // Ignore AbortError from cancelled requests
        if (error.name === 'AbortError') {
          return null
        }

        // Ignore network errors in development
        if (ENVIRONMENT === 'development' && error.message.includes('ECONNREFUSED')) {
          return null
        }
      }

      return event
    },

    // Custom tags for better filtering
    initialScope: {
      tags: {
        'app.version': process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
      },
    },
  })

  console.log('✓ Sentry initialized for environment:', ENVIRONMENT)
}

/**
 * Capture custom error with context
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  })
}

/**
 * Capture custom message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level)
}

/**
 * Set user context for error reports
 */
export function setUserContext(userId: string, email?: string) {
  Sentry.setUser({
    id: userId,
    email,
  })
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null)
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    message,
    data,
    level: 'info',
  })
}
