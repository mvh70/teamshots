'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PhotoIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import GenerationCard from '@/app/[locale]/(product)/app/generations/components/GenerationCard'
import { useInvitedGenerations } from './useInvitedGenerations'
import { GenerationGrid, ErrorBanner } from '@/components/ui'
import { OnboardingLauncher } from '@/components/onboarding/OnboardingLauncher'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { useOnborda } from 'onborda'
import { BRAND_CONFIG } from '@/config/brand'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'

export default function GenerationsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('inviteDashboard')
  const token = params.token as string
  const { generations, loading, error } = useInvitedGenerations(token)
  const { startTour, pendingTour } = useOnbordaTours()
  const { context: onboardingContext } = useOnboardingState()
  const onborda = useOnborda()
  const hasCheckedTourRef = useRef(false)
  const previousCompletedCountRef = useRef(0)
  const previousPendingTourRef = useRef(false)
  const imageLoadedRef = useRef(false)
  
  // Filter state
  const [timeframe, setTimeframe] = useState<'all'|'7d'|'30d'>('all')
  const [context, setContext] = useState('all')
  
  // Check for forceTour URL parameter
  const forceTour = searchParams?.get('forceTour') === 'true'
  
  // Get unique style options from generations
  const styleOptions = Array.from(new Set(generations.map(g => g.contextName).filter(Boolean))) as string[]
  
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

  // Listen for generation image load events
  useEffect(() => {
    const handleImageLoaded = () => {
      imageLoadedRef.current = true
    }

    window.addEventListener('generationImageLoaded', handleImageLoaded)
    return () => {
      window.removeEventListener('generationImageLoaded', handleImageLoaded)
    }
  }, [])

  // Trigger generation-detail tour after first generation is completed AND image is loaded (only once per page load)
  useEffect(() => {
    // Skip if still loading or onboarding context not loaded yet
    if (loading || !onboardingContext._loaded) {
      return
    }
    
    // Check if tour has been completed using database (onboarding context)
    const completedTours = onboardingContext.completedTours || []
    const pendingTours = onboardingContext.pendingTours || []
    
    // Check if tour is pending in database (works even without personId for invite flows)
    const isPendingTour = pendingTours.includes('generation-detail')
    
    // Check if tour has been completed
    // Check the completedTours array from the database (onboarding context)
    const hasSeenTour = completedTours.includes('generation-detail')
    
    // Only check for completed generations (status === 'completed')
    const completedGenerations = generations.filter(g => g.status === 'completed')

    // Wait for the image to be loaded before starting the tour
    if (completedGenerations.length > 0 && !imageLoadedRef.current) {
      return
    }

    // If tour has already been completed, don't start it (even if we haven't checked before)
    if (hasSeenTour && !forceTour && !isPendingTour) {
      hasCheckedTourRef.current = true
      return
    }
    
    // If there are no completed generations yet, don't proceed (but allow re-checking when they complete)
    if (completedGenerations.length === 0) {
      // Reset the check flag if we previously had completed generations but now don't (edge case)
      if (hasCheckedTourRef.current) {
        hasCheckedTourRef.current = false
      }
      return
    }
    
    // Skip if we've already checked and attempted to start the tour (unless context changed or new generation completed)
    // Always allow re-checking if tour is pending (it might have been set as pending after initial check)
    const hasNewCompletedGeneration = completedGenerations.length > previousCompletedCountRef.current
    const hasNewPendingTour = isPendingTour && !previousPendingTourRef.current
    
    // If we've already checked, only skip if:
    // - No new completed generations
    // - Tour is not pending (or was already pending before)
    // - Not forcing the tour
    if (hasCheckedTourRef.current && !hasNewCompletedGeneration && (!isPendingTour || previousPendingTourRef.current) && !forceTour) {
      return
    }
    
    // Update the refs
    previousPendingTourRef.current = isPendingTour
    
    // Update the completed count ref
    previousCompletedCountRef.current = completedGenerations.length
    
    // Mark that we've checked to prevent re-running (unless conditions change)
    hasCheckedTourRef.current = true

    // If forceTour is true, always start the tour (ignore seen flag)
    if (forceTour) {
      // Start the tour immediately
      startTour('generation-detail', true) // Force bypasses completion check
      return
    }

    // Priority 1: If tour is pending in database, start it (regardless of hasSeenTour - pending takes precedence)
    // This handles the case where the tour was set as pending after generation completed
    if (isPendingTour) {
      try {
        startTour('generation-detail', true) // Force bypasses completion check
      } catch (error) {
        console.error('[GenerationsPage Tour] Error calling startTour (pending):', error)
      }
      return
    }

    // Priority 2: If there are completed generations AND tour hasn't been seen, start the tour
    // Changed from checking for exactly 1 generation to checking for any completed generations
    // This ensures the tour starts even if there are multiple generations from previous tests
    if (completedGenerations.length > 0 && !hasSeenTour) {
      // For invite flows, also set the tour as pending in the database if personId exists
      if (onboardingContext.personId) {
        fetch('/api/onboarding/pending-tour', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tourName: 'generation-detail' }),
        }).catch(error => {
          console.error('[GenerationsPage Tour] Failed to set pending tour:', error)
        })
      }
      
      try {
        startTour('generation-detail', true) // Force bypasses completion check since we've already validated conditions
      } catch (error) {
        console.error('[GenerationsPage Tour] Error calling startTour:', error)
      }
    }
  }, [loading, generations, forceTour, onboardingContext._loaded, onboardingContext.completedTours, onboardingContext.pendingTours, onboardingContext.personId, startTour]) // Changed dependency from generations.length to generations to track status changes

  // Directly start Onborda tour when pendingTour is set
  useEffect(() => {
    if (pendingTour === 'generation-detail' && onborda?.startOnborda && !onborda.isOnbordaVisible) {
      // Check database completion status before starting (defense in depth)
      const hasCompleted = onboardingContext.personId
        ? onboardingContext.completedTours?.includes('generation-detail')
        : false
      if (hasCompleted) {
        return
      }
      setTimeout(() => {
        // Check again before starting (context might have updated)
        const stillCompleted = onboardingContext.personId
          ? onboardingContext.completedTours?.includes('generation-detail')
          : false
        if (stillCompleted) {
          return
        }
        onborda.startOnborda('generation-detail')
      }, 2000)
    }
  }, [pendingTour, onborda, onboardingContext.personId, onboardingContext.completedTours])

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
                  <Link 
                    href={`/invite-dashboard/${token}`}
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
                  </Link>
                  
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

            <GenerationGrid>
                {filteredGenerations.map((generation) => (
                <GenerationCard
                  key={generation.id}
                  item={generation}
                  token={token}
                />
              ))}
            </GenerationGrid>
              
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
                    onClick={() => router.push(`/invite-dashboard/${token}`)}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg text-white bg-brand-primary hover:bg-brand-primary-hover shadow-md"
                  >
                    Generate Photos
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sign up CTA - Hidden on mobile */}
          <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
              {t('signUpCta.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('signUpCta.description')}
            </p>
            <button
              onClick={() => window.location.href = 'https://www.photoshotspro.com'}
              className="px-4 py-2 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-cta-ring"
              style={{
                backgroundColor: BRAND_CONFIG.colors.cta,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.ctaHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.cta
              }}
            >
              {t('signUpCta.button')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
