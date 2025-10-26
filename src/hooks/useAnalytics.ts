'use client'

import { useCallback } from 'react'
import { posthog } from '@/lib/posthog'

export function useAnalytics() {
  const track = useCallback((event: string, properties?: Record<string, unknown>) => {
    if (posthog.__loaded) {
      posthog.capture(event, properties)
    }
  }, [])

  const identify = useCallback((userId: string, properties?: Record<string, unknown>) => {
    if (posthog.__loaded) {
      posthog.identify(userId, properties)
    }
  }, [])

  const reset = useCallback(() => {
    if (posthog.__loaded) {
      posthog.reset()
    }
  }, [])

  const setUserProperties = useCallback((properties: Record<string, unknown>) => {
    if (posthog.__loaded) {
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
