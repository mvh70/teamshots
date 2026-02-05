'use client'

import { useCallback, useMemo } from 'react'
import { getPostHog } from '@/lib/posthog'
import { getClientBrandInfo } from '@/config/domain'

export function useAnalytics() {
  // Cache brand info for the lifetime of the hook
  const brand = useMemo(() => {
    if (typeof window === 'undefined') return 'unknown'
    return getClientBrandInfo().brandName
  }, [])

  const track = useCallback((event: string, properties?: Record<string, unknown>) => {
    const enrichedProperties = {
      brand,
      ...properties,
    }

    // PostHog
    const posthog = getPostHog()
    if (posthog?.__loaded) {
      posthog.capture(event, enrichedProperties)
    }

    // GTM dataLayer for GA4
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event,
        ...enrichedProperties,
      })
    }
  }, [brand])

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
