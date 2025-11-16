'use client'

import { useEffect } from 'react'
import { useOnbordaTours } from '@/lib/onborda/hooks'

export function OnboardingLauncher() {
  const { pendingTour, clearPendingTour } = useOnbordaTours()

  useEffect(() => {
    // ALL TOURS DEACTIVATED - Clear any pending tours to prevent them from starting
    const sessionPendingTour = sessionStorage.getItem('pending-tour')
    if (sessionPendingTour) {
      sessionStorage.removeItem('pending-tour')
    }
    if (pendingTour) {
      clearPendingTour()
    }
    
    // Return early - no tours will be started
    return undefined
  }, [pendingTour, clearPendingTour])

  return null
}
