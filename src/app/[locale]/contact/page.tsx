import type { Metadata } from 'next';
import { constructMetadata } from '@/lib/seo';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getBrand } from '@/config/brand';
import ContactForm from '@/components/contact/ContactForm';

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  const headersList = await headers();
  const brand = getBrand(headersList);
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || brand.domain;
  const baseUrl = `${protocol}://${host}`;

  return constructMetadata({
    baseUrl,
    path: '/contact',
    locale,
    title: t('title'),
    description: t('description'),
  });
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;

  const t = await getTranslations({ locale, namespace: 'contact' });

  return (
    <div className="min-h-screen bg-gray-50 py-16 lg:py-24">
      <div className="max-w-2xl mx-auto px-6 sm:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            {t('description')}
          </p>
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
