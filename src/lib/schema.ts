import type { BrandConfig } from '@/config/brand';

/** Supported languages for schema inLanguage — only locales currently live */
export const SUPPORTED_LANGUAGES = ['en-US', 'es-ES'];

/** Map a next-intl locale to a BCP-47 language tag */
export function inLanguageForLocale(locale: string): string {
  switch (locale) {
    case 'es': return 'es-ES';
    case 'fr': return 'fr-FR';
    case 'de': return 'de-DE';
    case 'nl': return 'nl-NL';
    default: return 'en-US';
  }
}

/** Reusable Organization schema derived from BrandConfig */
export function organizationSchema(brand: BrandConfig, baseUrl: string) {
  return {
    '@type': 'Organization',
    '@id': `${baseUrl}#organization`,
    name: brand.name,
    url: baseUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl}${brand.logo.light}`,
      width: 300,
      height: 60,
    },
    image: `${baseUrl}${brand.ogImage}`,
    ...(brand.sameAs?.length && { sameAs: brand.sameAs }),
    contactPoint: {
      '@type': 'ContactPoint',
      email: brand.contact.support,
      contactType: 'customer support',
      availableLanguage: ['English', 'Spanish', 'French', 'German', 'Dutch'],
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dubai',
      addressCountry: 'AE',
    },
  };
}
