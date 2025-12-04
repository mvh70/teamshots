import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import ConditionalHeader from '@/components/ConditionalHeader';
import Footer from '@/components/Footer';
import { Playfair_Display, Inter } from 'next/font/google';
import { getLandingVariant } from '@/config/landing-content';
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

/**
 * Get domain from request headers (server-side)
 */
async function getDomainFromHeaders(): Promise<string | undefined> {
  const headersList = await headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host');
  if (host) {
    return host.split(':')[0].replace(/^www\./, '').toLowerCase();
  }
  return undefined;
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  
  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as 'en' | 'es')) {
    notFound();
  }

  // Detect domain server-side for branding
  const domain = await getDomainFromHeaders();
  const variant = getLandingVariant(domain);

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className={`${displayFont.variable} ${bodyFont.variable} font-body`}>
          {/* Conditional header that only shows on non-app routes */}
          <ConditionalHeader variant={variant} />
          {children}
          {/* Footer that shows on public routes (landing, pricing, etc.) */}
          <Footer variant={variant} />
      </div>
    </NextIntlClientProvider>
  );
}

