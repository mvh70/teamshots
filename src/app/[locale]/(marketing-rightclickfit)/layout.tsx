import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getTenantFromHeaders } from '@/config/tenant-server';

export default async function RightClickFitMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const tenant = getTenantFromHeaders(headersList);

  // Domain gate: only allow RightClickFit domain
  if (tenant.id !== 'rightclickfit') {
    notFound();
  }

  return <>{children}</>;
}
