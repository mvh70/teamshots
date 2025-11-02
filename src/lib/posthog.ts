import posthog from 'posthog-js'
import { Env } from '@/lib/env'

export const initPostHog = () => {
  if (typeof window !== 'undefined' && !posthog.__loaded) {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    
    if (!posthogKey) {
      return;
    }
    
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false, // We'll handle this manually
      capture_pageleave: true,
      loaded: (posthogInstance) => {
        if (Env.string('NODE_ENV') === 'development') {
          posthogInstance.debug()
        }
      }
    })
  }
}

export { posthog }
