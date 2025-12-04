'use client';

import { usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { BRAND_CONFIG, getBrandLogo } from '@/config/brand';

export default function Footer() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tFooter = useTranslations('footer');
  
  // Don't show footer on app routes
  const isAppRoute = pathname?.includes('/app/') || pathname?.includes('/auth/');
  
  if (isAppRoute) {
    return null;
  }

  return (
    <footer className="bg-text-dark text-white py-16 lg:py-20 border-t-2 border-brand-primary-lighter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            {/* Dark background footer uses the dark logo variant */}
            <Image
              src={getBrandLogo('dark')}
              alt={BRAND_CONFIG.name}
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
            <Link href="/auth/signup" className="text-white hover:text-brand-primary-light transition-colors duration-300 font-medium">
              Get Started
            </Link>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm">
            <Link href="/legal/privacy" className="text-gray-400 hover:text-white transition-colors duration-300">
              {tFooter('privacy')}
            </Link>
            <Link href="/legal/terms" className="text-gray-400 hover:text-white transition-colors duration-300">
              {tFooter('terms')}
            </Link>
          </div>

          <p className="text-gray-400 text-sm">
            {tFooter('copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}

