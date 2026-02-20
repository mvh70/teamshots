import type { Metadata } from 'next';
import { constructMetadata } from '@/lib/seo';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import dynamic from 'next/dynamic';
import { routing } from '@/i18n/routing';
import { getLandingVariant, type LandingVariant } from '@/config/landing-content';
import { getBrand } from '@/config/brand';
import { LandingSchema } from './landings/LandingSchema';

// Dynamic imports for landing pages
const TeamShotsLanding = dynamic(() => import('./landings/TeamShotsLanding'), { ssr: true });
const PortreyaLanding = dynamic(() => import('./landings/PortreyaLanding'), { ssr: true });
const PortreyaLandingV2 = dynamic(() => import('./landings/PortreyaLandingV2'), { ssr: true });
const RightClickFitLanding = dynamic(() => import('./landings/RightClickFitLanding'), { ssr: true });

type Props = {
  params: Promise<{ locale: string }>;
};

export interface LandingProps {
  supportEmail: string;
  variant: LandingVariant;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const headersList = await headers();
  const brand = getBrand(headersList);
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || brand.domain;
  const baseUrl = `${protocol}://${host}`;

  return constructMetadata({
    baseUrl,
    path: '/',
    locale,
    title: t('title'),
    description: t('description'),
  });
}

const LANDING_COMPONENTS: Record<LandingVariant, React.ComponentType<LandingProps>> = {
  teamshotspro: TeamShotsLanding,
  individualshots: PortreyaLanding,
  portreya: PortreyaLandingV2,
  coupleshots: PortreyaLanding,
  familyshots: PortreyaLanding,
  rightclickfit: RightClickFitLanding,
};

// FAQ items for schema - pulled from shared translations
const FAQ_ITEMS_EN: Array<{ question: string; answer: string }> = [
  {
    question: 'What types of photos work best?',
    answer: 'Any clear photo of your face works! Selfies and casual photos work great. The better quality your selfie, the better quality your result.',
  },
  {
    question: 'How does the photo generation work?',
    answer: 'Unlike other platforms that train a model on your selfies, we use a multi-step approach. Your selfie is combined with your brand settings to generate each headshot individually. No model training, no batch of random outputs.',
  },
  {
    question: 'How many photos do I get per generation?',
    answer: 'Each generation produces 4 different professional variations of your photo. You can download all of them and choose your favorites.',
  },
  {
    question: 'Do you support team photos or just individual headshots?',
    answer: 'Both! For teams, you can invite members who can generate their own headshots following your brand guidelines. For individuals, you get full control over your own photos.',
  },
  {
    question: 'How is this different from other AI headshot tools?',
    answer: 'Most AI tools train a model on your face using 10-20 photos, then generate random outputs hoping one looks good. We generate each photo uniquely from your actual selfie with real-time quality control.',
  },
  {
    question: 'How much does it cost?',
    answer: 'We offer a free trial so you can test the quality. For teams, pricing starts at $29.99 per person with volume discounts. No subscriptions or hidden fees.',
  },
  {
    question: 'Can I use these photos for my LinkedIn, website, etc.?',
    answer: 'Yes! All generated photos are yours to use for any professional purpose - LinkedIn, company websites, business cards, presentations, and more.',
  },
  {
    question: 'Is my data secure and private?',
    answer: 'We use enterprise-grade encryption and never store your photos permanently. Photos are automatically deleted within 30 days after account closure.',
  },
];

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const headersList = await headers();
  const brand = getBrand(headersList);
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || brand.domain;
  const baseUrl = `${protocol}://${host}`;
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined;
  const variant = getLandingVariant(domain);

  const LandingComponent = LANDING_COMPONENTS[variant] || TeamShotsLanding;

  return (
    <>
      <LandingSchema
        baseUrl={baseUrl}
        brand={brand}
        locale={locale}
        variant={variant}
        faqItems={FAQ_ITEMS_EN}
      />
      <LandingComponent supportEmail={brand.contact.support} variant={variant} />
    </>
  );
}
