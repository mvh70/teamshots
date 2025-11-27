import { headers } from 'next/headers'
import { INDIVIDUAL_DOMAIN } from './domain'

export const BRAND_CONFIG = {
  name: 'TeamShotsPro',
  domain: 'teamshotspro.com',
  
  contact: {
    hello: 'hello@teamshotspro.com',
    support: 'support@teamshotspro.com',
    privacy: 'privacy@teamshotspro.com',
    legal: 'legal@teamshotspro.com',
  },
  
  colors: {
    primary: '#6366F1',        // Indigo-500 - Brand identity (distinctive from competitors)
    primaryHover: '#4F46E5',   // Indigo-600
    secondary: '#10B981',      // Green-500 - Success states
    secondaryHover: '#059669', // Green-600
    cta: '#EA580C',            // Orange-600 - Call-to-action (high contrast, urgency)
    ctaHover: '#C2410C',       // Orange-700
  },
  
  logo: {
    light: '/branding/teamshotspro_trans.png',
    dark: '/branding/teamshotspro_trans.png',
    icon: '/branding/icon.png',
    favicon: '/branding/favicon.ico',
  },
  
  ogImage: '/branding/og-image.jpg',
  
  legal: {
    teamName: 'TeamShotsPro',
    address: 'Creek Harbour, Dubai, UAE',
    foundedYear: 2025,
  },
} as const;

/**
 * Get the current domain from the request context.
 * Works in both server and client components.
 * 
 * @param requestHeaders - Optional headers for server-side detection
 * @returns The normalized domain (without www) or null if unable to determine
 */
function getCurrentDomain(requestHeaders?: Headers): string | null {
  // Client-side detection
  if (typeof window !== 'undefined') {
    try {
      const hostname = window.location.hostname.toLowerCase()
      return hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  }
  
  // Server-side detection from provided headers
  if (requestHeaders) {
    const host = requestHeaders.get('host') || requestHeaders.get('x-forwarded-host')
    if (host) {
      const normalizedHost = host.split(':')[0].replace(/^www\./, '').toLowerCase()
      return normalizedHost
    }
  }
  
  // Server-side detection using Next.js headers() (server components only)
  // This will throw if called in a client component, which we catch below
  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const headersList = headers()
      const host = headersList.get('host') || headersList.get('x-forwarded-host')
      if (host) {
        const normalizedHost = host.split(':')[0].replace(/^www\./, '').toLowerCase()
        return normalizedHost
      }
    } catch {
      // headers() not available in this context (e.g., during build or in client component)
      // This is expected and safe to ignore
    }
  }
  
  return null
}

/**
 * Get the logo path based on the current domain.
 * Returns PhotoShotsPro logo for photoshotspro.com, TeamShotsPro logo otherwise.
 * 
 * Works in both client and server components.
 * - Client components: Automatically detects domain from window.location
 * - Server components: Automatically detects domain from Next.js headers() if available,
 *   or you can pass headers explicitly for more control
 * 
 * @param theme - 'light' or 'dark' variant (only used for TeamShotsPro logo)
 * @param requestHeaders - Optional headers for server-side detection (useful in API routes)
 * @returns Path to the logo image
 */
export function getBrandLogo(theme: 'light' | 'dark' = 'light', requestHeaders?: Headers): string {
  const domain = getCurrentDomain(requestHeaders)
  
  // Use PhotoShotsPro logo for individual domain
  if (domain === INDIVIDUAL_DOMAIN) {
    return '/branding/PhotoShotsPro_trans.png'
  }
  
  // Default to TeamShotsPro logo
  return BRAND_CONFIG.logo[theme]
}

// Helper functions for easy access
export function getBrandColor(type: 'primary' | 'secondary' | 'cta', hover = false): string {
  if (hover) {
    return BRAND_CONFIG.colors[`${type}Hover` as keyof typeof BRAND_CONFIG.colors];
  }
  return BRAND_CONFIG.colors[type];
}

export function getBrandName(): string {
  return BRAND_CONFIG.name;
}

// Note: Tagline should be retrieved using useTranslations('footer.tagline') in components

