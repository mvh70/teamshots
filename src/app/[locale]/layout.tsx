import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, Link } from '@/i18n/routing';
import Image from 'next/image';
import ConditionalHeader from '@/components/ConditionalHeader';
import { BRAND_CONFIG } from '@/config/brand';
import { auth } from '@/auth';
import { Playfair_Display, Inter } from 'next/font/google';
import '../globals.css';

const displayFont = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '700', '900'],
});

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

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

  // Check authentication status
  const session = await auth();
  const isAuthenticated = !!session?.user;

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();
  const t = await getTranslations('nav');
  const tFooter = await getTranslations('footer');

  return (
    <NextIntlClientProvider messages={messages}>
      <div className={`${displayFont.variable} ${bodyFont.variable} font-body`}>
          {/* Conditional header that only shows on non-app routes */}
          <ConditionalHeader />
          {children}
          {!isAuthenticated && (
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
                      style={{ width: 'auto' }} 
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
                    <Link href="/auth/signup" className="hover:text-white">
                      Get Started
                    </Link>
                  </div>
                  <p className="text-gray-500 text-sm mt-8">
                    {tFooter('copyright')}
                  </p>
                </div>
              </div>
            </footer>
          )}
      </div>
    </NextIntlClientProvider>
  );
}

