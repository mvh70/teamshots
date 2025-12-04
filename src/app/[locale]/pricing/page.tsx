import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';
import { getLandingVariant } from '@/config/landing-content';
import PricingContent from './PricingContent';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Get domain from request headers (server-side)
 */
async function getDomainFromHeaders(): Promise<string | undefined> {
  const headersList = await headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host');
  if (host) {
    return host.split(':')[0].replace(/^www\./, '').toLowerCase();
  }
  return undefined;
}

export default async function PricingPage() {
  // Detect domain server-side for pricing display
  const domain = await getDomainFromHeaders();
  const variant = getLandingVariant(domain);
  
  return <PricingContent variant={variant} />;
}

