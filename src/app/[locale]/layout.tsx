import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import LocaleChrome from '@/components/LocaleChrome';
import { Work_Sans, Inter } from 'next/font/google';
import { getLandingVariant } from '@/config/landing-content';
import { getBrand } from '@/config/brand';
import '../globals.css';

const displayFont = Work_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
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

  // Server-side brand detection - all brand decisions happen here
  const headersList = await headers();
  const brand = getBrand(headersList);
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined;
  const variant = getLandingVariant(domain);

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className={`${displayFont.variable} ${bodyFont.variable} font-body`}>
        <LocaleChrome
          brandName={brand.name}
          brandLogoLight={brand.logo.light}
          brandLogoDark={brand.logo.dark}
          brandContact={brand.contact}
          variant={variant}
        >
          {children}
        </LocaleChrome>
      </div>
    </NextIntlClientProvider>
  );
}
