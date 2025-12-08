import { useEffect, useMemo, useState, useRef } from 'react'
import { useOnborda } from 'onborda'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/routing'
import { OnboardingContext, getApplicableTours, getTour } from './config'
import { trackTourStarted, trackTourCompleted, trackTourSkipped, trackStepViewed } from './analytics'

// Export the utility functions
export { getApplicableTours, getTour }

// Helper function to read sessionStorage synchronously
function getSessionStorageData(): Partial<OnboardingContext> | null {
  if (typeof window === 'undefined') return null
  
  try {
    const initialDataStr = sessionStorage.getItem('teamshots.initialData')
    if (initialDataStr) {
      const initialData = JSON.parse(initialDataStr)
      // Check if data is fresh (within 5 minutes)
      const timestamp = initialData._timestamp || 0
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      if (timestamp < fiveMinutesAgo) {
        // Data is stale, return null to trigger API fetch
        return null
      }
      
      if (initialData.onboarding && initialData.user?.id) {
        const determineSegment = (roles: { isTeamAdmin?: boolean; isTeamMember?: boolean }): 'organizer' | 'individual' | 'invited' => {
          if (roles?.isTeamAdmin) return 'organizer'
          if (roles?.isTeamMember) return 'invited'
          return 'individual'
        }

        return {
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
          completedTours: initialData.onboarding?.completedTours || [], // Include completed tours from database
          _loaded: true, // Mark as loaded immediately when using sessionStorage
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
  
  return null
}

// Hook for managing onboarding state
export function useOnboardingState() {
  const { data: session } = useSession()
  const pathname = usePathname()

  // Read sessionStorage synchronously in initializer to set _loaded immediately
  const sessionStorageData = typeof window !== 'undefined' ? getSessionStorageData() : null

  const [context, setContext] = useState<OnboardingContext>(() => {
    if (sessionStorageData) {
      return {
        // Provide defaults for all required properties
        isTeamAdmin: false,
        isTeamMember: false,
        isRegularUser: true,
        hasUploadedSelfie: false,
        hasGeneratedPhotos: false,
        accountMode: 'individual',
        language: 'en',
        isFreePlan: true,
        onboardingSegment: 'individual',
        // Override with sessionStorage data (which may be partial)
        ...sessionStorageData,
        // CRITICAL: Override completedTours, pendingTours, and _loaded AFTER spreading sessionStorage
        // This ensures we always fetch fresh tour data from API, not stale sessionStorage
        completedTours: [], // Force empty - API is source of truth for completed tours
        pendingTours: [], // Force empty - API is source of truth for pending tours
        hiddenScreens: sessionStorageData?.hiddenScreens || [], // Preserve hidden screens if present
        _loaded: false, // Force false - must wait for API fetch to get fresh tour data
      }
    }

    return {
      isTeamAdmin: false,
      isTeamMember: false,
      isRegularUser: true,
      hasUploadedSelfie: false,
      hasGeneratedPhotos: false,
      accountMode: 'individual',
      language: 'en',
      isFreePlan: true,
      onboardingSegment: 'individual', // Default segment
      hiddenScreens: [],
      completedTours: [], // Default to empty array
      pendingTours: [], // Default to empty array
      _loaded: false, // Internal flag to track if context has been loaded from server
    }
  })

  // Track loading state with ref to prevent circular dependencies
  const isLoadingRef = useRef(false)
  const hasLoadedRef = useRef(false)
  const lastPathnameRef = useRef(pathname)
  const lastResponseHashRef = useRef<string | null>(null)
  const isSettingContextRef = useRef(false) // Guard against React Strict Mode double-invocation

  // Load onboarding context from server only (no localStorage caching)
  // Always fetch fresh data to ensure database is the single source of truth
  useEffect(() => {
    // Check if we're on a generations page - if so, always refresh context to get latest hasGeneratedPhotos
    const isGenerationsPage = pathname === '/app/generations/team' || pathname === '/app/generations/personal'
    const pathnameChanged = pathname !== lastPathnameRef.current
    lastPathnameRef.current = pathname

    // Always fetch from API - no localStorage caching
    const loadOnboardingContext = async () => {
      // Prevent concurrent loads
      if (isLoadingRef.current) {
        return
      }
      
      isLoadingRef.current = true
      try {
        // Check if we're in an invite flow - extract token from pathname
        // Pathname format: /invite-dashboard/[token]/...
        const inviteMatch = pathname?.match(/^\/invite-dashboard\/([^/]+)/)
        const inviteToken = inviteMatch ? inviteMatch[1] : null
        
        // Build API URL with token if in invite flow
        const apiUrl = inviteToken 
          ? `/api/onboarding/context?token=${encodeURIComponent(inviteToken)}`
          : '/api/onboarding/context'
        
        const response = await fetch(apiUrl)
        if (response.ok) {
          const serverContext = await response.json()
          
          // Create a hash of the response to detect duplicates (React Strict Mode protection)
          const responseHash = JSON.stringify({
            completedTours: serverContext.completedTours,
            pendingTours: serverContext.pendingTours,
            hiddenScreens: serverContext.hiddenScreens,
            isTeamAdmin: serverContext.isTeamAdmin,
            isTeamMember: serverContext.isTeamMember,
            hasUploadedSelfie: serverContext.hasUploadedSelfie,
            hasGeneratedPhotos: serverContext.hasGeneratedPhotos,
          })
          
          // Skip if this is the exact same response we just processed
          if (lastResponseHashRef.current === responseHash && hasLoadedRef.current) {
            isLoadingRef.current = false
            return
          }
          
          lastResponseHashRef.current = responseHash

          // Determine onboarding segment based on server response
          const determineSegment = (ctx: { isTeamAdmin?: boolean; isTeamMember?: boolean }): 'organizer' | 'individual' | 'invited' => {
            if (ctx.isTeamAdmin) return 'organizer'
            if (ctx.isTeamMember) return 'invited'
            return 'individual'
          }

          const newContext = {
            ...serverContext,
            userId: session?.user?.id || serverContext.userId,
            onboardingSegment: determineSegment(serverContext),
            completedTours: serverContext.completedTours || [], // Include completed tours from database
            pendingTours: serverContext.pendingTours || [], // Include pending tours from database
            hiddenScreens: serverContext.hiddenScreens || [],
            _loaded: true, // Mark as loaded after API fetch
          }
          
          // Only update context if values actually changed (prevent unnecessary re-renders)
          setContext(prev => {
            // Double-check we haven't already processed this (race condition + React Strict Mode protection)
            const currentHash = JSON.stringify({
              completedTours: prev.completedTours,
              pendingTours: prev.pendingTours,
              hiddenScreens: prev.hiddenScreens,
              isTeamAdmin: prev.isTeamAdmin,
              isTeamMember: prev.isTeamMember,
              hasUploadedSelfie: prev.hasUploadedSelfie,
              hasGeneratedPhotos: prev.hasGeneratedPhotos,
            })
            
            // If context already matches what we're trying to set, skip update (prevents duplicate logs in React Strict Mode)
            if (currentHash === responseHash && prev._loaded) {
              return prev // Silent return - no log needed
            }
            
            const completedToursChanged = JSON.stringify(prev.completedTours) !== JSON.stringify(newContext.completedTours)
            const pendingToursChanged = JSON.stringify(prev.pendingTours) !== JSON.stringify(newContext.pendingTours)
            const hiddenScreensChanged = JSON.stringify(prev.hiddenScreens) !== JSON.stringify(newContext.hiddenScreens)
            const otherPropsChanged = 
              prev.isTeamAdmin !== newContext.isTeamAdmin ||
              prev.isTeamMember !== newContext.isTeamMember ||
              prev.hasUploadedSelfie !== newContext.hasUploadedSelfie ||
              prev.hasGeneratedPhotos !== newContext.hasGeneratedPhotos ||
              prev.accountMode !== newContext.accountMode ||
              prev.isFreePlan !== newContext.isFreePlan ||
              prev.onboardingSegment !== newContext.onboardingSegment ||
              prev._loaded !== newContext._loaded
            
            // Only update if something actually changed
            if (completedToursChanged || pendingToursChanged || hiddenScreensChanged || otherPropsChanged || !prev._loaded) {
              // Guard against React Strict Mode double-invocation
              if (!isSettingContextRef.current) {
                isSettingContextRef.current = true
                // Reset guard after update completes
                setTimeout(() => {
                  isSettingContextRef.current = false
                }, 50)
              }
              hasLoadedRef.current = true
              return newContext
            }
            return prev
          })
        } else {
          // Even on error, mark as loaded to prevent infinite waiting
          setContext(prev => {
            if (prev._loaded) return prev
            hasLoadedRef.current = true
            return { ...prev, _loaded: true }
          })
        }
      } catch {
        // Even on error, mark as loaded to prevent infinite waiting
        setContext(prev => {
          if (prev._loaded) return prev
          hasLoadedRef.current = true
          return { ...prev, _loaded: true }
        })
      } finally {
        isLoadingRef.current = false
      }
    }

    if (session?.user?.id) {
      // Fetch if not loaded yet, or if pathname changed to a generations page
      if (!hasLoadedRef.current || (isGenerationsPage && pathnameChanged)) {
        loadOnboardingContext()
      }
    }
  }, [session?.user?.id, pathname]) // Removed context._loaded from dependencies to prevent circular updates

  // Update context (no localStorage persistence)
  const updateContext = (updates: Partial<OnboardingContext>) => {
    setContext(prev => {
      // Check if any values actually changed before updating
      let hasChanges = false
      for (const key in updates) {
        const typedKey = key as keyof OnboardingContext
        if (prev[typedKey] !== updates[typedKey]) {
          hasChanges = true
          break
        }
      }
      
      // Only update if something changed
      if (hasChanges) {
        return { ...prev, ...updates }
      }
      return prev
    })
  }

  return { context, updateContext }
}

// Hook for managing tour progression and sidebar indicators
// This hook should be used within OnboardingProvider context
export function useOnbordaTours() {
  // Import dynamically to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useOnboardingState: useOnboardingStateFromContext } = require('@/contexts/OnboardingContext')
  const { context, updateContext, pendingTour, setPendingTour, clearPendingTour: clearPendingTourFromContext } = useOnboardingStateFromContext()
  const t = useTranslations('app')
  const pathname = usePathname()
  const [currentTour, setCurrentTour] = useState<string | null>(null)
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
  const startTour = (tourName: string, force: boolean = false) => {
    try {
      // Check if tour has already been completed (check database via context.completedTours)
      // Skip check if force is true (explicit call from page that already validated conditions)
      if (!force) {
        const completedTours = context.completedTours || []
        const hasCompleted = completedTours.includes(tourName)
        if (hasCompleted) {
          return
        }
      } else {
        // When forcing, also remove from completedTours in local context to fix stale data
        // This ensures the tour can proceed even if context has stale completion data
        const currentCompletedTours = context.completedTours || []
        if (currentCompletedTours.includes(tourName)) {
          const updatedCompletedTours = currentCompletedTours.filter((t: string) => t !== tourName)
          updateContext({ completedTours: updatedCompletedTours })
        }
      }
      
      const tour = getTour(tourName, t, context)
      
      if (tour) {
        setPendingTour(tourName)
        trackTourStarted(tourName, context)
      }
    } catch (error) {
      console.error('[startTour] ERROR calling startTour:', error)
    }
  }

  // Complete a tour and update context
  const completeTour = async (tourName: string) => {
    const tour = getTour(tourName, t, context)
    if (tour) {
      // Track completion before updating context
      trackTourCompleted(tourName, context)

      // Mark tour as completed in database (not localStorage)
      // The database update happens via API call in the component that triggers this
      // We don't update localStorage anymore - database is source of truth

      // Clear pendingTour immediately to prevent TourStarter from restarting the tour
      setPendingTour(null)

      // Persist tour completion to database (Person.onboardingState)
      if (context.personId) {
        try {
          // Check if we're in an invite flow - extract token from pathname
          const inviteMatch = pathname?.match(/^\/invite-dashboard\/([^/]+)/)
          const inviteToken = inviteMatch ? inviteMatch[1] : null
          
          // Build request body with token if in invite flow
          const requestBody: { tourName: string; token?: string } = { tourName }
          if (inviteToken) {
            requestBody.token = inviteToken
          }
          
          const response = await fetch('/api/onboarding/complete-tour', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            console.error(`[completeTour] Failed to complete tour ${tourName}:`, response.status, errorData)
            throw new Error(`API returned ${response.status}: ${JSON.stringify(errorData)}`)
          }

          await response.json()

          // Refresh onboarding context from database to ensure we have the latest state
          try {
            // Check if we're in an invite flow - extract token from pathname
            const inviteMatch = pathname?.match(/^\/invite-dashboard\/([^/]+)/)
            const inviteToken = inviteMatch ? inviteMatch[1] : null
            
            // Build API URL with token if in invite flow
            const contextApiUrl = inviteToken 
              ? `/api/onboarding/context?token=${encodeURIComponent(inviteToken)}`
              : '/api/onboarding/context'
            
            const contextResponse = await fetch(contextApiUrl)
            if (contextResponse.ok) {
              const freshContext = await contextResponse.json()
              // Update context with fresh data from database
              updateContext({
                completedTours: freshContext.completedTours || [],
                pendingTours: freshContext.pendingTours || [],
              })
            } else {
              // Still update local context optimistically with the API result
              const currentCompletedTours = context.completedTours || []
              if (!currentCompletedTours.includes(tourName)) {
                updateContext({ completedTours: [...currentCompletedTours, tourName] })
              }
            }
          } catch (refreshError) {
            console.error(`[completeTour] Error refreshing context after completing ${tourName}:`, refreshError)
            // Still update local context optimistically with the API result
            const currentCompletedTours = context.completedTours || []
            if (!currentCompletedTours.includes(tourName)) {
              updateContext({ completedTours: [...currentCompletedTours, tourName] })
            }
          }
        } catch (error) {
          console.error(`[completeTour] Error completing tour ${tourName}:`, error)
          // Continue execution even if database update fails
          // Still update local context optimistically
          const currentCompletedTours = context.completedTours || []
          if (!currentCompletedTours.includes(tourName)) {
            updateContext({ completedTours: [...currentCompletedTours, tourName] })
          }
        }
      } else {
        // If no personId, still update local context optimistically
        const currentCompletedTours = context.completedTours || []
        if (!currentCompletedTours.includes(tourName)) {
          updateContext({ completedTours: [...currentCompletedTours, tourName] })
        }
      }

      // Update context based on completed tour
      switch (tourName) {
        case 'main-onboarding':
          // Main onboarding tour completed - user has been introduced to the platform
          break
        case 'generation-detail':
          // User has seen how to interact with generated photos
          break
        case 'photo-style-creation':
          // User has completed the photo style creation tour
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
    clearPendingTour: clearPendingTourFromContext,
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
