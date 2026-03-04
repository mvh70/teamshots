'use client'

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { PostHog } from 'posthog-js'
import { getClientTenantInfo } from '@/lib/tenant-client'

// Cached PostHog instance after initialization
let posthogInstance: PostHog | null = null

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const trackingEnabled = process.env.NODE_ENV === 'production'
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isInitialized = useRef(false)
  const hasInteracted = useRef(false)

  // Cache brand info for multi-tenant analytics
  const brand = useMemo(() => {
    if (typeof window === 'undefined') return 'unknown'
    return getClientTenantInfo().brandName
  }, [])

  // Lazy load and initialize PostHog
  const loadPostHog = useCallback(async () => {
    if (!trackingEnabled || isInitialized.current) return

    try {
      // Dynamically import the module
      const { initPostHog } = await import('@/lib/posthog')
      const ph = await initPostHog()

      if (ph) {
        posthogInstance = ph
        isInitialized.current = true

        // Capture the initial pageview after initialization
        if (pathname) {
          let url = window.origin + pathname
          if (searchParams.toString()) {
            url = url + `?${searchParams.toString()}`
          }
          ph.capture('$pageview', {
            $current_url: url,
            brand,
          })
        }
      }
    } catch (error) {
      console.error('[PostHog] Failed to load:', error)
    }
  }, [pathname, searchParams, brand, trackingEnabled])

  // Initialize on user interaction (scroll, click, touch, or keyboard)
  useEffect(() => {
    if (!trackingEnabled) return
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
      loadPostHog()
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
        loadPostHog()
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
  }, [loadPostHog, trackingEnabled])

  // Track subsequent page views
  useEffect(() => {
    if (!trackingEnabled) return
    if (!isInitialized.current || !posthogInstance) return

    if (pathname) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthogInstance.capture('$pageview', {
        $current_url: url,
        brand,
      })
    }
  }, [pathname, searchParams, brand, trackingEnabled])

  return <>{children}</>
}
