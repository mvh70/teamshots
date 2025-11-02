import posthog from 'posthog-js'

export const initPostHog = () => {
  console.log('[PostHog] initPostHog called')
  
  if (typeof window === 'undefined') {
    console.log('[PostHog] Skipping: server-side execution')
    return // Server-side, skip initialization
  }

  // Already initialized
  if (posthog.__loaded) {
    console.log('[PostHog] Already initialized')
    return
  }

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  console.log('[PostHog] Key check:', { 
    hasKey: !!posthogKey, 
    keyLength: posthogKey?.length || 0,
    keyPreview: posthogKey ? `${posthogKey.substring(0, 8)}...` : 'missing'
  })
  
  if (!posthogKey) {
    console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set. PostHog will not be initialized.')
    return;
  }
  
  // Skip initialization if it looks like a test/placeholder key
  if (posthogKey.includes('test_') || posthogKey.includes('placeholder')) {
    console.warn('[PostHog] Skipping initialization: test/placeholder key detected.')
    return;
  }
  
  try {
    const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'
    console.log('[PostHog] Initializing...', { apiHost })
    
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
        
        console.log('[PostHog] ✅ Initialized successfully', { 
          apiHost,
          loaded: posthogInstance.__loaded,
          distinctId: posthogInstance.get_distinct_id()
        })
        
        // Enable debug in development
        if (process.env.NODE_ENV === 'development') {
          posthogInstance.debug()
        }
      },
      // Suppress automatic error capture to avoid console spam
      autocapture: false
    })
  } catch (error) {
    // Always log errors for debugging
    console.error('[PostHog] ❌ Initialization failed:', error)
  }
}

export { posthog }
