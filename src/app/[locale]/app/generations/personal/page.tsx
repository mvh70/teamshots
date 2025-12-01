'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import GenerationCard from '../components/GenerationCard'
import { useGenerations, useGenerationFilters } from '../hooks/useGenerations'
import { useSession } from 'next-auth/react'
import { useCredits } from '@/contexts/CreditsContext'
import { BRAND_CONFIG } from '@/config/brand'
import { useBuyCreditsLink } from '@/hooks/useBuyCreditsLink'
import { PRICING_CONFIG, type PricingTier } from '@/config/pricing'
import { calculatePhotosFromCredits, getRegenerationCount } from '@/domain/pricing'
import { Toast, GenerationGrid } from '@/components/ui'
import { fetchAccountMode } from '@/domain/account/accountMode'
import { UpgradePrompt } from '@/components/generations/UpgradePrompt'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { useOnbordaTours } from '@/lib/onborda/hooks'

export default function PersonalGenerationsPage() {
  const tg = useTranslations('generations.personal')
  const t = useTranslations('app.sidebar.generate')
  const toastMessages = useTranslations('generations.toasts')
  const { data: session } = useSession()
  const { credits: userCredits, loading: creditsLoading, refetch: refetchCredits } = useCredits()
  const currentUserId = session?.user?.id
  const currentUserName = session?.user?.name || ''
  const [failureToast, setFailureToast] = useState<string | null>(null)
  const [subscriptionTier, setSubscriptionTier] = useState<PricingTier | null>(null)
  const { timeframe, context, setTimeframe, setContext, filterGenerated } = useGenerationFilters()
  const { context: onboardingContext } = useOnboardingState()
  const { startTour } = useOnbordaTours()
  const processedCompletedGenIdsRef = useRef<Set<string>>(new Set())
  const tourTriggerAttemptedRef = useRef(false)
  const { href: buyCreditsHref } = useBuyCreditsLink()
  // Team functionality lives on the team page. Pro accounts and invited team members should not access personal generations.
  useEffect(() => {
    let cancelled = false

    const enforcePersonalAccess = async () => {
      const userId = session?.user?.id
      const userRole = session?.user?.role
      const userTeamId = session?.user?.person?.teamId

      if (!userId) {
        return
      }

      try {
        const accountMode = await fetchAccountMode()
        if (cancelled) return

        // Store subscription tier for regeneration count
        setSubscriptionTier(accountMode.subscriptionTier as PricingTier | null)

        if (accountMode.mode === 'pro') {
          window.location.href = '/app/generations/team'
          return
        }
      } catch (error) {
        console.warn('Failed to resolve account mode for personal generations', error)
        try {
          const response = await fetch('/api/dashboard/stats')
          if (!cancelled && response.ok) {
            const data = await response.json()
            if (data.userRole?.isTeamAdmin || data.userRole?.isTeamMember) {
              window.location.href = '/app/generations/team'
              return
            }
          }
        } catch (fallbackError) {
          console.warn('Failed to validate team role for personal generations', fallbackError)
        }
      }

      // Invited members should stay on the team experience even if the account mode lookup reports individual.
      if (!cancelled && userRole === 'team_member' && userTeamId) {
        window.location.href = '/app/generations/team'
      }
    }

    void enforcePersonalAccess()

    return () => {
      cancelled = true
    }
  }, [session?.user?.id, session?.user?.role, session?.user?.person?.teamId])
  const handleGenerationFailed = useCallback(
    ({ errorMessage }: { id: string; errorMessage?: string }) => {
      if (errorMessage) {
        console.warn('Generation failed', errorMessage)
      }
      setFailureToast(toastMessages('generationFailed'))
      void refetchCredits()
    },
    [toastMessages, refetchCredits]
  )

  const { generated, pagination, loading, loadMore } = useGenerations(
    currentUserId,
    false, // isTeamAdmin - not needed for personal
    currentUserName,
    undefined, // currentPersonId - not needed for personal
    'personal', // scope
    undefined, // teamView - not needed for personal
    'all', // selectedUserId - not needed for personal
    handleGenerationFailed
  )

  // Trigger generation-detail tour after first completed generation
  useEffect(() => {
    // Skip if still loading or onboarding context not loaded
    if (loading || !onboardingContext._loaded) {
      return
    }
    
    // Only check for completed generations (status === 'completed')
    const completedGenerations = generated.filter(g => g.status === 'completed')
    
    // If there are no completed generations, nothing to do
    if (completedGenerations.length === 0) {
      return
    }
    
    // Check if tour has been completed using database (onboarding context)
    const hasSeenTour = onboardingContext.personId
      ? onboardingContext.completedTours?.includes('generation-detail')
      : false

    const isPendingTour = onboardingContext.personId
      ? onboardingContext.pendingTours?.includes('generation-detail')
      : false

    // If tour has already been seen, nothing to do
    if (hasSeenTour) {
      return
    }

    // If we've already attempted to trigger the tour, don't do it again
    if (tourTriggerAttemptedRef.current) {
      return
    }

    // Find newly completed generations that we haven't processed yet
    const newCompletedGenerations = completedGenerations.filter(
      g => !processedCompletedGenIdsRef.current.has(g.id)
    )
    
    // If there are new completed generations, mark them as processed
    if (newCompletedGenerations.length > 0) {
      newCompletedGenerations.forEach(g => {
        processedCompletedGenIdsRef.current.add(g.id)
      })
    }

    // Trigger tour if it's pending or if this is the first time we see completed generations
    if (isPendingTour) {
      // Tour is already pending, just start it
      tourTriggerAttemptedRef.current = true
      setTimeout(() => {
        startTour('generation-detail')
      }, 1500)
    } else if (completedGenerations.length > 0) {
      // Set the tour as pending if there are completed generations and tour hasn't been seen
      tourTriggerAttemptedRef.current = true
      if (onboardingContext.personId) {
        fetch('/api/onboarding/pending-tour', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tourName: 'generation-detail' }),
        }).then(() => {
          // Start the tour after setting it as pending
          setTimeout(() => {
            startTour('generation-detail')
          }, 1500)
        }).catch(error => {
          console.error('[Tour Debug] Failed to set pending tour:', error)
        })
      } else {
        // If no personId, still try to start the tour
        setTimeout(() => {
          startTour('generation-detail')
        }, 1500)
      }
    }
  }, [loading, generated, onboardingContext._loaded, onboardingContext.completedTours, onboardingContext.pendingTours, onboardingContext.personId, startTour])

  useEffect(() => {
    if (!failureToast) return

    const timer = window.setTimeout(() => setFailureToast(null), 6000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [failureToast])

  const filteredGenerated = filterGenerated(generated)
  // Build photo style options dynamically from existing generations
  const styleOptions = Array.from(new Set(
    generated.map(g => g.contextName || 'Freestyle')
  ))

  // Check if user has individual credits
  const hasIndividualCredits = userCredits.individual > 0

  // Show upsell window only if no individual credits AND no existing generations
  if (!creditsLoading && !hasIndividualCredits && filteredGenerated.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('noCreditsTitle')}</h1>
            <p className="text-gray-600 mb-6">{t('noCreditsMessage')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={buyCreditsHref}
                className="px-6 py-3 rounded-md text-white font-medium transition-colors"
                style={{ backgroundColor: BRAND_CONFIG.colors.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primaryHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primary
                }}
              >
                {t('buyCredits')}
              </Link>
              <Link
                href="/app/dashboard"
                className="px-6 py-3 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                {t('backToDashboard')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{tg('title')}</h1>
        <p className="text-gray-600">Manage and view your generated professional photos</p>
      </div>

      {/* Filters and Generate Button Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Filters - Enhanced Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 overflow-x-auto pb-2 -mb-2 sm:pb-0 sm:mb-0">
          {/* Timeframe filter - Enhanced dropdown */}
          <div className="relative">
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value as 'all'|'7d'|'30d')} 
              className="appearance-none bg-white border-2 border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all duration-200 shadow-sm hover:shadow-md min-w-[140px]"
            >
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {/* Style filter - Enhanced dropdown */}
          {styleOptions.length > 0 && (
            <div className="relative">
              <select 
                value={context} 
                onChange={(e) => setContext(e.target.value)} 
                className="appearance-none bg-white border-2 border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all duration-200 shadow-sm hover:shadow-md min-w-[160px]"
              >
                <option value="all">All photo styles</option>
                {styleOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Prominent Generate Button with Cost Info */}
        <div className="flex flex-col items-stretch sm:items-end md:items-center gap-3 w-full sm:w-auto">
          <Link 
            href="/app/generate/start?type=personal" 
            className="px-6 py-3 md:px-8 md:py-4 lg:px-10 lg:py-5 rounded-xl font-bold text-base md:text-lg lg:text-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 whitespace-nowrap bg-gradient-to-r from-brand-primary to-brand-primary-hover text-white touch-manipulation"
          >
            <svg 
              className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2.5} 
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            New generation
          </Link>
          
          {/* Cost information - Enhanced card style */}
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5 shadow-sm text-xs md:text-sm text-gray-600 text-right md:text-center">
            <div className="space-y-1">
              <div>
                <span className="font-semibold" style={{ color: BRAND_CONFIG.colors.primary }}>
                  {calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration)} {calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration) === 1 ? t('photoCredit') : t('photoCredits')}
                </span>
                <span className="text-gray-500"> {t('perPhoto')}</span>
              </div>
              <div className="text-gray-500">
                {subscriptionTier ? getRegenerationCount(subscriptionTier) : 3} {t('retriesPerPhoto')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredGenerated.length ? (
          <>
            <GenerationGrid>
              {filteredGenerated.map(item => (
                <GenerationCard key={item.id} item={item} />
              ))}
            </GenerationGrid>

            {/* Upgrade Prompt */}
            {filteredGenerated.length > 0 && (
              <UpgradePrompt className="mt-8" />
            )}

            {/* Load More Button */}
            {pagination?.hasNextPage && (
              <div className="text-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : `Load More (${pagination.totalCount - filteredGenerated.length} remaining)`}
                </button>
              </div>
            )}
            
            {/* Pagination Info */}
            {pagination && (
              <div className="text-center text-sm text-gray-600 mt-4">
                Showing {filteredGenerated.length} of {pagination.totalCount} generations
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 px-6 bg-gradient-to-br from-white via-gray-50/50 to-white rounded-xl border-2 border-gray-200/50 shadow-sm">
            {/* Illustration/Icon */}
            <div className="mx-auto mb-6 w-24 h-24 rounded-full bg-gradient-to-br from-brand-primary/10 via-brand-primary/5 to-transparent flex items-center justify-center">
              <svg 
                className="w-12 h-12 text-brand-primary/60" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={1.5}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" 
                />
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0l1.5-1.5m-1.5 1.5l-1.5-1.5m1.5 1.5v-3.375" 
                />
              </svg>
            </div>
            
            {/* Typography */}
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{tg('empty.title')}</h2>
            <p className="text-base text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">{tg('empty.subtitle')}</p>
            
            {/* CTA Button */}
            <Link 
              href="/app/generate/start?type=personal"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-primary text-white font-semibold text-base hover:bg-brand-primary-hover shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={2.5} 
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              New generation
            </Link>
          </div>
        )}
      {failureToast && (
        <Toast
          message={failureToast}
          type="error"
          onDismiss={() => setFailureToast(null)}
        />
      )}
    </div>
  )
}
