import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Playfair_Display, Inter } from 'next/font/google'
import { OnbordaProvider } from '@/components/onboarding/OnbordaProvider'
import '../globals.css'

const displayFont = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '700', '900'],
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
      <OnbordaProvider>
      <div className={`${displayFont.variable} ${bodyFont.variable} font-body`}>
      {children}
      </div>
      </OnbordaProvider>
    </NextIntlClientProvider>
  )
}
