'use client'

import { useEffect } from 'react'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { usePathname } from 'next/navigation'

export function OnboardingLauncher() {
  const { pendingTour, clearPendingTour, startTour } = useOnbordaTours()
  const { context: onboardingContext } = useOnboardingState()
  const pathname = usePathname()

  useEffect(() => {
    // Check for database-based pending tours and trigger them
    const databasePendingTours = onboardingContext.pendingTours || []

    if (databasePendingTours.length > 0) {
      // Check if we're in an invite flow (invite-dashboard path)
      const isInviteFlow = pathname?.includes('/invite-dashboard')

      // Handle generation-detail tour for invite flows
      if (databasePendingTours.includes('generation-detail') && isInviteFlow) {
        // Let the generations page handle this tour
        return
      }

      // Start the first pending tour (we can extend this logic later for multiple tours)
      const tourToStart = databasePendingTours[0]

      // Start the tour after a brief delay
      setTimeout(() => {
        startTour(tourToStart)

        // Remove from pending tours in database after starting
        if (onboardingContext.personId) {
          fetch('/api/onboarding/pending-tour', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tourName: tourToStart }),
          }).catch(error => {
            console.error('Failed to remove pending tour from database:', error)
          })
        }
      }, 1000)
    }

    // Clear legacy pendingTour state if it exists (no longer used)
    if (pendingTour) {
      clearPendingTour()
    }
  }, [onboardingContext.pendingTours, onboardingContext.personId, pendingTour, clearPendingTour, startTour, pathname])

  return null
}
