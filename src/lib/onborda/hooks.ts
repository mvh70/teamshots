import { useEffect, useMemo, useState } from 'react'
import { useOnborda } from 'onborda'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/routing'
import { OnboardingContext, getApplicableTours, getTour } from './config'
import { trackTourStarted, trackTourCompleted, trackTourSkipped, trackStepViewed } from './analytics'

// Export the utility functions
export { getApplicableTours, getTour }

// Hook for managing onboarding state
export function useOnboardingState() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [context, setContext] = useState<OnboardingContext>({
    isTeamAdmin: false,
    isTeamMember: false,
    isRegularUser: true,
    hasUploadedSelfie: false,
    hasGeneratedPhotos: false,
    accountMode: 'individual',
    language: 'en',
    isFreePlan: true,
    onboardingSegment: 'individual', // Default segment
    _loaded: false, // Internal flag to track if context has been loaded from server
  })

  // Load onboarding context from localStorage and server
  // Also re-check when pathname changes to pick up updated sessionStorage data
  useEffect(() => {
    // Get data from localStorage (client-side persistence)
    const stored = localStorage.getItem('onboarding-context')
    const baseContext = stored ? JSON.parse(stored) : {}

    // Check if we're on a generations page - if so, always refresh context to get latest hasGeneratedPhotos
    const isGenerationsPage = pathname === '/app/generations/team' || pathname === '/app/generations/personal'
    
    // OPTIMIZATION: Check sessionStorage for initial data first (from /api/user/initial-data)
    // Do this synchronously to set context immediately
    // Re-check on pathname changes to pick up updates (e.g., after team creation)
    // BUT: Skip sessionStorage on generations pages to force fresh API fetch
    if (!isGenerationsPage) {
      try {
        const initialDataStr = sessionStorage.getItem('teamshots.initialData')
        if (initialDataStr) {
          const initialData = JSON.parse(initialDataStr)
          if (initialData.onboarding && initialData.user?.id) {
            // Determine onboarding segment based on user context
            const determineSegment = (roles: { isTeamAdmin?: boolean; isTeamMember?: boolean }): 'organizer' | 'individual' | 'invited' => {
              if (roles?.isTeamAdmin) return 'organizer'
              if (roles?.isTeamMember) return 'invited'
              return 'individual'
            }

            // Map initial data to onboarding context format and set immediately
            const serverContext: Partial<OnboardingContext> = {
              userId: initialData.user?.id,
              personId: initialData.person?.id,
              firstName: initialData.person?.firstName,
              isTeamAdmin: initialData.roles?.isTeamAdmin || false,
              isTeamMember: initialData.roles?.isTeamMember || false,
              isRegularUser: initialData.roles?.isRegularUser || false,
              teamId: initialData.roles?.teamId,
              teamName: initialData.roles?.teamName,
              hasUploadedSelfie: initialData.onboarding.hasUploadedSelfie || false,
              hasGeneratedPhotos: initialData.onboarding.hasGeneratedPhotos || false,
              accountMode: initialData.onboarding.accountMode || 'individual',
              language: initialData.onboarding.language || 'en',
              isFreePlan: initialData.onboarding.isFreePlan !== undefined ? initialData.onboarding.isFreePlan : true,
              onboardingSegment: determineSegment(initialData.roles),
              _loaded: true, // Mark as loaded immediately
            }

            // Sync completed tours from initial data to localStorage if available
            if (initialData.onboarding?.completedTours && Array.isArray(initialData.onboarding.completedTours)) {
              initialData.onboarding.completedTours.forEach((tourName: string) => {
                localStorage.setItem(`onboarding-${tourName}-seen`, 'true')
              })
            }
            
            const newContext = {
              ...baseContext,
              ...serverContext,
              userId: session?.user?.id || serverContext.userId,
              _loaded: true, // Ensure _loaded is always true when using sessionStorage
            }
            setContext(newContext)
            return // Exit early, don't fetch from API
          }
        }
      } catch {
        // Ignore parse errors, fall through to API call
      }
    }

    // Fetch from API (always on generations pages, or if no sessionStorage data)
    const loadOnboardingContext = async () => {
      try {
        const response = await fetch('/api/onboarding/context')
        if (response.ok) {
          const serverContext = await response.json()

          // Determine onboarding segment based on server response
          const determineSegment = (ctx: { isTeamAdmin?: boolean; isTeamMember?: boolean }): 'organizer' | 'individual' | 'invited' => {
            if (ctx.isTeamAdmin) return 'organizer'
            if (ctx.isTeamMember) return 'invited'
            return 'individual'
          }
          
          // Sync completed tours from database to localStorage
          if (serverContext.completedTours && Array.isArray(serverContext.completedTours)) {
            serverContext.completedTours.forEach((tourName: string) => {
              localStorage.setItem(`onboarding-${tourName}-seen`, 'true')
            })
          }
          
          const newContext = {
            ...baseContext,
            ...serverContext,
            userId: session?.user?.id || serverContext.userId,
            onboardingSegment: determineSegment(serverContext),
            _loaded: true, // Mark as loaded after API fetch
          }
          setContext(newContext)
        } else {
          // Even on error, mark as loaded to prevent infinite waiting
          setContext(prev => ({ ...prev, _loaded: true }))
        }
      } catch {
        // Even on error, mark as loaded to prevent infinite waiting
        setContext(prev => ({ ...prev, _loaded: true }))
      }
    }

    if (session?.user?.id) {
      loadOnboardingContext()
    }
  }, [session?.user?.id, pathname]) // Re-check when pathname changes

  // Save context changes
  const updateContext = (updates: Partial<OnboardingContext>) => {
    const newContext = { ...context, ...updates }
    setContext(newContext)
    localStorage.setItem('onboarding-context', JSON.stringify(newContext))
  }

  return { context, updateContext }
}

