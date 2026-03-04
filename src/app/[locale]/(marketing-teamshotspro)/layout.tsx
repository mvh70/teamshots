import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getTenantFromHeaders } from '@/config/tenant-server';

export default async function TeamShotsProMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const tenant = getTenantFromHeaders(headersList);

  // Domain gate: only allow TeamShotsPro domain
  if (tenant.id !== 'teamshotspro') {
    notFound();
  }

  return <>{children}</>;
}
