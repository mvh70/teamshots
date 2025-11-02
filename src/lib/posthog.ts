import posthog from 'posthog-js'

export const initPostHog = () => {
  if (typeof window !== 'undefined' && !posthog.__loaded) {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    
    if (!posthogKey) {
      return;
    }
    
    // Skip initialization if it looks like a test/placeholder key
    if (posthogKey.includes('test_') || posthogKey.includes('placeholder')) {
      return;
    }
    
    try {
      posthog.init(posthogKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false, // We'll handle this manually
        capture_pageleave: true,
        loaded: (posthogInstance) => {
          // Next.js automatically makes NODE_ENV available in client-side code
          if (process.env.NODE_ENV === 'development') {
            posthogInstance.debug()
          }
        },
        // Suppress automatic error capture to avoid console spam
        autocapture: false
      })
    } catch (error) {
      // Log errors in production only
      if (process.env.NODE_ENV === 'production') {
        console.error('PostHog initialization failed:', error)
      }
    }
  }
}

export { posthog }
