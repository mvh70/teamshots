import {NextIntlClientProvider} from 'next-intl'
import type {AbstractIntlMessages} from 'next-intl'
import en from '../../../messages/en.json'
import es from '../../../messages/es.json'
import {cookies} from 'next/headers'
import Link from 'next/link'
import Image from 'next/image'
import { BRAND_CONFIG, getBrandLogo } from '@/config/brand'

export default async function AuthLayout({children}: {children: React.ReactNode}) {
  let locale: 'en' | 'es' = 'en'
  
  try {
    const cookieStore = await cookies()
    if (cookieStore) {
      locale = cookieStore.get('NEXT_LOCALE')?.value === 'es' ? 'es' : 'en'
    }
  } catch {
    // cookies() is not available in build/static contexts, use default locale
    locale = 'en'
  }
  
  const messages: AbstractIntlMessages = (locale === 'es' ? es : en) as unknown as AbstractIntlMessages

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-gradient-to-b from-brand-primary-light via-white to-gray-50">
        <header className="w-full pt-10 pb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
            <Link href="/" aria-label={BRAND_CONFIG.name} className="inline-flex items-center gap-3">
              <Image src={getBrandLogo('light')} alt={BRAND_CONFIG.name} width={120} height={32} className="h-8" style={{ width: 'auto' }} priority />
            </Link>
          </div>
        </header>
        {children}
      </div>
    </NextIntlClientProvider>
  )
}
