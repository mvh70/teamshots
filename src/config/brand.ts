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

/**
 * Typography configuration for domain-specific fonts
 */
export interface BrandTypography {
  /** Font class for display/heading text (e.g., 'font-display', 'font-sans') */
  displayFont: string;
  /** Font class for body text */
  bodyFont: string;
}

/**
 * Style tokens for domain-specific visual treatments
 */
export interface BrandStyle {
  /** Border radius style: affects buttons, cards, inputs */
  borderRadius: 'sharp' | 'rounded' | 'pill';
  /** Shadow intensity: affects depth perception */
  shadowIntensity: 'subtle' | 'medium' | 'dramatic';
  /** Overall visual tone */
  tone: 'corporate' | 'friendly' | 'playful';
}

export interface BrandConfig {
  name: string;
  domain: string;
  contact: BrandContact;
  logo: BrandLogo;
  ogImage: string;
  legal: BrandLegal;
  colors: BrandColors;
  typography: BrandTypography;
  style: BrandStyle;
}

// Shared configuration (same across all brands)
const SHARED_CONFIG = {
  colors: {
    primary: '#6366F1',        // Indigo-500 - Brand identity (distinctive from competitors)
    primaryHover: '#4F46E5',   // Indigo-600
    secondary: '#10B981',      // Green-500 - Success states
    secondaryHover: '#059669', // Green-600
    cta: '#C2410C',            // Orange-700 - Call-to-action (WCAG AA compliant with white text)
    ctaHover: '#9A3412',       // Orange-800
  },
  legal: {
    address: 'Creek Harbour, Dubai, UAE',
    foundedYear: 2025,
  },
} as const satisfies { colors: BrandColors; legal: Omit<BrandLegal, 'teamName'> };

// Domain-specific typography configurations
const TYPOGRAPHY_CONFIGS: Record<string, BrandTypography> = {
  [TEAM_DOMAIN]: {
    displayFont: 'font-display',  // Corporate/professional display font
    bodyFont: 'font-sans',        // Clean sans-serif for readability
  },
  [INDIVIDUAL_DOMAIN]: {
    displayFont: 'font-display',  // Can be customized to a friendlier font
    bodyFont: 'font-sans',        // Consistent body font
  },
};

// Domain-specific style configurations
const STYLE_CONFIGS: Record<string, BrandStyle> = {
  [TEAM_DOMAIN]: {
    borderRadius: 'rounded',      // Professional, modern rounded corners
    shadowIntensity: 'medium',    // Balanced depth
    tone: 'corporate',            // B2B professional tone
  },
  [INDIVIDUAL_DOMAIN]: {
    borderRadius: 'pill',         // Friendlier, softer appearance
    shadowIntensity: 'dramatic',  // More visual impact for individuals
    tone: 'friendly',             // Approachable, personal tone
  },
};

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
    typography: TYPOGRAPHY_CONFIGS[TEAM_DOMAIN],
    style: STYLE_CONFIGS[TEAM_DOMAIN],
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
    typography: TYPOGRAPHY_CONFIGS[INDIVIDUAL_DOMAIN],
    style: STYLE_CONFIGS[INDIVIDUAL_DOMAIN],
  },
};

// Default brand config (TeamShotsPro) - for backwards compatibility
export const BRAND_CONFIG = BRAND_CONFIGS[TEAM_DOMAIN];

/**
 * Get the current domain from the request context.
 * Works in both server and client components.
 * 
 * On localhost, respects NEXT_PUBLIC_FORCE_DOMAIN env var for testing different brands.
 * 
 * @param requestHeaders - Optional headers for server-side detection
 * @returns The normalized domain (without www) or null if unable to determine
 */
function getCurrentDomain(requestHeaders?: Headers): string | null {
  // Check for forced domain override (localhost development only)
  const forcedDomain = process.env.NEXT_PUBLIC_FORCE_DOMAIN
  
  // Client-side detection
  if (typeof window !== 'undefined') {
    try {
      const hostname = window.location.hostname.toLowerCase()
      // On localhost, use forced domain if set
      if (hostname === 'localhost' && forcedDomain) {
        return forcedDomain.replace(/^www\./, '').toLowerCase()
      }
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
      // On localhost, use forced domain if set
      if (normalizedHost === 'localhost' && forcedDomain) {
        return forcedDomain.replace(/^www\./, '').toLowerCase()
      }
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

/**
 * Get brand typography configuration
 */
export function getBrandTypography(requestHeaders?: Headers): BrandTypography {
  return getBrand(requestHeaders).typography;
}

/**
 * Get brand style tokens
 */
export function getBrandStyle(requestHeaders?: Headers): BrandStyle {
  return getBrand(requestHeaders).style;
}

// Note: Tagline should be retrieved using useTranslations('footer.tagline') in components

