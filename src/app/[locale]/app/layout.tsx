import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { auth } from '@/auth'
import AppShell from './AppShell'
import { getUserWithRoles, getUserEffectiveRoles } from '@/domain/access/roles'
import { CreditsProvider } from '@/contexts/CreditsContext'
import { getAccountMode } from '@/domain/account/accountMode'

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
  
  // Get account mode using centralized utility
  const accountModeResult = await getAccountMode(session?.user?.id)
  
  // Derive initial role server-side (pro users are team admins by definition)
  const user = session?.user?.id ? await getUserWithRoles(session.user.id) : null
  const effective = user ? await getUserEffectiveRoles(user) : null
  
  const initialRole = effective ? {
    isTeamAdmin: effective.isTeamAdmin,
    isTeamMember: effective.isTeamMember,
    needsTeamSetup: effective.isTeamAdmin && !user?.person?.teamId
  } : {
    isTeamAdmin: false,
    isTeamMember: false,
    needsTeamSetup: false
  }

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <CreditsProvider>
        <AppShell 
          initialAccountMode={accountModeResult.mode} 
          initialRole={initialRole}
        >
          {children}
        </AppShell>
      </CreditsProvider>
    </NextIntlClientProvider>
  )
}
