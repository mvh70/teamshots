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
  sameAs?: string[];
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
  sameAs: [
    'https://www.linkedin.com/company/teamshotspro',
    'https://twitter.com/teamshotspro',
  ],
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

/**
 * Normalize a host string to a domain.
 * Removes port numbers and www prefix, converts to lowercase.
 */
function normalizeDomain(host: string | null): string | null {
  if (!host) return null
  return host.split(':')[0].replace(/^www\./, '').toLowerCase()
}

/**
 * Get brand configuration from a domain-like input.
 * Accepts host values with optional port / www prefixes.
 */
export function getBrandByDomain(domainOrHost?: string | null): BrandConfig {
  const normalizedDomain = normalizeDomain(domainOrHost ?? null)

  if (normalizedDomain) {
    // Exact match
    if (BRAND_CONFIGS[normalizedDomain]) {
      return BRAND_CONFIGS[normalizedDomain]
    }
    // Try matching with .com suffix (for local dev without .com in hosts file)
    if (BRAND_CONFIGS[`${normalizedDomain}.com`]) {
      return BRAND_CONFIGS[`${normalizedDomain}.com`]
    }
  }

  // Default to TeamShotsPro
  return BRAND_CONFIGS[TEAM_DOMAIN]
}

// Note: getBrandTypography and getBrandStyle removed - typography and style configs were unused
// Note: Tagline should be retrieved using useTranslations('footer.tagline') in components
