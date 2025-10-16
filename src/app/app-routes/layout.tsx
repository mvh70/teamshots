import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import AppShell from './AppShell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={messages}>
      <AppShell>{children}</AppShell>
    </NextIntlClientProvider>
  )
}