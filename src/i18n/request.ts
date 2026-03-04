import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isAppLocale } from './routing';
import { headers } from 'next/headers';
import {
  DEFAULT_TENANT_ID,
  TENANTS,
  getTenantById,
  resolveTenantId,
  type TenantId,
} from '@/config/tenant';
import { SOLUTIONS } from '@/config/solutions';

/**
 * Parse tenant ID from the middleware header, if recognized.
 */
function parseTrustedTenantId(rawTenantId: string | null): TenantId | null {
  if (!rawTenantId) return null;
  const normalized = rawTenantId.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized in TENANTS) {
    return normalized as TenantId;
  }

  return null;
}

/**
 * Resolve tenant ID from request context.
 * Host remains authoritative when host/header disagree.
 */
async function getRequestTenantId(): Promise<TenantId> {
  try {
    const headersList = await headers();
    const hostLikeValue = headersList.get('x-forwarded-host') || headersList.get('host');
    const hostTenantId = resolveTenantId(hostLikeValue);
    const headerTenantId = parseTrustedTenantId(headersList.get('x-tenant-id'));

    if (hostTenantId) return hostTenantId;
    if (headerTenantId) return headerTenantId;

    return DEFAULT_TENANT_ID;
  } catch {
    // Headers not available (e.g., build time)
    return DEFAULT_TENANT_ID;
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!isAppLocale(locale)) {
    locale = DEFAULT_LOCALE;
  }

  // Load shared messages (always loaded for all routes)
  const sharedMessages = (await import(`../../messages/${locale}/shared.json`)).default;

  // Load tenant-specific messages based on detected tenant.
  // At build time, tenant detection fails (no headers) - fall back to default tenant.
  // This is fine because pages are domain-gated at layout level and render dynamically at runtime.
  const tenantId = await getRequestTenantId();
  const messageFile = getTenantById(tenantId).messageFile;
  let domainMessages: Record<string, unknown> = {};
  let solutionMessages: Record<string, unknown> = {};

  try {
    domainMessages = (await import(`../../messages/${locale}/${messageFile}.json`)).default;
  } catch {
    // Domain file doesn't exist, use shared only
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
