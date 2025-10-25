import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { auth } from '@/auth'
import AppShell from './AppShell'
import { CreditsProvider } from '@/contexts/CreditsContext'

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const session = await auth()
  const resolvedParams = await params
  const { locale: urlLocale } = resolvedParams
  
  // Get locale from URL or session
  const locale = (urlLocale || session?.user?.locale || 'en') as 'en' | 'es'
  
  const messages = await getMessages({ locale })
  
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <CreditsProvider>
        <AppShell>{children}</AppShell>
      </CreditsProvider>
    </NextIntlClientProvider>
  )
}
