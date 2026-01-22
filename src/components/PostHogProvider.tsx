'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Lazy import PostHog to defer loading
let posthogModule: typeof import('@/lib/posthog') | null = null

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // Prevent tracking in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    return <>{children}</>
  }

  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isInitialized = useRef(false)
  const hasInteracted = useRef(false)

  // Lazy load and initialize PostHog
  const initPostHog = useCallback(async () => {
    if (isInitialized.current) return

    try {
      // Dynamically import the module
      if (!posthogModule) {
        posthogModule = await import('@/lib/posthog')
      }

      posthogModule.initPostHog()
      isInitialized.current = true

      // Capture the initial pageview after initialization
      if (pathname && posthogModule.posthog.__loaded) {
        let url = window.origin + pathname
        if (searchParams.toString()) {
          url = url + `?${searchParams.toString()}`
        }
        posthogModule.posthog.capture('$pageview', {
          $current_url: url,
        })
      }
    } catch (error) {
      console.error('[PostHog] Failed to load:', error)
    }
  }, [pathname, searchParams])

  // Initialize on user interaction (scroll, click, touch, or keyboard)
  useEffect(() => {
    if (hasInteracted.current) return

    const handleInteraction = () => {
      if (hasInteracted.current) return
      hasInteracted.current = true

      // Remove all listeners
      window.removeEventListener('scroll', handleInteraction)
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('mousemove', handleInteraction)

      // Initialize PostHog
      initPostHog()
    }

    // Add interaction listeners
    window.addEventListener('scroll', handleInteraction, { passive: true, once: true })
    window.addEventListener('click', handleInteraction, { once: true })
    window.addEventListener('touchstart', handleInteraction, { passive: true, once: true })
    window.addEventListener('keydown', handleInteraction, { once: true })
    window.addEventListener('mousemove', handleInteraction, { passive: true, once: true })

    // Fallback: Initialize after 5 seconds if no interaction
    // This ensures we still capture analytics for users who just read
    const fallbackTimer = setTimeout(() => {
      if (!hasInteracted.current) {
        hasInteracted.current = true
        initPostHog()
      }
    }, 5000)

    return () => {
      clearTimeout(fallbackTimer)
      window.removeEventListener('scroll', handleInteraction)
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('mousemove', handleInteraction)
    }
  }, [initPostHog])

  // Track subsequent page views
  useEffect(() => {
    if (!isInitialized.current || !posthogModule) return

    if (pathname && posthogModule.posthog.__loaded) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthogModule.posthog.capture('$pageview', {
        $current_url: url,
      })
    }
  }, [pathname, searchParams])

  return <>{children}</>
}
