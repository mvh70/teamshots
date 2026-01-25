import { INDIVIDUAL_DOMAIN, INDIVIDUAL_DOMAIN_2, TEAM_DOMAIN, COUPLES_DOMAIN, FAMILY_DOMAIN, EXTENSION_DOMAIN } from './domain'

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

// Typography per domain
const TYPOGRAPHY_CONFIGS: Record<string, BrandTypography> = {
  [TEAM_DOMAIN]: {
    displayFont: 'font-display',
    bodyFont: 'font-sans',
  },
  [INDIVIDUAL_DOMAIN]: {
    displayFont: 'font-display',
    bodyFont: 'font-sans',
  },
  [INDIVIDUAL_DOMAIN_2]: {
    displayFont: 'font-display',
    bodyFont: 'font-sans',
  },
  [COUPLES_DOMAIN]: {
    displayFont: 'font-display',
    bodyFont: 'font-sans',
  },
  [FAMILY_DOMAIN]: {
    displayFont: 'font-display',
    bodyFont: 'font-sans',
  },
  [EXTENSION_DOMAIN]: {
    displayFont: 'font-display',
    bodyFont: 'font-sans',
  },
};

// Style tokens per domain
const STYLE_CONFIGS: Record<string, BrandStyle> = {
  [TEAM_DOMAIN]: {
    borderRadius: 'rounded',
    shadowIntensity: 'medium',
    tone: 'corporate',
  },
  [INDIVIDUAL_DOMAIN]: {
    borderRadius: 'pill',
    shadowIntensity: 'dramatic',
    tone: 'friendly',
  },
  [INDIVIDUAL_DOMAIN_2]: {
    borderRadius: 'pill',
    shadowIntensity: 'dramatic',
    tone: 'friendly',
  },
  [COUPLES_DOMAIN]: {
    borderRadius: 'rounded',
    shadowIntensity: 'medium',
    tone: 'friendly',
  },
  [FAMILY_DOMAIN]: {
    borderRadius: 'rounded',
    shadowIntensity: 'medium',
    tone: 'friendly',
  },
  [EXTENSION_DOMAIN]: {
    borderRadius: 'sharp',
    shadowIntensity: 'dramatic',
    tone: 'playful',
  },
};

// Explicit brand configs (avoid dynamic lookups in client bundles)
const TEAM_BRAND: BrandConfig = {
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
};

const INDIVIDUAL_BRAND: BrandConfig = {
  name: 'IndividualShots',
  domain: INDIVIDUAL_DOMAIN,
  contact: {
    hello: `hello@${INDIVIDUAL_DOMAIN}`,
    support: `support@${INDIVIDUAL_DOMAIN}`,
    privacy: `privacy@${INDIVIDUAL_DOMAIN}`,
    legal: `legal@${INDIVIDUAL_DOMAIN}`,
  },
  logo: {
    light: '/branding/individualshots.svg',
    dark: '/branding/individualshots.svg',
    icon: '/branding/icon.png',
    favicon: '/branding/favicon.ico',
  },
  ogImage: '/branding/og-image.jpg',
  legal: {
    ...SHARED_CONFIG.legal,
    teamName: 'IndividualShots',
  },
  colors: SHARED_CONFIG.colors,
  typography: TYPOGRAPHY_CONFIGS[INDIVIDUAL_DOMAIN],
  style: STYLE_CONFIGS[INDIVIDUAL_DOMAIN],
};

const COUPLES_BRAND: BrandConfig = {
  name: 'CoupleShots',
  domain: COUPLES_DOMAIN,
  contact: {
    hello: `hello@${COUPLES_DOMAIN}`,
    support: `support@${COUPLES_DOMAIN}`,
    privacy: `privacy@${COUPLES_DOMAIN}`,
    legal: `legal@${COUPLES_DOMAIN}`,
  },
  logo: {
    light: '/branding/coupleshots.svg',
    dark: '/branding/coupleshots.svg',
    icon: '/branding/icon.png',
    favicon: '/branding/favicon.ico',
  },
  ogImage: '/branding/og-image.jpg',
  legal: {
    ...SHARED_CONFIG.legal,
    teamName: 'CoupleShots',
  },
  colors: { ...SHARED_CONFIG.colors, primary: '#EC4899', primaryHover: '#DB2777' }, // Pink
  typography: TYPOGRAPHY_CONFIGS[COUPLES_DOMAIN],
  style: STYLE_CONFIGS[COUPLES_DOMAIN],
};

const FAMILY_BRAND: BrandConfig = {
  name: 'FamilyShots',
  domain: FAMILY_DOMAIN,
  contact: {
    hello: `hello@${FAMILY_DOMAIN}`,
    support: `support@${FAMILY_DOMAIN}`,
    privacy: `privacy@${FAMILY_DOMAIN}`,
    legal: `legal@${FAMILY_DOMAIN}`,
  },
  logo: {
    light: '/branding/familyshots.svg',
    dark: '/branding/familyshots.svg',
    icon: '/branding/icon.png',
    favicon: '/branding/favicon.ico',
  },
  ogImage: '/branding/og-image.jpg',
  legal: {
    ...SHARED_CONFIG.legal,
    teamName: 'FamilyShots',
  },
  colors: { ...SHARED_CONFIG.colors, primary: '#0EA5E9', primaryHover: '#0284C7' }, // Sky Blue
  typography: TYPOGRAPHY_CONFIGS[FAMILY_DOMAIN],
  style: STYLE_CONFIGS[FAMILY_DOMAIN],
};

