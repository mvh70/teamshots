import type { Metadata } from 'next';
import { constructMetadata } from '@/lib/seo';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getLandingVariant } from '@/config/landing-content';
import { getBrand } from '@/config/brand';
import PricingContent from './PricingContent';

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const headersList = await headers();
  const brand = getBrand(headersList);

  return constructMetadata({
    path: '/pricing',
    locale,
    title: `Pricing | ${brand.name}`,
    description: t('description'),
  });
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

export default async function PricingPage({ params }: Props) {
  // Ensure params are awaited (Next.js 15 requirement)
  await params;

  // Detect domain server-side for pricing display
  const domain = await getDomainFromHeaders();
  const variant = getLandingVariant(domain);

  return <PricingContent variant={variant} />;
}

