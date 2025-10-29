import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { auth } from '@/auth'
import AppShell from './AppShell'
import { getUserWithRoles, getUserEffectiveRoles } from '@/lib/roles'
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
  
  // Derive initial role/mode server-side to avoid client flicker
  const user = session?.user?.id ? await getUserWithRoles(session.user.id) : null
  const effective = user ? getUserEffectiveRoles(user) : null
  const initialAccountMode: 'individual' | 'company' = effective && (effective.isCompanyAdmin || effective.isCompanyMember)
    ? 'company'
    : 'individual'
  const initialRole = effective ? {
    isCompanyAdmin: effective.isCompanyAdmin,
    isCompanyMember: effective.isCompanyMember,
    needsCompanySetup: effective.isCompanyAdmin && !user?.person?.companyId
  } : {
    isCompanyAdmin: false,
    isCompanyMember: false,
    needsCompanySetup: false
  }

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <CreditsProvider>
        <AppShell initialAccountMode={initialAccountMode} initialRole={initialRole}>{children}</AppShell>
      </CreditsProvider>
    </NextIntlClientProvider>
  )
}
