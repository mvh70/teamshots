'use client';

import { usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import type { LandingVariant } from '@/config/landing-content';

interface FooterProps {
  /** Brand name from server */
  brandName: string;
  /** Brand logo URL from server (dark variant for dark background) */
  brandLogo: string;
  /** Brand contact emails from server */
  brandContact: {
    hello: string;
    support: string;
    privacy: string;
    legal: string;
  };
  /** Variant for translations (from server) */
  variant?: LandingVariant;
}

export default function Footer({ brandName, brandLogo, variant = 'teamshotspro' }: FooterProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  
  // Get domain-specific footer translations using server-provided variant
  const tFooter = useTranslations(`landing.${variant}.footer`);

  // Don't show footer on app routes or mobile upload-selfie page
  const isAppRoute = pathname?.includes('/app/') || pathname?.includes('/auth/');
  const isUploadSelfiePage = pathname?.includes('/upload-selfie/');

  // Don't show default footer on landing pages that have their own footer (e.g., Portreya V2, RightClickFit)
  const isLandingPageWithOwnFooter = (variant === 'portreya' || variant === 'rightclickfit') && (pathname === '/' || pathname === '/en' || pathname === '/es' || pathname === '/fr' || pathname === '/de' || pathname === '/nl');

  if (isAppRoute || isUploadSelfiePage || isLandingPageWithOwnFooter) {
    return null;
  }

  return (
    <footer className="bg-text-dark text-white py-16 lg:py-20 border-t-2 border-brand-primary-lighter">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            {/* Dark background footer uses the dark logo variant */}
            <Image
              src={brandLogo}
              alt={brandName}
              width={150}
              height={40}
              className="opacity-90"
              unoptimized
            />
          </div>
          <p className="text-gray-300 mb-8 text-lg">
            {tFooter('tagline')}
          </p>
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <Link href="/" className="text-white hover:text-brand-primary-light transition-colors duration-300 font-medium">
              {t('home')}
            </Link>
            <Link href="/pricing" className="text-white hover:text-brand-primary-light transition-colors duration-300 font-medium">
              {t('pricing')}
            </Link>
            <Link href="/blog" className="text-white hover:text-brand-primary-light transition-colors duration-300 font-medium">
              {t('blog')}
            </Link>
            <a
              href="https://calendly.com/teamshotspro/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-brand-primary-light transition-colors duration-300 font-medium"
            >
              {tFooter('bookDemo')}
            </a>
            <Link href="/auth/signup" className="text-white hover:text-brand-primary-light transition-colors duration-300 font-medium">
              {t('getStarted')}
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm">
            <Link href="/legal/privacy" className="text-gray-400 hover:text-white transition-colors duration-300">
              {tFooter('privacy')}
            </Link>
            <Link href="/legal/terms" className="text-gray-400 hover:text-white transition-colors duration-300">
              {tFooter('terms')}
            </Link>
            <span className="text-gray-400 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {tFooter('gdpr')}
            </span>
          </div>

          <p className="text-gray-400 text-sm mb-2">
            {tFooter('companyInfo')}
          </p>
          <p className="text-gray-400 text-sm">
            {tFooter('copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}
