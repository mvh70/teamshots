export const BRAND_CONFIG = {
  name: 'TeamShots',
  domain: 'teamshots.vip',
  
  contact: {
    hello: 'hello@teamshots.vip',
    support: 'support@teamshots.vip',
    privacy: 'privacy@teamshots.vip',
    legal: 'legal@teamshots.vip',
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
    light: '/branding/logo-light.svg',
    dark: '/branding/logo-dark.svg',
    icon: '/branding/icon.svg',
    favicon: '/branding/favicon.ico',
  },
  
  ogImage: '/branding/og-image.jpg',
  
  legal: {
    companyName: 'TeamShots Inc.',
    address: '123 Main St, San Francisco, CA 94105',
    foundedYear: 2025,
  },
} as const;

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

export function getBrandLogo(theme: 'light' | 'dark' = 'light'): string {
  return BRAND_CONFIG.logo[theme];
}

