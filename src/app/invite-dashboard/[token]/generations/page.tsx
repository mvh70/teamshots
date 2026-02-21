'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PhotoIcon } from '@heroicons/react/24/outline'
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
import { BRAND_CONFIG } from '@/config/brand'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'

export default function GenerationsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('inviteDashboard')
  const token = params.token as string
  const { generations, loading, error } = useInvitedGenerations(token)
  const { startTour } = useOnbordaTours()
  const { context: onboardingContext } = useOnboardingState()
  
  // Hooks for generation flow navigation
  const { clearFlow } = useGenerationFlowState()
  const { selectedIds } = useSelfieSelection({ token })
  
  // Filter state
  const [timeframe, setTimeframe] = useState<'all'|'7d'|'30d'>('all')
  const [context, setContext] = useState('all')
  
  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  
  // Check for forceTour URL parameter
  const forceTour = searchParams?.get('forceTour') === 'true'
  
  // Get unique style options from generations
  const styleOptions = Array.from(new Set(generations.map(g => g.contextName).filter(Boolean))) as string[]

  // Navigation helper: determine initial step when starting the flow
  const handleStartFlow = useCallback(() => {
    // Clear any existing flow flags
    clearFlow()

    // Check if user has enough selfies to skip selfie upload flow
    if (selectedIds.length >= MIN_SELFIES_REQUIRED) {
      // User has enough selfies, skip directly to customization-intro
      router.push(`/invite-dashboard/${token}/customization-intro`)
    } else {
      // Not enough selfies, redirect to selfie-tips intro page
      router.push(`/invite-dashboard/${token}/selfie-tips`)
    }
  }, [clearFlow, router, token, selectedIds.length])
  
  // Filter generations based on selected filters
  const filteredGenerations = generations.filter(gen => {
    if (timeframe !== 'all') {
      const genDate = new Date(gen.createdAt)
      const now = new Date()
      const daysDiff = Math.floor((now.getTime() - genDate.getTime()) / (1000 * 60 * 60 * 24))
      if (timeframe === '7d' && daysDiff > 7) return false
      if (timeframe === '30d' && daysDiff > 30) return false
    }
    if (context !== 'all' && gen.contextName !== context) return false
    return true
  })

  useGenerationDetailTourTrigger({
    loading,
    generations,
    onboardingLoaded: !!onboardingContext._loaded,
    completedTours: onboardingContext.completedTours,
    force: forceTour,
    startTour,
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading generations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <OnboardingLauncher />
      {/* Header */}
      <InviteDashboardHeader showBackToDashboard token={token} title="" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorBanner message={error} className="mb-6" />}

        <div className="space-y-6">
          {generations.length > 0 && (
            <>
              {/* Filters and Generate Button Row */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as 'all'|'7d'|'30d')} className="border rounded-md px-2 py-1 text-sm">
                    <option value="all">All time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                  </select>
                  {styleOptions.length > 0 && (
                    <select value={context} onChange={(e) => setContext(e.target.value)} className="border rounded-md px-2 py-1 text-sm">
                      <option value="all">All photo styles</option>
                      {styleOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Prominent Generate Button with Cost Info */}
                <div className="flex flex-col items-end md:items-center gap-2 w-full md:w-auto">
                  <button 
                    onClick={handleStartFlow}
                    className="px-6 py-3 md:px-8 md:py-4 lg:px-10 lg:py-5 rounded-lg font-semibold text-base md:text-lg lg:text-xl shadow-sm transition-all hover:shadow-md flex items-center gap-2 whitespace-nowrap"
                    style={{
                      backgroundColor: BRAND_CONFIG.colors.primary,
                      color: 'white'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primaryHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primary
                    }}
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
                    {t('newGeneration')}
                  </button>
                  
                  {/* Cost information */}
                  <div className="text-xs md:text-sm text-gray-600 text-right md:text-center space-y-0.5">
                    <div>
                      <span className="font-medium" style={{ color: BRAND_CONFIG.colors.primary }}>
                        {calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration)} {calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration) === 1 ? 'photo' : 'photos'}
                      </span>
                      <span> per generation</span>
                    </div>
                  </div>
                </div>
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
                  <p className="text-gray-500">No generations match your filters.</p>
                </div>
              )}
            </>
          )}

          {generations.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="text-center py-12">
                <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-base md:text-lg font-semibold text-gray-900">No generations yet</h3>
                <p className="mt-1 text-sm text-gray-500">Upload a selfie and generate your first team photos.</p>
                <div className="mt-6">
                  <button
                    onClick={handleStartFlow}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg text-white bg-brand-primary hover:bg-brand-primary-hover shadow-md"
                  >
                    Generate Photos
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
