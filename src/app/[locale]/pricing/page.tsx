import type { Metadata } from 'next';
import { constructMetadata } from '@/lib/seo';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { type LandingVariant } from '@/config/landing-content';
import { getBrandByDomain } from '@/config/brand';
import { getTenant } from '@/config/tenant-server';
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
  await getTranslations({ locale, namespace: 'pricing' });
  const tenant = await getTenant();
  const headersList = await headers();
  const brand = getBrandByDomain(tenant.domain);
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || brand.domain;
  const baseUrl = `${protocol}://${host}`;
  const variant = tenant.landingVariant;

  // SEO-optimized title and description based on variant
  // Note: Brand name is auto-appended by layout.tsx template, so don't include it here
  const title = variant === 'teamshotspro'
    ? `Team Headshot Pricing | From $${PRICING_CONFIG.seats.graduatedTiers[PRICING_CONFIG.seats.graduatedTiers.length - 1].pricePerSeat}/Person`
    : variant === 'rightclickfit'
      ? `Virtual Try-On Pricing - From $${PRICING_CONFIG.individual.price}`
      : `AI Headshot Pricing - From $${PRICING_CONFIG.individual.price}`;

  // Keep description under 160 chars for optimal SERP display
  const description = variant === 'teamshotspro'
    ? `Team headshots from $${PRICING_CONFIG.seats.graduatedTiers[PRICING_CONFIG.seats.graduatedTiers.length - 1].pricePerSeat}/person. Volume discounts to $${PRICING_CONFIG.seats.graduatedTiers[0].pricePerSeat}/person. 10 photos each. No subscription.`
    : variant === 'rightclickfit'
      ? `Virtual try-on credits from $${PRICING_CONFIG.individual.price}. Preview outfits instantly with RightClickFit and buy only what you need.`
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

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  const tenant = await getTenant();
  const variant = tenant.landingVariant;

  // Get brand info for schema
  const headersList = await headers();
  const brand = getBrandByDomain(tenant.domain);
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
        brand={brand}
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
  variant: LandingVariant,
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

  if (variant === 'rightclickfit') {
    return [
      {
        question: 'How does RightClickFit pricing work?',
        answer: 'Install the extension for free, then buy credit packs only when you need more virtual try-ons.',
      },
      {
        question: 'Do credits expire?',
        answer: 'No. Purchased credits remain on your account until you use them.',
      },
      {
        question: 'Can I start without a credit card?',
        answer: 'Yes. You can create an account and start with a free trial before purchasing a paid pack.',
      },
      {
        question: 'Can I upgrade later?',
        answer: 'Yes. Start with a smaller pack and upgrade anytime to larger credit packs.',
      },
    ];
  }

  // Individual pricing FAQ keys
  const individualFaqKeys = ['freeGen', 'howCreditsWork', 'topUp', 'satisfaction'];
  return individualFaqKeys.map((key) => ({
    question: t(`faq.questions.${key}.question`),
    answer: t(`faq.questions.${key}.answer`),
  }));
}
