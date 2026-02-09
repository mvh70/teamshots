import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { headers } from 'next/headers'
import { Work_Sans, Inter } from 'next/font/google'
import { OnbordaProvider } from '@/components/onboarding/OnbordaProvider'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
import { routing } from '@/i18n/routing'
import '../globals.css'

const displayFont = Work_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
})

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export default async function InviteDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Detect locale from Accept-Language header, falling back to default
  const headersList = await headers()
  const acceptLang = headersList.get('accept-language') || ''
  const locale = routing.locales.find(l => acceptLang.toLowerCase().includes(l)) || routing.defaultLocale
  const messages = await getMessages({ locale })
  
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <OnboardingProvider>
        <OnbordaProvider>
          <div className={`${displayFont.variable} ${bodyFont.variable} font-body`}>
            {children}
          </div>
        </OnbordaProvider>
      </OnboardingProvider>
    </NextIntlClientProvider>
  )
}
