// Google Analytics & Tag Manager event tracking helpers

import { getClientTenantInfo } from '@/lib/tenant-client'

type GtagCommand = 'event' | 'config' | 'set' | 'js'
type GtagConfig = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    gtag?: (
      command: GtagCommand,
      targetId: string | Date,
      config?: GtagConfig
    ) => void
    dataLayer?: Array<Record<string, unknown>>
  }
}

// Cache brand info to avoid repeated DOM lookups
let cachedBrand: string | null = null

export function getBrandForTracking(): string {
  if (cachedBrand) return cachedBrand
  if (typeof window === 'undefined') return 'unknown'

  const { brandName } = getClientTenantInfo()
  cachedBrand = brandName
  return brandName
}

/**
 * Track a custom event in Google Analytics
 * Automatically includes `brand` parameter for multi-tenant analytics.
 * @param action - The action being performed (e.g., 'sign_up', 'purchase')
 * @param params - Additional event parameters
 */
export const trackEvent = (action: string, params?: Record<string, string | number | boolean | undefined>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      brand: getBrandForTracking(),
      ...params,
    })
  }
}

/**
 * Track user signup in Google Analytics
 * Brand is automatically included via trackEvent.
 * @param method - Signup method (e.g., 'email', 'google', 'github')
 */
export const trackSignup = (method: string) => {
  trackEvent('sign_up', { method })
}

/**
 * Track user login in Google Analytics
 * Brand is automatically included via trackEvent.
 * @param method - Login method (e.g., 'email', 'google', 'github')
 */
export const trackLogin = (method: string) => {
  trackEvent('login', { method })
}
