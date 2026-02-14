import type { Metadata } from 'next';
import { constructMetadata } from '@/lib/seo';
import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';
import { getBrand } from '@/config/brand';
import { getTranslations } from 'next-intl/server';
import CostCalculator from './CostCalculator';
import { CostCalculatorSchema } from './schema';

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const headersList = await headers();
  const brand = getBrand(headersList);
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || brand.domain;
  const baseUrl = `${protocol}://${host}`;

  const t = await getTranslations({ locale, namespace: 'costCalculator' });

  const baseMetadata = constructMetadata({
    baseUrl,
    path: '/headshot-cost-calculator',
    locale,
    title: t('meta.title'),
    description: t('meta.description'),
  });

  return {
    ...baseMetadata,
    openGraph: {
      ...baseMetadata.openGraph,
      type: 'website',
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      images: [
        {
          url: `${baseUrl}/branding/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: t('meta.title'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta.title'),
      description: t('meta.description'),
      images: [`${baseUrl}/branding/og-image.jpg`],
    },
  };
}

export default async function HeadshotCostCalculatorPage({ params }: Props) {
  const { locale } = await params;
  const headersList = await headers();
  const brand = getBrand(headersList);
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || brand.domain;
  const baseUrl = `${protocol}://${host}`;

  const t = await getTranslations({ locale, namespace: 'costCalculator' });

  return (
    <>
      <CostCalculatorSchema baseUrl={baseUrl} brandName={brand.name} locale={locale} t={t} />
      <CostCalculator />
    </>
  );
}
