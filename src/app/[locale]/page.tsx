import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import dynamic from 'next/dynamic';
import { routing } from '@/i18n/routing';
import { getLandingVariant, type LandingVariant } from '@/config/landing-content';
import { getBrand } from '@/config/brand';

// Dynamic imports for landing pages to avoid Server/Client Component issues
const TeamShotsLanding = dynamic(() => import('./landings/TeamShotsLanding'), {
  ssr: true,
});
const PhotoShotsLanding = dynamic(() => import('./landings/PhotoShotsLanding'), {
  ssr: true,
});

type Props = {
  params: Promise<{ locale: string }>;
};

/** Props passed to landing components from server */
export interface LandingProps {
  supportEmail: string;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: locale === 'en' ? '/' : `/${locale}`,
      languages: {
        'en': '/',
        'es': '/es',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
    },
  };
}

/**
 * Landing Page Components mapped by variant
 */
const LANDING_COMPONENTS: Record<LandingVariant, React.ComponentType<LandingProps>> = {
  teamshotspro: TeamShotsLanding,
  photoshotspro: PhotoShotsLanding,
  coupleshotspro: TeamShotsLanding, // Fallback to TeamShots for future variant
};

export default async function Page() {
  // Server-side brand detection
  const headersList = await headers();
  const brand = getBrand(headersList);
  const host = headersList.get('host') || headersList.get('x-forwarded-host');
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined;
  const variant = getLandingVariant(domain);
  
  // Select the appropriate landing component
  const LandingComponent = LANDING_COMPONENTS[variant] || TeamShotsLanding;
  
  return <LandingComponent supportEmail={brand.contact.support} />;
}
