// Google Analytics & Tag Manager event tracking helpers

import { getClientBrandInfo } from '@/config/domain'

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

function getBrandForTracking(): string {
  if (cachedBrand) return cachedBrand
  if (typeof window === 'undefined') return 'unknown'

  const { brandName } = getClientBrandInfo()
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
 * Track page views in Google Analytics
 * Automatically includes `brand` parameter for multi-tenant analytics.
 * @param url - The page URL
 */
export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!, {
      page_path: url,
      brand: getBrandForTracking(),
    })
  }
}

/**
 * Track conversions in Google Analytics
 * Automatically includes `brand` parameter for multi-tenant analytics.
 * @param transactionId - Unique transaction ID
 * @param value - Transaction value
 * @param currency - Currency code (default: USD)
 */
export const trackConversion = (
  transactionId: string,
  value: number,
  currency: string = 'USD'
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: transactionId,
      value: value,
      currency: currency,
      brand: getBrandForTracking(),
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

/**
 * Push custom data to GTM dataLayer
 * @param data - Data object to push
 */
export const pushToDataLayer = (data: Record<string, unknown>) => {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push(data)
  }
}
