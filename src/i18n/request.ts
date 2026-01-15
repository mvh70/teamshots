import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { headers } from 'next/headers';
import { TEAM_DOMAIN, INDIVIDUAL_DOMAIN, COUPLES_DOMAIN, FAMILY_DOMAIN, EXTENSION_DOMAIN } from '@/config/domain';
import { SOLUTIONS } from '@/config/solutions';

/**
 * Detect domain from request headers and normalize to variant name
 * Returns 'teamshotspro' | 'photoshotspro' | 'coupleshotspro' | 'familyshotspro' | 'rightclickfit' | null
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
      // This is a simplified fallback for local dev
      const normalizedForced = forced.replace(/^www\./, '').toLowerCase().replace(/\.com$/, '');
      return normalizedForced;
    }

    // Normalize domain to variant name
    if (domain === TEAM_DOMAIN) return 'teamshotspro';
    if (domain === INDIVIDUAL_DOMAIN) return 'photoshotspro';
    if (domain === COUPLES_DOMAIN) return 'coupleshotspro';
    if (domain === FAMILY_DOMAIN) return 'familyshotspro';
    if (domain === EXTENSION_DOMAIN) return 'rightclickfit';

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
  let solutionMessages: Record<string, unknown> = {};

  if (domain) {
    try {
      domainMessages = (await import(`../../messages/${locale}/${domain}.json`)).default;
    } catch {
      // Domain file doesn't exist, use shared only
      // This is expected for unknown domains or routes without domain context
    }
  }

  // Load programmatic vertical copy into a dedicated namespace.
  // This keeps vertical content modular (one file per industry) and prevents bloating teamshotspro.json.
  // Always load these regardless of domain detection - the solutions pages are domain-gated by layout,
  // and we need translations available at build time for static generation.
  const pairs = await Promise.all(
    SOLUTIONS.map(async (s) => {
      try {
        const mod = (await import(`../../messages/${locale}/teamshotspro/solutions/${s.slug}.json`)).default;
        return [s.slug, mod] as const;
      } catch {
        // Missing solution file is allowed during rollout; the page will still 404 if it needs the copy.
        return [s.slug, null] as const;
      }
    }),
  );

  solutionMessages = Object.fromEntries(pairs.filter(([, v]) => v));

  // Merge messages: domain-specific messages overlay shared messages
  const messages = {
    ...sharedMessages,
    ...domainMessages,
    ...(Object.keys(solutionMessages).length > 0 ? { solutions: solutionMessages } : {}),
  };

  return {
    locale,
    messages,
  };
});
