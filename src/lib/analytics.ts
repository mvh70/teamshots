// Google Analytics & Tag Manager event tracking helpers

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set' | 'js',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void
    dataLayer?: any[]
  }
}

/**
 * Track a custom event in Google Analytics
 * @param action - The action being performed (e.g., 'sign_up', 'purchase')
 * @param params - Additional event parameters
 */
export const trackEvent = (action: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, params)
  }
}

/**
 * Track page views in Google Analytics
 * @param url - The page URL
 */
export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!, {
      page_path: url,
    })
  }
}

/**
 * Track conversions in Google Analytics
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
    })
  }
}

/**
 * Track user signup in Google Analytics
 * @param method - Signup method (e.g., 'email', 'google', 'github')
 */
export const trackSignup = (method: string) => {
  trackEvent('sign_up', { method })
}

/**
 * Track user login in Google Analytics
 * @param method - Login method (e.g., 'email', 'google', 'github')
 */
export const trackLogin = (method: string) => {
  trackEvent('login', { method })
}

/**
 * Push custom data to GTM dataLayer
 * @param data - Data object to push
 */
export const pushToDataLayer = (data: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push(data)
  }
}