// Hook for managing tour progression and sidebar indicators
export function useOnbordaTours() {
  const { context, updateContext } = useOnboardingState()
  const t = useTranslations('app')
  const [currentTour, setCurrentTour] = useState<string | null>(null)
  const [pendingTour, setPendingTour] = useState<string | null>(null)
  const [sidebarIndicators, setSidebarIndicators] = useState<Record<string, number>>({})

  // Update sidebar indicators based on context
  useEffect(() => {
    const indicators: Record<string, number> = {}

    // Team setup indicator (existing logic)
    if (context.isTeamAdmin && !context.teamId) {
      indicators.team = 1
    }

    // Photo style setup indicator
    if (context.accountMode === 'pro' && !context.hasUploadedSelfie) {
      indicators.styles = 1
    }

    // Invite members indicator
    if (context.isTeamAdmin && context.teamId && !context.hasGeneratedPhotos) {
      indicators.invite = 1
    }

    setSidebarIndicators(indicators)
  }, [context])

  // Get applicable tours for current context
  const applicableTours = useMemo(
    () => getApplicableTours(context, t),
    [context, t]
  )

  // Start a specific tour
  const startTour = (tourName: string) => {
    console.log('[Tour Debug] startTour called', { tourName })
    
    // Check if tour has already been completed (persists across sessions via localStorage)
    const hasCompleted = localStorage.getItem(`onboarding-${tourName}-seen`) === 'true'
    if (hasCompleted) {
      console.log('[Tour Debug] Tour already completed, skipping', { tourName })
      return
    }
    
    const tour = getTour(tourName, t, context)
    console.log('[Tour Debug] Tour found?', { tourFound: !!tour, tourName })
    if (tour) {
      console.log('[Tour Debug] Setting pendingTour', tourName)
      setPendingTour(tourName)
      trackTourStarted(tourName, context)
    } else {
      console.warn('[Tour Debug] Tour not found:', tourName)
    }
  }

  // Complete a tour and update context
  const completeTour = async (tourName: string) => {
    const tour = getTour(tourName, t, context)
    if (tour) {
      // Track completion before updating context
      trackTourCompleted(tourName, context)

      // Mark tour as seen in localStorage to prevent re-showing
      localStorage.setItem(`onboarding-${tourName}-seen`, 'true')

      // Clear pendingTour immediately to prevent TourStarter from restarting the tour
      setPendingTour(null)

      // Also clear sessionStorage if this tour was pending there
      if (typeof window !== 'undefined') {
        const sessionPendingTour = sessionStorage.getItem('pending-tour')
        if (sessionPendingTour === tourName) {
          sessionStorage.removeItem('pending-tour')
        }
      }

      // Persist tour completion to database (Person.onboardingState)
      if (context.personId) {
        try {
          await fetch('/api/onboarding/complete-tour', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tourName }),
          })
        } catch {
          // Continue execution even if database update fails
        }
      }

      // Update context based on completed tour
      switch (tourName) {
        case 'first-generation':
          updateContext({ hasGeneratedPhotos: true })
          // Set generation-detail tour as pending so it starts when user views their generated photos
          sessionStorage.setItem('pending-tour', 'generation-detail')
          break
        case 'team-admin-welcome':
          // Team admin welcome tour completed - user should now set up their team
          // No redirect needed as they're already on the team page
          break
        case 'team-setup':
          updateContext({ teamId: context.teamId || 'completed' })
          // After team setup tour, start invite tour
          startTour('invite-team')
          break
        case 'team-photo-styles-page':
          // Start generation tour immediately
          startTour('first-generation')
          break
        case 'team-photo-styles-free':
          // Start generation tour immediately
          startTour('first-generation')
          break
        case 'photo-style-creation':
          // Start generation tour immediately
          startTour('first-generation')
          break
        case 'test-generation':
          // After test generation tour, mark as having generated photos
          updateContext({ hasGeneratedPhotos: true })
          // Set generation-detail tour as pending so it starts when user views their generated photos
          sessionStorage.setItem('pending-tour', 'generation-detail')
          break
      }
    }
    setCurrentTour(null)
  }

  // Skip a tour
  const skipTour = (tourName: string) => {
    trackTourSkipped(tourName, context)
    setCurrentTour(null)
  }

  return {
    context,
    currentTour,
    pendingTour,
    applicableTours,
    sidebarIndicators,
    startTour,
    completeTour,
    skipTour,
    clearPendingTour: () => setPendingTour(null),
  }
}

// Hook for integrating with the tour library
export function useTourIntegration() {
  const tour = useOnborda()
  const { currentTour, completeTour, skipTour, context } = useOnbordaTours()
  const t = useTranslations('app')

  // Track step views
  useEffect(() => {
    if (tour.isOnbordaVisible && currentTour) {
      const tourConfig = getTour(currentTour, t, context)
      if (tourConfig) {
        trackStepViewed(
          currentTour,
          tour.currentStep,
          tourConfig.steps.length,
          context
        )
      }
    }
  }, [tour.isOnbordaVisible, tour.currentStep, currentTour, context, t])

  // Handle tour completion
  useEffect(() => {
    if (!tour.isOnbordaVisible || !currentTour) {
      return
    }

    // Listen for tour completion (this would need to be integrated with Onborda's API)
    return () => {
      // Cleanup
    }
  }, [tour.isOnbordaVisible, currentTour, completeTour])

  return {
    tour,
    currentTour,
    completeTour,
    skipTour,
  }
}
