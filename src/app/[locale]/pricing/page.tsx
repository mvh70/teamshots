import type { Metadata } from 'next';
import { constructMetadata } from '@/lib/seo';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getLandingVariant, type LandingVariant } from '@/config/landing-content';
import { getBrand } from '@/config/brand';
import { PRICING_CONFIG } from '@/config/pricing';
import { calculatePhotosFromCredits } from '@/domain/pricing/utils';
import PricingContent from './PricingContent';
import { PricingSchema } from './schema';

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const tPricing = await getTranslations({ locale, namespace: 'pricing' });
  const headersList = await headers();
  const brand = getBrand(headersList);
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || brand.domain;
  const baseUrl = `${protocol}://${host}`;

  // Determine variant for SEO-optimized metadata
  const domain = host?.split(':')[0].replace(/^www\./, '').toLowerCase();
  const variant = getLandingVariant(domain);

  // SEO-optimized title and description based on variant
  // Note: Brand name is auto-appended by layout.tsx template, so don't include it here
  const title = variant === 'teamshotspro'
    ? `Team Headshot Pricing - From $${PRICING_CONFIG.seats.graduatedTiers[PRICING_CONFIG.seats.graduatedTiers.length - 1].pricePerSeat}/Person`
    : `AI Headshot Pricing - From $${PRICING_CONFIG.individual.price}`;

  // Keep description under 160 chars for optimal SERP display
  const description = variant === 'teamshotspro'
    ? `Team headshots from $${PRICING_CONFIG.seats.graduatedTiers[PRICING_CONFIG.seats.graduatedTiers.length - 1].pricePerSeat}/person. Volume discounts to $${PRICING_CONFIG.seats.graduatedTiers[0].pricePerSeat}/person. 10 photos each. No subscription.`
    : `Professional AI headshots from $${PRICING_CONFIG.individual.price}. ${calculatePhotosFromCredits(PRICING_CONFIG.individual.credits)} photos. No subscription, no hidden fees.`;

  // Add og:image for social sharing
  const ogImage = `${baseUrl}/branding/og-image.jpg`;

  return constructMetadata({
    baseUrl,
    path: '/pricing',
    locale,
    title,
    description,
    image: ogImage,
  });
}

/**
 * Get domain from request headers (server-side)
 */
async function getDomainFromHeaders(): Promise<string | undefined> {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  if (host) {
    return host.split(':')[0].replace(/^www\./, '').toLowerCase();
  }
  return undefined;
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;

  // Detect domain server-side for pricing display
  const domain = await getDomainFromHeaders();
  const variant = getLandingVariant(domain);

  // Get brand info for schema
  const headersList = await headers();
  const brand = getBrand(headersList);
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || brand.domain;
  const baseUrl = `${protocol}://${host}`;

  // Get translations for FAQ schema
  const t = await getTranslations({ locale, namespace: 'pricing' });

  // Build FAQ items for schema based on variant
  const faqItems = buildFaqItems(variant, t);

  // Calculate pricing values for schema
  const individualPhotos = calculatePhotosFromCredits(PRICING_CONFIG.individual.credits);
  const vipPhotos = calculatePhotosFromCredits(PRICING_CONFIG.vip.credits);

  return (
    <>
      <PricingSchema
        baseUrl={baseUrl}
        brandName={brand.name}
        locale={locale}
        variant={variant}
        individualPrice={PRICING_CONFIG.individual.price}
        individualPhotos={individualPhotos}
        vipPrice={PRICING_CONFIG.vip.price}
        vipPhotos={vipPhotos}
        seatsMinPrice={PRICING_CONFIG.seats.graduatedTiers[0].pricePerSeat}
        seatsMaxPrice={PRICING_CONFIG.seats.graduatedTiers[PRICING_CONFIG.seats.graduatedTiers.length - 1].pricePerSeat}
        photosPerSeat={calculatePhotosFromCredits(PRICING_CONFIG.seats.creditsPerSeat)}
        faqItems={faqItems}
      />
      <PricingContent variant={variant} />
    </>
  );
}

/**
 * Build FAQ items for schema based on variant
 */
function buildFaqItems(
  variant: LandingVariant | undefined,
  t: (key: string) => string
): Array<{ question: string; answer: string }> {
  if (variant === 'teamshotspro') {
    // Team-specific FAQ keys
    const teamFaqKeys = ['refund', 'turnaround', 'requirements', 'consistency', 'addSeatsLater', 'unusedCredits'];
    return teamFaqKeys.map((key) => ({
      question: t(`seats.faq.${key}.question`),
      answer: t(`seats.faq.${key}.answer`),
    }));
  }

  // Individual pricing FAQ keys
  const individualFaqKeys = ['freeGen', 'howCreditsWork', 'topUp', 'satisfaction'];
  return individualFaqKeys.map((key) => ({
    question: t(`faq.questions.${key}.question`),
    answer: t(`faq.questions.${key}.answer`),
  }));
}

