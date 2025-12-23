import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import AppShell from './AppShell'
import { UserService } from '@/domain/services/UserService'
import { CreditsProvider } from '@/contexts/CreditsContext'
import { DomainProvider } from '@/contexts/DomainContext'
import { getAccountMode } from '@/domain/account/accountMode.server'
import { CreditService } from '@/domain/services/CreditService'
import { getTeamOnboardingState } from '@/domain/team/onboarding'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
import { OnbordaProvider } from '@/components/onboarding/OnbordaProvider'
import { getBrand } from '@/config/brand'
import { getLandingVariant } from '@/config/landing-content'

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
    teamId: userContext?.teamId ?? null
  })

  const initialRole = {
    isTeamAdmin: userContext?.roles.isTeamAdmin ?? false,
    isTeamMember: userContext?.roles.isTeamMember ?? false,
    needsTeamSetup: teamOnboarding.needsTeamSetup,
    needsPhotoStyleSetup: teamOnboarding.needsPhotoStyleSetup,
    needsTeamInvites: teamOnboarding.needsTeamInvites,
    nextTeamOnboardingStep: teamOnboarding.nextStep
  }

  // Get brand config from server-side headers to avoid hydration mismatch
  const headersList = await headers()
  const brand = getBrand(headersList)
  
  // Determine if this is an individual-only domain (no team features)
  const host = headersList.get('host') || headersList.get('x-forwarded-host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  const variant = getLandingVariant(domain)
  const isIndividualDomain = variant === 'photoshotspro'

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
      <DomainProvider isIndividualDomain={isIndividualDomain}>
        <CreditsProvider initialCredits={creditBalances ? { individual: creditBalances.individual, team: creditBalances.team } : undefined}>
          <OnboardingProvider>
            <OnbordaProvider>
              <AppShell
                initialAccountMode={accountModeResult.mode}
                initialRole={initialRole}
                initialSubscription={initialSubscription}
                initialBrandName={brand.name}
                initialBrandLogoLight={brand.logo.light}
                initialBrandLogoIcon={brand.logo.icon}
                isIndividualDomain={isIndividualDomain}
              >
                {children}
              </AppShell>
            </OnbordaProvider>
          </OnboardingProvider>
        </CreditsProvider>
      </DomainProvider>
    </NextIntlClientProvider>
  )
}
