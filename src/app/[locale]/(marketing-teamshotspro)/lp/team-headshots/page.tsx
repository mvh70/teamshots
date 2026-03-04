import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { constructMetadata } from '@/lib/seo';
import { getBaseUrl } from '@/lib/url';
import { getBrandByDomain } from '@/config/brand';
import { getTenant } from '@/config/tenant-server';
import TeamHeadshotsLP from './TeamHeadshotsLP';

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const headersList = await headers();
  const baseUrl = getBaseUrl(headersList);
  const t = await getTranslations({ locale, namespace: 'lp.teamHeadshots.meta' });

  return constructMetadata({
    baseUrl,
    path: '/lp/team-headshots',
    locale,
    title: t('title'),
    description: t('description'),
    noIndex: true,
  });
}

export default async function TeamHeadshotsLandingPage() {
  const tenant = await getTenant();
  const brand = getBrandByDomain(tenant.domain);
  const variant = tenant.landingVariant;

  return (
    <TeamHeadshotsLP
      supportEmail={brand.contact.support}
      variant={variant}
    />
  );
}