const EXTENSION_BRAND: BrandConfig = {
  name: 'RightClickFit',
  domain: EXTENSION_DOMAIN,
  contact: {
    hello: `hello@${EXTENSION_DOMAIN}`,
    support: `support@${EXTENSION_DOMAIN}`,
    privacy: `privacy@${EXTENSION_DOMAIN}`,
    legal: `legal@${EXTENSION_DOMAIN}`,
  },
  logo: {
    light: '/branding/rightclickfit.svg',
    dark: '/branding/rightclickfit.svg',
    icon: '/branding/icon.png',
    favicon: '/branding/favicon.ico',
  },
  ogImage: '/branding/og-image.jpg',
  legal: {
    ...SHARED_CONFIG.legal,
    teamName: 'RightClickFit',
  },
  colors: { ...SHARED_CONFIG.colors, primary: '#8B5CF6', primaryHover: '#7C3AED' }, // Violet
  typography: TYPOGRAPHY_CONFIGS[EXTENSION_DOMAIN],
  style: STYLE_CONFIGS[EXTENSION_DOMAIN],
};

const PHOTOSHOTSPRO_BRAND: BrandConfig = {
  name: 'PhotoShotsPro',
  domain: INDIVIDUAL_DOMAIN_2,
  contact: {
    hello: `hello@${INDIVIDUAL_DOMAIN_2}.com`,
    support: `support@${INDIVIDUAL_DOMAIN_2}.com`,
    privacy: `privacy@${INDIVIDUAL_DOMAIN_2}.com`,
    legal: `legal@${INDIVIDUAL_DOMAIN_2}.com`,
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
  typography: TYPOGRAPHY_CONFIGS[INDIVIDUAL_DOMAIN_2],
  style: STYLE_CONFIGS[INDIVIDUAL_DOMAIN_2],
};

export const BRAND_CONFIGS: Record<string, BrandConfig> = {
  [TEAM_DOMAIN]: TEAM_BRAND,
  [INDIVIDUAL_DOMAIN]: INDIVIDUAL_BRAND,
  [INDIVIDUAL_DOMAIN_2]: PHOTOSHOTSPRO_BRAND,
  [COUPLES_DOMAIN]: COUPLES_BRAND,
  [FAMILY_DOMAIN]: FAMILY_BRAND,
  [EXTENSION_DOMAIN]: EXTENSION_BRAND,
};

// Default brand config (TeamShotsPro) - for backwards compatibility
export const BRAND_CONFIG = TEAM_BRAND;

/**
 * Get the current domain from request headers.
 * 
 * IMPORTANT: This function is SERVER-SIDE ONLY. Do not call from client components.
 * All brand decisions must be made on the server to prevent hydration mismatches and abuse.
 * 
 * On localhost, respects NEXT_PUBLIC_FORCE_DOMAIN env var for testing different brands.
 * 
 * @param requestHeaders - Required headers for server-side detection
 * @returns The normalized domain (without www) or null if unable to determine
 */
function getCurrentDomain(requestHeaders?: Headers): string | null {
  // Check for forced domain override (localhost development only)
  const forcedDomain = process.env.NEXT_PUBLIC_FORCE_DOMAIN
  
  // Server-side detection from provided headers (REQUIRED)
  if (requestHeaders) {
    const host = requestHeaders.get('host') || requestHeaders.get('x-forwarded-host')
    if (host) {
      const normalizedHost = host.split(':')[0].replace(/^www\./, '').toLowerCase()
      
      // On localhost, allow forced domain override
      if ((normalizedHost === 'localhost' || normalizedHost === '127.0.0.1') && forcedDomain) {
        // Log for debugging
        console.log(`[Brand Detection] Localhost detected. Forcing domain: ${forcedDomain}`);
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
 * IMPORTANT: This function is SERVER-SIDE ONLY. Always pass headers.
 * All brand decisions must be made on the server to prevent hydration mismatches and abuse.
 * 
 * @param requestHeaders - Headers for server-side domain detection
 * @returns Complete brand configuration object
 */
export function getBrand(requestHeaders?: Headers): BrandConfig {
  const domain = getCurrentDomain(requestHeaders)
  
  if (domain) {
    // Exact match
    if (BRAND_CONFIGS[domain]) {
      return BRAND_CONFIGS[domain]
    }
    // Also try matching the forced domain directly if it's not in the map yet (fallback)
    // This handles cases where EXTENSION_DOMAIN might not be perfectly aligned with the map key in some envs
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
