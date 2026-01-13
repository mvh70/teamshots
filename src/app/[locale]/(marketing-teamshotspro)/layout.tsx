import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getLandingVariant } from '@/config/landing-content';

export default async function TeamShotsProMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host');
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined;
  const variant = getLandingVariant(domain);

  // Domain gate: only allow TeamShotsPro domain
  if (variant !== 'teamshotspro') {
    notFound();
  }

  return <>{children}</>;
}
