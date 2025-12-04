import { INDIVIDUAL_DOMAIN, TEAM_DOMAIN } from './domain'

// Type definitions for brand configuration
export interface BrandContact {
  hello: string;
  support: string;
  privacy: string;
  legal: string;
}

export interface BrandLogo {
  light: string;
  dark: string;
  icon: string;
  favicon: string;
}

export interface BrandColors {
  primary: string;
  primaryHover: string;
  secondary: string;
  secondaryHover: string;
  cta: string;
  ctaHover: string;
}

export interface BrandLegal {
  teamName: string;
  address: string;
  foundedYear: number;
}

export interface BrandConfig {
  name: string;
  domain: string;
  contact: BrandContact;
  logo: BrandLogo;
  ogImage: string;
  legal: BrandLegal;
  colors: BrandColors;
}

// Shared configuration (same across all brands)
const SHARED_CONFIG = {
  colors: {
    primary: '#6366F1',        // Indigo-500 - Brand identity (distinctive from competitors)
    primaryHover: '#4F46E5',   // Indigo-600
    secondary: '#10B981',      // Green-500 - Success states
    secondaryHover: '#059669', // Green-600
    cta: '#EA580C',            // Orange-600 - Call-to-action (high contrast, urgency)
    ctaHover: '#C2410C',       // Orange-700
  },
  legal: {
    address: 'Creek Harbour, Dubai, UAE',
    foundedYear: 2025,
  },
} as const satisfies { colors: BrandColors; legal: Omit<BrandLegal, 'teamName'> };

// Complete brand configurations per domain
const BRAND_CONFIGS: Record<string, BrandConfig> = {
  [TEAM_DOMAIN]: {
    name: 'TeamShotsPro',
    domain: TEAM_DOMAIN,
    contact: {
      hello: 'hello@teamshotspro.com',
      support: 'support@teamshotspro.com',
      privacy: 'privacy@teamshotspro.com',
      legal: 'legal@teamshotspro.com',
    },
    logo: {
      light: '/branding/teamshotspro_trans.webp',
      dark: '/branding/teamshotspro_trans.webp',
      icon: '/branding/icon.png',
      favicon: '/branding/favicon.ico',
    },
    ogImage: '/branding/og-image.jpg',
    legal: {
      ...SHARED_CONFIG.legal,
      teamName: 'TeamShotsPro',
    },
    colors: SHARED_CONFIG.colors,
  },
  [INDIVIDUAL_DOMAIN]: {
    name: 'PhotoShotsPro',
    domain: INDIVIDUAL_DOMAIN,
    contact: {
      hello: 'hello@photoshotspro.com',
      support: 'support@photoshotspro.com',
      privacy: 'privacy@photoshotspro.com',
      legal: 'legal@photoshotspro.com',
    },
    logo: {
      light: '/branding/PhotoShotsPro_trans.webp',
      dark: '/branding/PhotoShotsPro_trans.webp',
      icon: '/branding/icon.png',
      favicon: '/branding/favicon.ico',
    },
    ogImage: '/branding/og-image.jpg',
    legal: {
      ...SHARED_CONFIG.legal,
      teamName: 'PhotoShotsPro',
    },
    colors: SHARED_CONFIG.colors,
  },
};

// Default brand config (TeamShotsPro) - for backwards compatibility
export const BRAND_CONFIG = BRAND_CONFIGS[TEAM_DOMAIN];

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
  
  return null
}

/**
 * Get the complete brand configuration based on the current domain.
 * Returns PhotoShotsPro config for photoshotspro.com, TeamShotsPro config otherwise.
 * 
 * Works in both client and server components.
 * - Client components: Automatically detects domain from window.location
 * - Server components: Pass headers explicitly for accurate detection
 * 
 * @param requestHeaders - Optional headers for server-side detection (useful in API routes)
 * @returns Complete brand configuration object
 */
export function getBrand(requestHeaders?: Headers): BrandConfig {
  const domain = getCurrentDomain(requestHeaders)
  
  if (domain === INDIVIDUAL_DOMAIN) {
    return BRAND_CONFIGS[INDIVIDUAL_DOMAIN]
  }
  
  // Default to TeamShotsPro
  return BRAND_CONFIGS[TEAM_DOMAIN]
}

/**
 * Get the logo path based on the current domain.
 * Returns PhotoShotsPro logo for photoshotspro.com, TeamShotsPro logo otherwise.
 * 
 * @param theme - 'light' or 'dark' variant
 * @param requestHeaders - Optional headers for server-side detection (useful in API routes)
 * @returns Path to the logo image
 */
export function getBrandLogo(theme: 'light' | 'dark' = 'light', requestHeaders?: Headers): string {
  return getBrand(requestHeaders).logo[theme]
}

/**
 * Get brand-specific contact emails based on the current domain.
 * Returns PhotoShotsPro emails for photoshotspro.com, TeamShotsPro emails otherwise.
 * 
 * @param requestHeaders - Optional headers for server-side detection (useful in API routes)
 * @returns Object containing brand-specific contact email addresses
 */
export function getBrandContact(requestHeaders?: Headers): BrandContact {
  return getBrand(requestHeaders).contact
}

/**
 * Get the brand name based on the current domain.
 * Returns "PhotoShotsPro" for photoshotspro.com, "TeamShotsPro" otherwise.
 * 
 * @param requestHeaders - Optional headers for server-side detection
 * @returns The brand name string
 */
export function getBrandName(requestHeaders?: Headers): string {
  return getBrand(requestHeaders).name
}

// Helper function for color access
export function getBrandColor(type: 'primary' | 'secondary' | 'cta', hover = false, requestHeaders?: Headers): string {
  const colors = getBrand(requestHeaders).colors;
  if (hover) {
    return colors[`${type}Hover` as keyof BrandColors];
  }
  return colors[type];
}

// Note: Tagline should be retrieved using useTranslations('footer.tagline') in components

