import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, Link } from '@/i18n/routing';
import Image from 'next/image';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { BRAND_CONFIG } from '@/config/brand';
import './globals.css';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  
  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as 'en' | 'es')) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();
  const t = await getTranslations('nav');
  const tFooter = await getTranslations('footer');

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <header className="border-b bg-white">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link href="/" className="flex items-center" aria-label={BRAND_CONFIG.name}>
                  {/* Light background header uses the light logo variant */}
                  <Image 
                    src={BRAND_CONFIG.logo.light} 
                    alt={BRAND_CONFIG.name} 
                    width={120} 
                    height={32} 
                    className="h-8 w-auto" 
                  />
                </Link>
              </div>
              <div className="flex items-center gap-6">
                <Link href="/" className="text-gray-700 hover:text-gray-900">
                  {t('home')}
                </Link>
                <Link href="/pricing" className="text-gray-700 hover:text-gray-900">
                  {t('pricing')}
                </Link>
                <LanguageSwitcher />
                <Link
                  href="/#waitlist"
                  className="px-4 py-2 bg-brand-cta text-white rounded-lg hover:bg-brand-cta-hover transition-colors"
                >
                  {t('joinWaitlist')}
                </Link>
              </div>
            </nav>
          </header>
          {children}
          <footer className="bg-gray-900 text-gray-300 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  {/* Dark background footer uses the dark logo variant */}
                  <Image 
                    src={BRAND_CONFIG.logo.dark} 
                    alt={BRAND_CONFIG.name} 
                    width={150} 
                    height={40} 
                    className="h-10 w-auto" 
                  />
                </div>
                <p className="text-gray-400 mb-6">
                  {tFooter('tagline')}
                </p>
                <div className="flex justify-center gap-6">
                  <Link href="/" className="hover:text-white">
                    {t('home')}
                  </Link>
                  <Link href="/pricing" className="hover:text-white">
                    {t('pricing')}
                  </Link>
                  <Link href="/#waitlist" className="hover:text-white">
                    {t('joinWaitlist')}
                  </Link>
                </div>
                <p className="text-gray-500 text-sm mt-8">
                  {tFooter('copyright')}
                </p>
              </div>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

