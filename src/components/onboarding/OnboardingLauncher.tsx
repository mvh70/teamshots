'use client'

import { useEffect, useRef } from 'react'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { usePathname } from 'next/navigation'

export function OnboardingLauncher() {
  const { pendingTour, clearPendingTour, startTour } = useOnbordaTours()
  const { context: onboardingContext, updateContext } = useOnboardingState()
  const pathname = usePathname()
  const processingToursRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Check for database-based pending tours and trigger them
    const databasePendingTours = onboardingContext.pendingTours || []

    if (databasePendingTours.length > 0) {
      // Check if we're in an invite flow (invite-dashboard path)
      const isInviteFlow = pathname?.includes('/invite-dashboard')

      // Check if we're on a generations page (main app flow)
      const isGenerationsPage = pathname?.includes('/app/generations/team') || pathname?.includes('/app/generations/personal')

      // Handle generation-detail tour for invite flows and main app generations pages
      if (databasePendingTours.includes('generation-detail') && (isInviteFlow || isGenerationsPage)) {
        // Let the generations page handle this tour
        return
      }

      // Start the first pending tour that isn't currently being processed
      const tourToStart = databasePendingTours.find(tour => !processingToursRef.current.has(tour))
      if (!tourToStart) {
        return
      }
      processingToursRef.current.add(tourToStart)

      // Start the tour immediately
      startTour(tourToStart)
      const removeTourLocally = () => {
        const remainingTours = databasePendingTours.filter(tour => tour !== tourToStart)
        updateContext({ pendingTours: remainingTours })
      }
      removeTourLocally()

      // Remove from pending tours in database after starting
      if (onboardingContext.personId) {
        fetch(`/api/onboarding/pending-tour?tourName=${encodeURIComponent(tourToStart)}`, {
          method: 'DELETE',
        })
          .catch(error => {
            console.error('Failed to remove pending tour from database:', error)
          })
          .finally(() => {
            processingToursRef.current.delete(tourToStart)
          })
      } else {
        processingToursRef.current.delete(tourToStart)
      }
    }

    // Clear legacy pendingTour state if it exists (no longer used)
    if (pendingTour) {
      clearPendingTour()
    }
  }, [onboardingContext.pendingTours, onboardingContext.personId, pendingTour, clearPendingTour, startTour, pathname, updateContext])

  return null
}
