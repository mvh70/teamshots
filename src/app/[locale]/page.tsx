import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import dynamic from 'next/dynamic';
import { routing } from '@/i18n/routing';
import { getLandingVariant, type LandingVariant } from '@/config/landing-content';
import { getBrand } from '@/config/brand';

// Dynamic imports for landing pages
const TeamShotsLanding = dynamic(() => import('./landings/TeamShotsLanding'), { ssr: true });
const PhotoShotsLanding = dynamic(() => import('./landings/PhotoShotsLanding'), { ssr: true });
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
  const host = headersList.get('host') || headersList.get('x-forwarded-host') || brand.domain;
  const baseUrl = `${protocol}://${host}`;

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: locale === 'en' ? baseUrl : `${baseUrl}/${locale}`,
      languages: {
        'en': baseUrl,
        'es': `${baseUrl}/es`,
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: locale === 'en' ? baseUrl : `${baseUrl}/${locale}`,
    },
  };
}

const LANDING_COMPONENTS: Record<LandingVariant, React.ComponentType<LandingProps>> = {
  teamshotspro: TeamShotsLanding,
  individualshots: PhotoShotsLanding,
  coupleshots: PhotoShotsLanding,
  familyshots: PhotoShotsLanding,
  rightclickfit: RightClickFitLanding,
};

export default async function Page() {
  const headersList = await headers();
  const brand = getBrand(headersList);
  const host = headersList.get('host') || headersList.get('x-forwarded-host');
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined;
  const variant = getLandingVariant(domain);
  
  const LandingComponent = LANDING_COMPONENTS[variant] || TeamShotsLanding;
  
  return <LandingComponent supportEmail={brand.contact.support} variant={variant} />;
}
