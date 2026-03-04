import {NextIntlClientProvider} from 'next-intl'
import type {AbstractIntlMessages} from 'next-intl'
import en from '../../../messages/en/shared.json'
import es from '../../../messages/es/shared.json'
import {cookies, headers} from 'next/headers'
import Link from 'next/link'
import Image from 'next/image'
import { getBrandByDomain } from '@/config/brand'
import { getTenantFromHeaders } from '@/config/tenant-server'
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/i18n/routing'

const AUTH_MESSAGES: Record<AppLocale, AbstractIntlMessages> = {
  en: en as unknown as AbstractIntlMessages,
  es: es as unknown as AbstractIntlMessages,
}

export default async function AuthLayout({children}: {children: React.ReactNode}) {
  let locale: AppLocale = DEFAULT_LOCALE

  try {
    const cookieStore = await cookies()
    if (cookieStore) {
      const localeCookieValue = cookieStore.get('NEXT_LOCALE')?.value
      if (isAppLocale(localeCookieValue)) {
        locale = localeCookieValue
      }
    }
  } catch {
    // cookies() is not available in build/static contexts, use default locale
    locale = DEFAULT_LOCALE
  }

  const messages = AUTH_MESSAGES[locale]

  const requestHeaders = await headers()
  const tenant = getTenantFromHeaders(requestHeaders)
  const brand = getBrandByDomain(tenant.domain)

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div
        className="min-h-screen bg-gradient-to-b from-brand-primary-light via-white to-gray-50"
        data-tenant-id={tenant.id}
        data-brand-name={brand.name}
        data-has-team-features={tenant.hasTeamFeatures ? 'true' : 'false'}
      >
        <header className="w-full pt-10 pb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
            <Link href="/" aria-label={brand.name} className="inline-flex items-center gap-3">
              <Image src={brand.logo.light} alt={brand.name} width={120} height={32} className="h-8" style={{ width: 'auto' }} priority />
            </Link>
          </div>
        </header>
        {children}
      </div>
    </NextIntlClientProvider>
  )
}
