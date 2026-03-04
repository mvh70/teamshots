'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PhotoIcon } from '@heroicons/react/24/outline'
import FlowPageSkeleton from '@/components/generation/loading/FlowPageSkeleton'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import SignUpCTA from '@/components/invite/SignUpCTA'
import GenerationCard from '@/app/[locale]/(product)/app/generations/components/GenerationCard'
import { useInvitedGenerations } from './useInvitedGenerations'
import { ErrorBanner } from '@/components/ui'
import { Lightbox } from '@/components/generations'
import { OnboardingLauncher } from '@/components/onboarding/OnboardingLauncher'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { useGenerationDetailTourTrigger } from '@/lib/onborda/useGenerationDetailTourTrigger'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { normalizeGenerationContextName, useGenerationFilters } from '@/hooks/useGenerationFilters'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useInviteStats } from '@/hooks/useInviteStats'
import { useInviteFlowNavigation } from '@/hooks/useInviteFlowNavigation'
import type { InviteDashboardStats } from '@/types/invite'

type InviteCreditStats = Pick<InviteDashboardStats, 'creditsRemaining' | 'teamName'>

export default function GenerationsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const t = useTranslations('inviteDashboard')
  const token = params.token as string
  const navigation = useInviteFlowNavigation(token)
  const { generations, loading, error } = useInvitedGenerations(token)
  const { stats } = useInviteStats<InviteCreditStats>(token, {
    initialStats: { creditsRemaining: 0, teamName: '' },
  })
  const { startTour } = useOnbordaTours()
  const { context: onboardingContext } = useOnboardingState()
  
  // Hooks for generation flow navigation
  const { clearFlow } = useGenerationFlowState({ flowScope: token })
  const { selectedIds } = useSelfieSelection({ token })
  
  const { timeframe, context, setTimeframe, setContext, filterGenerated } = useGenerationFilters()
  
  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  
  // Check for forceTour URL parameter
  const forceTour = searchParams?.get('forceTour') === 'true'
  
  // Get unique style options from generations
  const styleOptions = Array.from(
    new Set(generations.map((generation) => normalizeGenerationContextName(generation.contextName)))
  )

  // Navigation helper: determine initial step when starting the flow
  const handleStartFlow = useCallback(() => {
    if (stats.creditsRemaining < PRICING_CONFIG.credits.perGeneration) {
      return
    }

    // Clear any existing flow flags
    clearFlow()
    navigation.startFlow(selectedIds)
  }, [clearFlow, navigation, selectedIds, stats.creditsRemaining])
  
  // Filter generations based on selected filters
  const filteredGenerations = filterGenerated(generations)
  const hasEnoughCredits = stats.creditsRemaining >= PRICING_CONFIG.credits.perGeneration

  useGenerationDetailTourTrigger({
    loading,
    generations,
    onboardingLoaded: !!onboardingContext._loaded,
    completedTours: onboardingContext.completedTours,
    force: forceTour,
    startTour,
  })

  if (loading) {
    return <FlowPageSkeleton variant="centered-spinner" loadingLabel={t('loadingGenerations')} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <OnboardingLauncher />
      {/* Header */}
      <InviteDashboardHeader
        showBackToDashboard
        token={token}
        hideTitle
        teamName={stats.teamName}
        creditsRemaining={stats.creditsRemaining}
        photosAffordable={calculatePhotosFromCredits(stats.creditsRemaining)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorBanner message={error} className="mb-6" />}

        <div className="space-y-6">
          {generations.length > 0 && (
            <>
              {/* Page title + Filters and Generate Button Row */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg md:text-2xl font-semibold text-gray-900">{t('yourGenerations')}</h2>
                </div>

                {/* Prominent Generate Button with Cost Info */}
                <div className="flex flex-col items-end md:items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={handleStartFlow}
                    disabled={!hasEnoughCredits}
                    title={!hasEnoughCredits ? t('insufficientCredits.messageGeneric') : undefined}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-brand-primary-hover hover:shadow-md md:px-8 md:py-4 md:text-lg disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400 disabled:shadow-none"
                  >
                    <svg
                      className="w-5 h-5 md:w-6 md:h-6"
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
                    {t('newGeneration')}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                  <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as 'all'|'7d'|'30d')} className="border rounded-md px-2 py-1 text-sm">
                    <option value="all">{t('allTime')}</option>
                    <option value="7d">{t('last7Days')}</option>
                    <option value="30d">{t('last30Days')}</option>
                  </select>
                  {styleOptions.length > 0 && (
                    <select value={context} onChange={(e) => setContext(e.target.value)} className="border rounded-md px-2 py-1 text-sm">
                      <option value="all">{t('allPhotoStyles')}</option>
                      {styleOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  )}
                </div>

            {/* Image grid with lightbox support */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredGenerations.map((generation) => (
                  <GenerationCard
                    key={generation.id}
                    item={generation}
                    token={token}
                    onImageClick={(src) => setLightboxImage(src)}
                  />
                ))}
              </div>
              
              {filteredGenerations.length === 0 && generations.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-12 text-center">
                  <p className="text-gray-500">{t('noMatchingGenerations')}</p>
                </div>
              )}
            </>
          )}

          {generations.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="text-center py-12">
                <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-base md:text-lg font-semibold text-gray-900">{t('noGenerationsYet')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('noGenerationsYetDescription')}</p>
                <div className="mt-6">
                  <button
                    onClick={handleStartFlow}
                    disabled={!hasEnoughCredits}
                    title={!hasEnoughCredits ? t('insufficientCredits.messageGeneric') : undefined}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg text-white bg-brand-primary hover:bg-brand-primary-hover shadow-md disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400"
                  >
                    {t('generatePhotos')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <SignUpCTA />
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <Lightbox 
          src={lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />
      )}
    </div>
  )
}
