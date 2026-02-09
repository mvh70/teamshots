import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getLandingVariant } from '@/config/landing-content';

export default async function CoupleShotsMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined;
  const variant = getLandingVariant(domain);

  // Domain gate: only allow CoupleShots domain
  if (variant !== 'coupleshots') {
    notFound();
  }

  return <>{children}</>;
}
