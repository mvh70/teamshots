import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import LocaleChrome from '@/components/LocaleChrome';
import { Work_Sans, Inter } from 'next/font/google';
import { getBrandByDomain } from '@/config/brand';
import { getTenant } from '@/config/tenant-server';
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

  const tenant = await getTenant();
  const brand = getBrandByDomain(tenant.domain);
  const variant = tenant.landingVariant;

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <meta name="x-tenant-id" content={tenant.id} />
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
