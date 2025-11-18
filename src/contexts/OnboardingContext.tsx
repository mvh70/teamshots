'use client'

import { createContext, useContext, ReactNode, useMemo } from 'react'
import { OnboardingContext as OnboardingContextType } from '@/lib/onborda/config'
import { useOnboardingState as useOnboardingStateHook } from '@/lib/onborda/hooks'

interface OnboardingContextValue {
  context: OnboardingContextType
  updateContext: (updates: Partial<OnboardingContextType>) => void
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { context, updateContext } = useOnboardingStateHook()
  
  // Memoize the context value to prevent unnecessary re-renders
  // Only recreate if context or updateContext reference changes
  const contextValue = useMemo(() => ({
    context,
    updateContext
  }), [context, updateContext])

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

