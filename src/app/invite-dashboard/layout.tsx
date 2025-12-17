import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Work_Sans, Inter } from 'next/font/google'
import { OnbordaProvider } from '@/components/onboarding/OnbordaProvider'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
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
  // Default to English for invite dashboard
  const locale = 'en'
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
