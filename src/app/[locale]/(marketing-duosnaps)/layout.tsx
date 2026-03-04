import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getTenantFromHeaders } from '@/config/tenant-server';

export default async function CoupleShotsMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const tenant = getTenantFromHeaders(headersList);

  // Domain gate: only allow CoupleShots domain
  if (tenant.id !== 'coupleshots') {
    notFound();
  }

  return <>{children}</>;
}
