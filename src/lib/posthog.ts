import posthog from 'posthog-js'

export const initPostHog = () => {
  if (typeof window === 'undefined') {
    return // Server-side, skip initialization
  }

  // Already initialized
  if (posthog.__loaded) {
    return
  }

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  
  if (!posthogKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set. PostHog will not be initialized.')
    }
    return;
  }
  
  // Skip initialization if it looks like a test/placeholder key
  if (posthogKey.includes('test_') || posthogKey.includes('placeholder')) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PostHog] Skipping initialization: test/placeholder key detected.')
    }
    return;
  }
  
  try {
    const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'
    
    posthog.init(posthogKey, {
      api_host: apiHost,
      person_profiles: 'identified_only',
      capture_pageview: false, // We'll handle this manually
      capture_pageleave: true,
      loaded: (posthogInstance) => {
        // Make posthog available globally for debugging
        if (typeof window !== 'undefined') {
          (window as unknown as Record<string, unknown>).posthog = posthogInstance
        }
        
        // Next.js automatically makes NODE_ENV available in client-side code
        if (process.env.NODE_ENV === 'development') {
          posthogInstance.debug()
          console.log('[PostHog] Initialized successfully', { apiHost })
        }
      },
      // Suppress automatic error capture to avoid console spam
      autocapture: false
    })
  } catch (error) {
    // Always log errors for debugging
    console.error('[PostHog] Initialization failed:', error)
  }
}

export { posthog }
