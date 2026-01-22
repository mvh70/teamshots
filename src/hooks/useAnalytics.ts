'use client'

import { useCallback } from 'react'
import { getPostHog } from '@/lib/posthog'

export function useAnalytics() {
  const track = useCallback((event: string, properties?: Record<string, unknown>) => {
    // PostHog
    const posthog = getPostHog()
    if (posthog?.__loaded) {
      posthog.capture(event, properties)
    }

    // GTM dataLayer for GA4
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event,
        ...properties,
      })
    }
  }, [])

  const identify = useCallback((userId: string, properties?: Record<string, unknown>) => {
    const posthog = getPostHog()
    if (posthog?.__loaded) {
      posthog.identify(userId, properties)
    }
  }, [])

  const reset = useCallback(() => {
    const posthog = getPostHog()
    if (posthog?.__loaded) {
      posthog.reset()
    }
  }, [])

  const setUserProperties = useCallback((properties: Record<string, unknown>) => {
    const posthog = getPostHog()
    if (posthog?.__loaded) {
      posthog.people.set(properties)
    }
  }, [])

  return {
    track,
    identify,
    reset,
    setUserProperties,
  }
}
