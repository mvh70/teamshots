import { PORTREYA_DOMAIN, TEAM_DOMAIN, EXTENSION_DOMAIN } from './domain'

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

export interface BrandCta {
  primaryText: string;
  primaryTextEs?: string;
  primaryHref: string;
  pricingHref: string;
  socialProof?: {
    metric: string;
    metricEs?: string;
    description: string;
    descriptionEs?: string;
  };
}

export interface BrandConfig {
  name: string;
  domain: string;
  contact: BrandContact;
  logo: BrandLogo;
  ogImage: string;
  legal: BrandLegal;
  colors: BrandColors;
  cta: BrandCta;
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

const CTA_BASE = {
  primaryHref: '/auth/signup',
  pricingHref: '/pricing',
} as const satisfies Pick<BrandCta, 'primaryHref' | 'pricingHref'>;

const TEAM_CTA: BrandCta = {
  ...CTA_BASE,
  primaryText: 'Upload a Selfie → Get Team Headshots',
  primaryTextEs: 'Sube una selfie → obtén headshots de equipo',
  socialProof: {
    metric: '60 seconds',
    metricEs: '60 segundos',
    description: 'average first results',
    descriptionEs: 'promedio para primeros resultados',
  },
};

const PHOTOS_CTA: BrandCta = {
  ...CTA_BASE,
  primaryText: 'Upload a Selfie → Get Headshots',
  primaryTextEs: 'Sube una selfie → obtén headshots',
  socialProof: {
    metric: '60 seconds',
    metricEs: '60 segundos',
    description: 'to first AI headshots',
    descriptionEs: 'para los primeros headshots con IA',
  },
};

const RIGHTCLICK_CTA: BrandCta = {
  ...CTA_BASE,
  primaryText: 'Start Free → Try RightClickFit',
  primaryTextEs: 'Empieza gratis → Prueba RightClickFit',
  socialProof: {
    metric: 'Instant fit',
    metricEs: 'Ajuste instantáneo',
    description: 'try-on previews',
    descriptionEs: 'previsualizaciones de prueba',
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
  cta: TEAM_CTA,
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
  cta: RIGHTCLICK_CTA,
};

const PORTREYA_BRAND: BrandConfig = {
  name: 'Portreya',
  domain: PORTREYA_DOMAIN,
  contact: {
    hello: 'hello@portreya.com',
    support: 'support@portreya.com',
    privacy: 'privacy@portreya.com',
    legal: 'legal@portreya.com',
  },
  logo: {
    light: '/branding/Portreya_trans.webp',
    dark: '/branding/Portreya_trans.webp',
    icon: '/branding/icon.png',
    favicon: '/branding/favicon.ico',
  },
  ogImage: '/branding/og-image.jpg',
  legal: {
    ...SHARED_CONFIG.legal,
    teamName: 'Portreya',
  },
  colors: {
    primary: '#0F172A',        // Deep studio navy
    primaryHover: '#1E293B',   // Slate-800
    secondary: '#B45309',      // Bronze accent
    secondaryHover: '#92400E', // Bronze dark
    cta: '#B45309',            // Bronze for CTAs
    ctaHover: '#92400E',       // Bronze dark
  },
  cta: PHOTOS_CTA,
};

export const BRAND_CONFIGS: Record<string, BrandConfig> = {
  [TEAM_DOMAIN]: TEAM_BRAND,
  [PORTREYA_DOMAIN]: PORTREYA_BRAND,
  [EXTENSION_DOMAIN]: EXTENSION_BRAND,
};

// Default brand config (TeamShotsPro) - for backwards compatibility
export const BRAND_CONFIG = TEAM_BRAND;

// Allowed domains for security validation
const ALLOWED_DOMAINS = [
  'teamshotspro.com',
  'portreya.com',
  'rightclickfit.com',
  'localhost',
  '127.0.0.1',
]

/**
 * Normalize a host string to a domain.
 * Removes port numbers and www prefix, converts to lowercase.
 */
export function normalizeDomain(host: string | null): string | null {
  if (!host) return null
  return host.split(':')[0].replace(/^www\./, '').toLowerCase()
}

/**
 * Validate that a domain is in the allowed list.
 * Returns the domain if valid, null otherwise.
 */
export function validateDomain(domain: string | null): string | null {
  if (!domain) return null
  if (ALLOWED_DOMAINS.includes(domain)) return domain
  // Allow without .com suffix (local dev: portreya:3000 → portreya)
  if (ALLOWED_DOMAINS.includes(`${domain}.com`)) return domain
  // Also allow subdomains
  if (ALLOWED_DOMAINS.some(allowed => domain.endsWith('.' + allowed))) return domain
  return null
}

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
    // Prefer 'host' header over 'x-forwarded-host' for security
    const host = requestHeaders.get('host')
    if (host) {
      const normalizedHost = normalizeDomain(host)

      // On localhost, allow forced domain override
      if ((normalizedHost === 'localhost' || normalizedHost === '127.0.0.1') && forcedDomain) {
        // Log for debugging
        console.log(`[Brand Detection] Localhost detected. Forcing domain: ${forcedDomain}`);
        return normalizeDomain(forcedDomain)
      }

      // Validate domain against whitelist
      const validatedDomain = validateDomain(normalizedHost)
      if (validatedDomain) {
        return validatedDomain
      }

      // Log invalid domain attempts in production for security monitoring
      if (process.env.NODE_ENV === 'production') {
        console.warn(`[Brand Detection] Invalid domain attempted: ${normalizedHost}`)
      }
    }
  }

  return null
}

/**
 * Get the complete brand configuration based on the current domain.
 * Returns Portreya config for portreya.com, TeamShotsPro config otherwise.
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
    // Try matching with .com suffix (for local dev without .com in hosts file)
    if (BRAND_CONFIGS[`${domain}.com`]) {
      return BRAND_CONFIGS[`${domain}.com`]
    }
  }

  // Default to TeamShotsPro
  return BRAND_CONFIGS[TEAM_DOMAIN]
}

/**
 * Get the logo path based on the current domain.
 * Returns Portreya logo for portreya.com, TeamShotsPro logo otherwise.
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
 * Returns Portreya emails for portreya.com, TeamShotsPro emails otherwise.
 * 
 * @param requestHeaders - Optional headers for server-side detection (useful in API routes)
 * @returns Object containing brand-specific contact email addresses
 */
export function getBrandContact(requestHeaders?: Headers): BrandContact {
  return getBrand(requestHeaders).contact
}

/**
 * Get the brand name based on the current domain.
 * Returns "Portreya" for portreya.com, "TeamShotsPro" otherwise.
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

// Note: getBrandTypography and getBrandStyle removed - typography and style configs were unused
// Note: Tagline should be retrieved using useTranslations('footer.tagline') in components
