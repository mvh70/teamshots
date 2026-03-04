import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getTenantFromHeaders } from '@/config/tenant-server';

export default async function FamilyShotsMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const tenant = getTenantFromHeaders(headersList);

  // Domain gate: only allow FamilyShots domain
  if (tenant.id !== 'familyshots') {
    notFound();
  }

  return <>{children}</>;
}
