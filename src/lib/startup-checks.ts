/**
 * Startup Validation Checks
 *
 * SECURITY: These checks run on application startup to prevent misconfigurations
 * that could create security vulnerabilities in production
 */

import { Logger } from './logger'

export function validateEnvironment() {
  const nodeEnv = process.env.NODE_ENV
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  // Production environment checks
  if (nodeEnv === 'production') {
    Logger.info('Running production environment validation...')

    // 1. Ensure production URL uses HTTPS
    if (!baseUrl?.startsWith('https://')) {
      throw new Error('SECURITY: Production must use HTTPS. NEXT_PUBLIC_BASE_URL must start with https://')
    }

    // 2. Ensure no DEV_BYPASS_USER_ID in production
    if (process.env.DEV_BYPASS_USER_ID) {
      throw new Error(
        'SECURITY: DEV_BYPASS_USER_ID must not be set in production! ' +
        'This creates a backdoor for mobile handoff bypass. ' +
        'Remove this variable from production environment.'
      )
    }

    // 3. Ensure E2E_TESTING is not enabled in production
    if (process.env.E2E_TESTING === 'true') {
      throw new Error(
        'SECURITY: E2E_TESTING must not be enabled in production! ' +
        'This allows authentication bypass via E2E headers. ' +
        'Remove E2E_TESTING=true from production environment.'
      )
    }

    // 3. Validate required production secrets
    const requiredSecrets = [
      'NEXTAUTH_SECRET',
      'DATABASE_URL',
      'GOOGLE_CLOUD_API_KEY',
      'STRIPE_SECRET_KEY',
      'RESEND_API_KEY'
    ]

    const missingSecrets = requiredSecrets.filter(secret => !process.env[secret])
    if (missingSecrets.length > 0) {
      throw new Error(
        `SECURITY: Missing required production secrets: ${missingSecrets.join(', ')}`
      )
    }

    // 4. Ensure NODE_ENV is actually production (not accidentally development)
    if (process.env.NODE_ENV !== 'production') {
      Logger.warn('NODE_ENV is not "production" but production checks are running')
    }

    Logger.info('✓ Production environment validation passed')
  } else if (nodeEnv === 'development') {
    Logger.info('Development environment detected - skipping production checks')

    // Optional: Warn if DEV_BYPASS_USER_ID is set in development
    if (process.env.DEV_BYPASS_USER_ID) {
      Logger.info(
        `DEV_BYPASS_USER_ID is set: ${process.env.DEV_BYPASS_USER_ID.substring(0, 8)}...`
      )
    }
  }

  // Universal checks (all environments)
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set')
  }

  if (!process.env.NEXTAUTH_URL) {
    throw new Error('NEXTAUTH_URL must be set')
  }

  Logger.info('✓ Startup validation complete')
}

/**
 * Call this in instrumentation.ts or at application startup
 * DO NOT call in middleware (runs on every request)
 */
export function register() {
  try {
    validateEnvironment()
  } catch (error) {
    Logger.error('Startup validation failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}
