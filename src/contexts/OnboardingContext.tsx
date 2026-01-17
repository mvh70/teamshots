'use client'

import { createContext, useContext, ReactNode, useMemo, useState, useCallback } from 'react'
import { OnboardingContext as OnboardingContextType } from '@/lib/onborda/config'
import { useOnboardingState as useOnboardingStateHook } from '@/lib/onborda/hooks'

interface OnboardingContextValue {
  context: OnboardingContextType
  updateContext: (updates: Partial<OnboardingContextType>) => void
  pendingTour: string | null
  setPendingTour: (tour: string | null) => void
  clearPendingTour: () => void
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { context, updateContext } = useOnboardingStateHook()
  const [pendingTour, setPendingTourState] = useState<string | null>(null)
  
  // Stable callbacks - never change after mount
  const setPendingTour = useCallback((tour: string | null) => {
    setPendingTourState(tour)
  }, [])

  const clearPendingTour = useCallback(() => {
    setPendingTourState(null)
  }, [])

  // Memoize the context value to prevent unnecessary re-renders
  // Only include values that actually change - callbacks are stable
  const contextValue = useMemo(() => ({
    context,
    updateContext,
    pendingTour,
    setPendingTour,
    clearPendingTour
  }), [context, updateContext, pendingTour]) // eslint-disable-line react-hooks/exhaustive-deps -- setPendingTour and clearPendingTour are stable

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboardingState() {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error('useOnboardingState must be used within an OnboardingProvider')
  }
  return context
}

