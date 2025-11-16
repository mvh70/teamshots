'use client'

import { useEffect } from 'react'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { usePathname } from 'next/navigation'

export function OnboardingLauncher() {
  const { pendingTour, clearPendingTour } = useOnbordaTours()
  const pathname = usePathname()

  useEffect(() => {
    // Check if we're in an invite flow (invite-dashboard path)
    const isInviteFlow = pathname?.includes('/invite-dashboard')
    
    // Allow generation-detail tour in invite flows
    const sessionPendingTour = sessionStorage.getItem('pending-tour')
    if (sessionPendingTour === 'generation-detail' && isInviteFlow) {
      // Don't clear it - let the generations page handle it
      return
    }
    
    // Clear other pending tours or if not in invite flow
    if (sessionPendingTour) {
      sessionStorage.removeItem('pending-tour')
    }
    if (pendingTour) {
      clearPendingTour()
    }
    
    // Return early - no tours will be started here
    return undefined
  }, [pendingTour, clearPendingTour, pathname])

  return null
}
