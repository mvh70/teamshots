import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

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
      {children}
    </NextIntlClientProvider>
  )
}
