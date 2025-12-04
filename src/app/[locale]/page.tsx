import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import dynamic from 'next/dynamic';
import { routing } from '@/i18n/routing';
import { getLandingVariant, type LandingVariant } from '@/config/landing-content';

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

/**
 * Landing Page Components mapped by variant
 */
const LANDING_COMPONENTS: Record<LandingVariant, React.ComponentType> = {
  teamshotspro: TeamShotsLanding,
  photoshotspro: PhotoShotsLanding,
  coupleshotspro: TeamShotsLanding, // Fallback to TeamShots for future variant
};

export default async function Page() {
  // Detect domain server-side
  const domain = await getDomainFromHeaders();
  const variant = getLandingVariant(domain);
  
  // Select the appropriate landing component
  const LandingComponent = LANDING_COMPONENTS[variant] || TeamShotsLanding;
  
  return <LandingComponent />;
}
