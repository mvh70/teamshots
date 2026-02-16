'use client';

import type { ReactNode } from 'react';
import { usePathname } from '@/i18n/routing';
import ConditionalHeader from '@/components/ConditionalHeader';
import Footer from '@/components/Footer';
import type { LandingVariant } from '@/config/landing-content';

interface LocaleChromeProps {
  children: ReactNode;
  brandName: string;
  brandLogoLight: string;
  brandLogoDark: string;
  brandContact: {
    hello: string;
    support: string;
    privacy: string;
    legal: string;
  };
  variant: LandingVariant;
}

function isLpRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return false;

  const offset = segments[0] === 'en' || segments[0] === 'es' ? 1 : 0;
  return segments[offset] === 'lp';
}

export default function LocaleChrome({
  children,
  brandName,
  brandLogoLight,
  brandLogoDark,
  brandContact,
  variant,
}: LocaleChromeProps) {
  const pathname = usePathname();

  if (isLpRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <ConditionalHeader
        brandName={brandName}
        brandLogo={brandLogoLight}
        variant={variant}
      />
      {children}
      <Footer
        brandName={brandName}
        brandLogo={brandLogoDark}
        brandContact={brandContact}
        variant={variant}
      />
    </>
  );
}
