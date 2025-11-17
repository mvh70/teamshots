'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { PhotoIcon } from '@heroicons/react/24/outline'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import GenerationCard from '@/app/[locale]/app/generations/components/GenerationCard'
import { useInvitedGenerations } from './useInvitedGenerations'
import { GenerationGrid, ErrorBanner } from '@/components/ui'
import { OnboardingLauncher } from '@/components/onboarding/OnboardingLauncher'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { useOnborda } from 'onborda'

export default function GenerationsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = params.token as string
  const { generations, loading, error } = useInvitedGenerations(token)
  const { startTour, pendingTour } = useOnbordaTours()
  const onborda = useOnborda()
  const hasCheckedTourRef = useRef(false)
  
  // Check for forceTour URL parameter
  const forceTour = searchParams?.get('forceTour') === 'true'

  // Trigger generation-detail tour after first generation is completed (only once per page load)
  useEffect(() => {
    // Skip if we've already checked or still loading
    if (loading || hasCheckedTourRef.current) {
      return
    }
    
    if (generations.length > 0) {
      // Mark that we've checked to prevent re-running
      hasCheckedTourRef.current = true
      
      // Check if tour has been completed (persists across sessions via localStorage)
      // Uses same key format as completeTour function: 'onboarding-{tourName}-seen'
      const hasSeenTour = localStorage.getItem('onboarding-generation-detail-seen')
      const isFirstGeneration = generations.length === 1
      
      console.log('[Tour Debug] Checking tour conditions (once per page load):', {
        loading,
        generationsCount: generations.length,
        isFirstGeneration,
        hasSeenTour,
        forceTour,
        pendingTour: sessionStorage.getItem('pending-tour')
      })
      
      // If forceTour is true, always start the tour (ignore seen flag)
      if (forceTour) {
        // Clear the seen flag to allow tour to start
        localStorage.removeItem('onboarding-generation-detail-seen')
        sessionStorage.removeItem('pending-tour')
        console.log('[Tour Debug] Starting tour (forced via URL parameter)')
        // Start the tour after a delay to ensure DOM is ready
        setTimeout(() => {
          startTour('generation-detail')
        }, 1500)
        return
      }
      
      // Normal flow: only trigger for first generation and if tour hasn't been seen
      if (isFirstGeneration && !hasSeenTour) {
        // Check if there's a pending tour from generation completion
        const sessionPendingTour = sessionStorage.getItem('pending-tour')
        if (sessionPendingTour === 'generation-detail') {
          // Clear the pending tour flag
          sessionStorage.removeItem('pending-tour')
          console.log('[Tour Debug] Starting tour from pending flag (first generation)')
          // Start the tour after a delay to ensure DOM is ready
          setTimeout(() => {
            startTour('generation-detail')
          }, 1500)
        } else {
          // If tour hasn't been seen and this is the first generation, start the tour
          // This handles cases where user navigates directly to generations page after first generation
          console.log('[Tour Debug] Starting tour for first generation (no pending flag)')
          setTimeout(() => {
            startTour('generation-detail')
          }, 1500)
        }
      } else {
        if (!isFirstGeneration) {
          console.log('[Tour Debug] Tour skipped - not first generation', { generationsCount: generations.length })
        } else {
          console.log('[Tour Debug] Tour already seen, skipping')
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, generations.length, forceTour]) // Removed startTour from dependencies to prevent re-runs

  // Directly start Onborda tour when pendingTour is set
  useEffect(() => {
    if (pendingTour === 'generation-detail' && onborda?.startOnborda && !onborda.isOnbordaVisible) {
      // Check localStorage before starting (defense in depth)
      const hasCompleted = localStorage.getItem('onboarding-generation-detail-seen') === 'true'
      if (hasCompleted) {
        console.log('[Tour Debug] GenerationsPage: Tour already completed, skipping direct start', { pendingTour })
        return
      }
      console.log('[Tour Debug] GenerationsPage: Starting Onborda tour directly', { pendingTour })
      setTimeout(() => {
        // Check again before starting
        const stillCompleted = localStorage.getItem('onboarding-generation-detail-seen') === 'true'
        if (stillCompleted) {
          console.log('[Tour Debug] GenerationsPage: Tour was completed during timeout, cancelling direct start')
          return
        }
        onborda.startOnborda('generation-detail')
      }, 2000)
    }
  }, [pendingTour, onborda])

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
          {generations.length > 0 ? (
            <GenerationGrid>
              {generations.map((generation) => (
                <GenerationCard
                  key={generation.id}
                  item={generation}
                  token={token}
                />
              ))}
            </GenerationGrid>
          ) : (
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
        </div>
      </div>
    </div>
  )
}
