import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { headers } from 'next/headers';

/**
 * Detect domain from request headers and normalize to variant name
 * Returns 'teamshotspro' | 'photoshotspro' | null
 */
async function getRequestDomain(): Promise<string | null> {
  try {
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');

    if (!host) return null;

    // Handle comma-separated values from multiple proxies (take first)
    const hostname = host.split(',')[0].trim().split(':')[0].toLowerCase();
    const domain = hostname.replace(/^www\./, '');

    // Handle localhost with forced domain for testing
    if (domain === 'localhost') {
      const forced = process.env.NEXT_PUBLIC_FORCE_DOMAIN;
      if (!forced) return null;

      // Normalize forced domain to variant name (strip www. and .com)
      const normalizedForced = forced.replace(/^www\./, '').toLowerCase().replace(/\.com$/, '');
      return normalizedForced;
    }

    // Normalize domain to variant name
    if (domain === 'teamshotspro.com') return 'teamshotspro';
    if (domain === 'photoshotspro.com') return 'photoshotspro';

    return null;
  } catch {
    // Headers not available (e.g., build time)
    return null;
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as 'en' | 'es')) {
    locale = routing.defaultLocale;
  }

  // Load shared messages (always loaded for all routes)
  const sharedMessages = (await import(`../../messages/${locale}/shared.json`)).default;

  // Detect domain and load domain-specific messages if applicable
  const domain = await getRequestDomain();
  let domainMessages = {};

  if (domain) {
    try {
      domainMessages = (await import(`../../messages/${locale}/${domain}.json`)).default;
    } catch {
      // Domain file doesn't exist, use shared only
      // This is expected for unknown domains or routes without domain context
    }
  }

  // Merge messages: domain-specific messages overlay shared messages
  const messages = {
    ...sharedMessages,
    ...domainMessages,
  };

  return {
    locale,
    messages,
  };
});

