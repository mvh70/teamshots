import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import ConditionalHeader from '@/components/ConditionalHeader';
import Footer from '@/components/Footer';
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

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className={`${displayFont.variable} ${bodyFont.variable} font-body`}>
          {/* Conditional header that only shows on non-app routes */}
          <ConditionalHeader />
          {children}
          {/* Footer that shows on public routes (landing, pricing, etc.) */}
          <Footer />
      </div>
    </NextIntlClientProvider>
  );
}

