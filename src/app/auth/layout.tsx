import {NextIntlClientProvider} from 'next-intl'
import type {AbstractIntlMessages} from 'next-intl'
import en from '../../../messages/en.json'
import es from '../../../messages/es.json'
import {cookies} from 'next/headers'
import Link from 'next/link'
import { BRAND_CONFIG } from '@/config/brand'

export default async function AuthLayout({children}: {children: React.ReactNode}) {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value === 'es' ? 'es' : 'en'
  const messages: AbstractIntlMessages = (locale === 'es' ? es : en) as unknown as AbstractIntlMessages

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-gradient-to-b from-brand-primary-light via-white to-gray-50">
        <header className="w-full pt-10 pb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
            <Link href="/" aria-label={BRAND_CONFIG.name} className="inline-flex items-center gap-3">
              <img src={BRAND_CONFIG.logo.light} alt={BRAND_CONFIG.name} className="h-8 w-auto" />
            </Link>
          </div>
        </header>
        {children}
      </div>
    </NextIntlClientProvider>
  )
}
