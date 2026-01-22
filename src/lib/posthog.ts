import type { PostHog } from 'posthog-js'

// Lazy-loaded PostHog instance
let posthogInstance: PostHog | null = null
let loadingPromise: Promise<PostHog> | null = null

/**
 * Dynamically load and initialize PostHog
 * This defers the posthog-js bundle (and its core-js polyfills) until needed
 */
export const initPostHog = async (): Promise<PostHog | null> => {
  if (typeof window === 'undefined') {
    return null // Server-side, skip initialization
  }

  // Return cached instance if already loaded
  if (posthogInstance?.__loaded) {
    return posthogInstance
  }

  // Return existing loading promise if already loading
  if (loadingPromise) {
    return loadingPromise
  }

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

  if (!posthogKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set. PostHog will not be initialized.')
    }
    return null
  }

  // Skip initialization if it looks like a test/placeholder key
  if (posthogKey.includes('test_') || posthogKey.includes('placeholder')) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PostHog] Skipping initialization: test/placeholder key detected.')
    }
    return null
  }

  loadingPromise = (async () => {
    try {
      // Dynamically import posthog-js to defer bundle loading
      const { default: posthog } = await import('posthog-js')

      const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

      posthog.init(posthogKey, {
        api_host: apiHost,
        person_profiles: 'identified_only',
        capture_pageview: false, // We'll handle this manually
        capture_pageleave: true,
        loaded: (ph) => {
          // Make posthog available globally for debugging
          if (typeof window !== 'undefined') {
            (window as unknown as Record<string, unknown>).posthog = ph
          }

          // Enable debug in development
          if (process.env.NODE_ENV === 'development') {
            ph.debug()
            console.log('[PostHog] Initialized successfully', { apiHost })
          }
        },
        // Suppress automatic error capture to avoid console spam
        autocapture: true,
        // Disable session recording to reduce console noise
        disable_session_recording: false
      })

      posthogInstance = posthog
      return posthog
    } catch (error) {
      console.error('[PostHog] Initialization failed:', error)
      loadingPromise = null
      throw error
    }
  })()

  return loadingPromise
}

/**
 * Get the PostHog instance (may be null if not yet loaded)
 */
export const getPostHog = (): PostHog | null => posthogInstance
