import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { auth } from '@/auth'
import AppShell from './AppShell'
import { UserService } from '@/domain/services/UserService'
import { CreditsProvider } from '@/contexts/CreditsContext'
import { TenantProvider } from '@/contexts/TenantContext'
import { getAccountMode } from '@/domain/account/accountMode.server'
import { CreditService } from '@/domain/services/CreditService'
import { getTeamOnboardingState } from '@/domain/team/onboarding'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
import { OnbordaProvider } from '@/components/onboarding/OnbordaProvider'
import { getBrandByDomain } from '@/config/brand'
import { getTenant } from '@/config/tenant-server'

// Force dynamic rendering to ensure brand detection is fresh on each request
export const dynamic = 'force-dynamic'

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

  // OPTIMIZATION: Use consolidated UserService to fetch all user data in one call
  const userContext = session?.user?.id ? await UserService.getUserContext(session.user.id) : null

  // OPTIMIZATION: Preload credit balances to avoid separate API calls from CreditsContext
  const creditBalances = userContext && session?.user?.id ? await CreditService.getCreditBalanceSummary(session.user.id, userContext) : null

  // Get account mode using centralized utility (pass subscription to avoid duplicate query)
  const accountModeResult = await getAccountMode(session?.user?.id, userContext?.subscription)

  const teamOnboarding = await getTeamOnboardingState({
    isTeamAdmin: userContext?.roles.isTeamAdmin ?? false,
    teamId: userContext?.teamId ?? null,
    teamName: userContext?.person?.team?.name ?? null
  })

  // Note: Team setup redirect is handled by the dashboard page, not the layout
  // This avoids redirect loops since layouts don't have access to current pathname

  const initialRole = {
    isTeamAdmin: userContext?.roles.isTeamAdmin ?? false,
    isTeamMember: userContext?.roles.isTeamMember ?? false,
    needsTeamSetup: teamOnboarding.needsTeamSetup,
    needsPhotoStyleSetup: teamOnboarding.needsPhotoStyleSetup,
    needsTeamInvites: teamOnboarding.needsTeamInvites,
    nextTeamOnboardingStep: teamOnboarding.nextStep
  }

  const tenant = await getTenant()
  const brand = getBrandByDomain(tenant.domain)
  const isIndividualDomain = !tenant.hasTeamFeatures

  // OPTIMIZATION: Serialize subscription for client-side (convert Date objects to ISO strings)
  // Pass subscription to Sidebar to avoid redundant API calls
  const initialSubscription = userContext?.subscription ? {
    ...userContext.subscription,
    nextRenewal: userContext.subscription.nextRenewal ? userContext.subscription.nextRenewal.toISOString() : null,
    nextChange: userContext.subscription.nextChange ? {
      ...userContext.subscription.nextChange,
      effectiveDate: userContext.subscription.nextChange.effectiveDate.toISOString()
    } : null
  } : null

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <TenantProvider tenantId={tenant.id} brandName={brand.name} hasTeamFeatures={tenant.hasTeamFeatures}>
        <CreditsProvider initialCredits={creditBalances ? { individual: creditBalances.individual, team: creditBalances.team, person: creditBalances.person } : undefined}>
          <OnboardingProvider>
            <OnbordaProvider>
              <AppShell
                initialAccountMode={accountModeResult.mode}
                initialRole={initialRole}
                initialSubscription={initialSubscription}
                initialBrandName={brand.name}
                initialBrandLogoLight={brand.logo.light}
                initialBrandLogoIcon={brand.logo.icon}
                tenantId={tenant.id}
                isIndividualDomain={isIndividualDomain}
                brandColors={brand.colors}
              >
                {children}
              </AppShell>
            </OnbordaProvider>
          </OnboardingProvider>
        </CreditsProvider>
      </TenantProvider>
    </NextIntlClientProvider>
  )
}
