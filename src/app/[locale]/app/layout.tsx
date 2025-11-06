import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { auth } from '@/auth'
import AppShell from './AppShell'
import { getUserWithRoles, getUserEffectiveRoles } from '@/domain/access/roles'
import { CreditsProvider } from '@/contexts/CreditsContext'
import { getAccountMode } from '@/domain/account/accountMode'
import { getUserSubscription } from '@/domain/subscription/subscription'

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
  
  // OPTIMIZATION: Fetch subscription once and pass it to both functions to avoid duplicate queries
  const subscription = session?.user?.id ? await getUserSubscription(session.user.id) : null
  
  // Get account mode using centralized utility (pass subscription to avoid duplicate query)
  const accountModeResult = await getAccountMode(session?.user?.id, subscription)
  
  // Derive initial role server-side (pro users are team admins by definition)
  // Pass subscription to avoid duplicate query
  const user = session?.user?.id ? await getUserWithRoles(session.user.id) : null
  const effective = user ? await getUserEffectiveRoles(user, subscription) : null
  
  const initialRole = effective ? {
    isTeamAdmin: effective.isTeamAdmin,
    isTeamMember: effective.isTeamMember,
    needsTeamSetup: effective.isTeamAdmin && !user?.person?.teamId
  } : {
    isTeamAdmin: false,
    isTeamMember: false,
    needsTeamSetup: false
  }

  // OPTIMIZATION: Serialize subscription for client-side (convert Date objects to ISO strings)
  // Pass subscription to Sidebar to avoid redundant API calls
  const initialSubscription = subscription ? {
    ...subscription,
    nextRenewal: subscription.nextRenewal ? subscription.nextRenewal.toISOString() : null,
    nextChange: subscription.nextChange ? {
      ...subscription.nextChange,
      effectiveDate: subscription.nextChange.effectiveDate.toISOString()
    } : null
  } : null

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <CreditsProvider>
        <AppShell 
          initialAccountMode={accountModeResult.mode} 
          initialRole={initialRole}
          initialSubscription={initialSubscription}
        >
          {children}
        </AppShell>
      </CreditsProvider>
    </NextIntlClientProvider>
  )
}
