'use client'

import { ReactNode, useRef, useEffect, useState, useMemo } from 'react'
import { OnbordaProvider as OnbordaProviderLib, Onborda, useOnborda } from 'onborda'
import { createTranslatedTours, OnboardingContext } from '@/lib/onborda/config'
import { OnbordaCard } from '@/components/onboarding/OnbordaCard'
import { useTranslations } from 'next-intl'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { usePathname } from 'next/navigation'
import { getTour } from '@/lib/onborda/config'

interface OnbordaProviderProps {
  children: ReactNode
}

// Helper function to generate tours with translations and firstName interpolation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateTours(t: (key: string, values?: Record<string, any>) => string, context?: OnboardingContext, isMobile = false) {
  const translatedTours = createTranslatedTours(t, context)
  
  return Object.values(translatedTours).map(tour => ({
    tour: tour.name,
    steps: tour.steps.map((step, stepIndex) => {
      // Interpolate firstName in title if present, otherwise remove placeholder
      let title = step.title
      if (title) {
        const firstName = context?.firstName
        if (firstName) {
          title = title.replace('{Firstname}', firstName)
          title = title.replace('{firstname}', firstName)
        } else {
          // Remove placeholder if firstName is not available
          title = title.replace(', {Firstname}', '')
          title = title.replace(', {firstname}', '')
        }
      }

      // Handle conditional content based on accountMode for personal photo styles tours
      let content = step.content
      if (tour.name === 'personal-photo-styles-free' || tour.name === 'personal-photo-styles-page') {
        const accountMode = context?.accountMode || 'individual'
        if (stepIndex === 0 && tour.name === 'personal-photo-styles-free') {
          // First step - heading content
          content = accountMode === 'pro'
            ? t('onboarding.tours.personalPhotoStylesFreeTour.headingContentPro')
            : t('onboarding.tours.personalPhotoStylesFreeTour.headingContentIndividual')
        } else if (stepIndex === 1 && tour.name === 'personal-photo-styles-free') {
          // Second step - free banner content
          content = accountMode === 'pro'
            ? t('onboarding.tours.personalPhotoStylesFreeTour.freeContentPro')
            : t('onboarding.tours.personalPhotoStylesFreeTour.freeContentIndividual')
        } else if (stepIndex === 0 && tour.name === 'personal-photo-styles-page') {
          // First step - heading content for paid plan
          content = accountMode === 'pro'
            ? t('onboarding.tours.personalPhotoStylesPageTour.headingContentPro')
            : t('onboarding.tours.personalPhotoStylesPageTour.headingContentIndividual')
        } else if (stepIndex === 1 && tour.name === 'personal-photo-styles-page') {
          // Second step - create button content for paid plan
          content = accountMode === 'pro'
            ? t('onboarding.tours.personalPhotoStylesPageTour.createContentPro')
            : t('onboarding.tours.personalPhotoStylesPageTour.createContentIndividual')
        }
      }

      // Adjust positioning for mobile - prefer bottom side and larger padding
      let adjustedSide = step.side
      let adjustedPointerPadding = step.pointerPadding

      if (isMobile) {
        // On mobile, prefer bottom positioning to avoid keyboard interference
        // Only change if current side would cause issues (left/right on small screens)
        if (step.side === 'left' || step.side === 'right') {
          // Keep left/right for elements that need it, but increase padding
          adjustedPointerPadding = Math.max(step.pointerPadding || 20, 40)
        } else if (step.side === 'top') {
          // Top positioning can be problematic on mobile, prefer bottom
          adjustedSide = 'bottom'
          adjustedPointerPadding = Math.max(step.pointerPadding || 20, 40)
        } else {
          // Bottom is already good, just ensure adequate padding
          adjustedPointerPadding = Math.max(step.pointerPadding || 20, 40)
        }
      }

      return {
        ...step,
        title: title || step.title,
        content: content || step.content,
        icon: null,
        side: adjustedSide,
        pointerPadding: adjustedPointerPadding,
      }
    }),
  }))
}

function TourStarter() {
  const { pendingTour, clearPendingTour, context } = useOnbordaTours()
  const onborda = useOnborda()
  const t = useTranslations('app')
  const pathname = usePathname()
  const forceCloseRef = useRef<string | null>(null)
  const lastCheckedTourRef = useRef<string | null>(null)

  useEffect(() => {
    console.log('[TourStarter Debug] Effect running - pendingTour:', pendingTour, 'lastChecked:', lastCheckedTourRef.current, 'onborda available:', !!onborda, 'startOnborda available:', !!onborda?.startOnborda, 'isOnbordaVisible:', onborda?.isOnbordaVisible)
    // If a tour is visible but it's already completed, force close it (only once per tour)
    if (onborda?.isOnbordaVisible && onborda?.currentTour) {
      // Only check if we haven't already force-closed this specific tour
      if (forceCloseRef.current !== onborda.currentTour) {
        // Check database via context.completedTours instead of localStorage
        const completedTours = context.completedTours || []
        const hasCompleted = completedTours.includes(onborda.currentTour)
        if (hasCompleted) {
          forceCloseRef.current = onborda.currentTour
          onborda.closeOnborda()
          return
        }
      }
    }
    
    // Reset forceCloseRef when tour becomes invisible or changes
    if (!onborda?.isOnbordaVisible || (onborda?.currentTour && forceCloseRef.current !== onborda.currentTour)) {
      forceCloseRef.current = null
    }
    
    // Only process pendingTour if it's different from what we last checked
    console.log('[TourStarter Debug] Checking condition - pendingTour:', pendingTour, 'lastChecked:', lastCheckedTourRef.current, 'startOnborda exists:', !!onborda?.startOnborda, 'isOnbordaVisible:', onborda?.isOnbordaVisible)
    console.log('[TourStarter Debug] Condition result:', {
      hasPendingTour: !!pendingTour,
      isDifferent: pendingTour !== lastCheckedTourRef.current,
      hasStartOnborda: typeof onborda?.startOnborda === 'function',
      notVisible: !onborda?.isOnbordaVisible,
      allTrue: !!(pendingTour && pendingTour !== lastCheckedTourRef.current && typeof onborda?.startOnborda === 'function' && !onborda.isOnbordaVisible)
    })
    
    if (pendingTour && pendingTour !== lastCheckedTourRef.current && onborda?.startOnborda && !onborda.isOnbordaVisible) {
      console.log('[TourStarter Debug] Condition met! Processing tour:', pendingTour)
      lastCheckedTourRef.current = pendingTour
      
      const tour = getTour(pendingTour, t, context)
      console.log('[TourStarter Debug] Tour found:', !!tour, 'pendingTour:', pendingTour, 'pathname:', pathname)
      
      // Add path check - allow matching if pathname starts with startingPath (for sub-paths)
      if (tour?.startingPath && !pathname.startsWith(tour.startingPath)) {
        console.log('[TourStarter Debug] Path mismatch - tour.startingPath:', tour.startingPath, 'pathname:', pathname)
        clearPendingTour()
        lastCheckedTourRef.current = null
        return
      }
      
      // Double-check database before starting (defense in depth)
      const completedTours = context.completedTours || []
      const hasCompleted = completedTours.includes(pendingTour)
      if (hasCompleted) {
        console.log('[TourStarter Debug] Tour already completed, clearing')
        clearPendingTour()
        return
      }
      
      console.log('[TourStarter Debug] Starting tour:', pendingTour, 'onborda available:', !!onborda, 'startOnborda available:', !!onborda?.startOnborda)
      
      // Close sidebar on mobile when generation-detail tour starts (dispatch early to give sidebar time to close)
      if (pendingTour === 'generation-detail' && typeof window !== 'undefined' && window.innerWidth < 1024) {
        window.dispatchEvent(new CustomEvent('close-sidebar-for-tour'))
      }
      
      // Start the tour using Onborda's API
      setTimeout(() => {
        // Check again right before starting (race condition protection)
        // Re-read from context in case it was updated
        const updatedCompletedTours = context.completedTours || []
        const stillCompleted = updatedCompletedTours.includes(pendingTour)
        if (stillCompleted) {
          console.log('[TourStarter Debug] Tour completed before start, clearing')
          clearPendingTour()
          lastCheckedTourRef.current = null
          return
        }
        // Also check if tour is already visible (might have been started by something else)
        if (onborda.isOnbordaVisible) {
          console.log('[TourStarter Debug] Tour already visible, clearing')
          clearPendingTour()
          lastCheckedTourRef.current = null
          return
        }
        console.log('[TourStarter Debug] Calling onborda.startOnborda with:', pendingTour)
        try {
        onborda.startOnborda(pendingTour)
          console.log('[TourStarter Debug] startOnborda called successfully')
        } catch (error) {
          console.error('[TourStarter Debug] Error calling startOnborda:', error)
        }
      }, 500)
    }
    
    // Reset lastCheckedTourRef when pendingTour is cleared
    if (!pendingTour) {
      lastCheckedTourRef.current = null
    }
  }, [pendingTour, onborda?.isOnbordaVisible, onborda?.currentTour, onborda?.startOnborda, onborda, clearPendingTour, context.completedTours, t, context, pathname])

  return null
}

export function OnbordaProvider({ children }: OnbordaProviderProps) {
  const t = useTranslations('app')
  const { context } = useOnboardingState()
  const [tours, setTours] = useState<ReturnType<typeof generateTours> | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  // Track window size for responsive tour positioning
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    
    // Check on mount
    checkMobile()
    
    // Listen for resize events
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Track context values to detect changes - only track what actually affects tour generation
  const contextRef = useRef<{ teamName?: string; firstName?: string; isFreePlan?: boolean; accountMode?: string }>({})
  
  // Track previous mobile state to detect changes
  const prevMobileRef = useRef(isMobile)
  
  // Track if context has been loaded to prevent premature generation
  const contextLoadedRef = useRef(false)
  
  // Generate tours when context is loaded or mobile state changes, using ref to prevent unnecessary regenerations
  const toursRef = useRef<ReturnType<typeof generateTours> | null>(null)
  useEffect(() => {
    // Update loaded ref
    if (context._loaded && !contextLoadedRef.current) {
      contextLoadedRef.current = true
    }
    
    // Only proceed if context is loaded
    if (!contextLoadedRef.current) {
      return
    }
    
    const teamNameChanged = context.teamName !== contextRef.current.teamName
    const firstNameChanged = context.firstName !== contextRef.current.firstName
    const isFreePlanChanged = context.isFreePlan !== contextRef.current.isFreePlan
    const accountModeChanged = context.accountMode !== contextRef.current.accountMode
    const mobileChanged = isMobile !== prevMobileRef.current
    
    // Regenerate tours only if relevant values changed
    if (teamNameChanged || firstNameChanged || isFreePlanChanged || accountModeChanged || mobileChanged || !toursRef.current) {
      contextRef.current = { 
        teamName: context.teamName, 
        firstName: context.firstName, 
        isFreePlan: context.isFreePlan,
        accountMode: context.accountMode
      }
      prevMobileRef.current = isMobile
      toursRef.current = generateTours(t, context, isMobile)
      setTours(toursRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context._loaded, context.teamName, context.firstName, context.isFreePlan, context.accountMode, t, isMobile]) // Removed full context object from dependencies
  
  // Use tours from ref if state is not ready yet
  // The useEffect handles all tour generation, this is just a memoized accessor
  const finalTours = useMemo(() => {
    // Prefer state tours, then ref tours
    return tours || toursRef.current || []
  }, [tours]) // Only depend on tours state - useEffect handles regeneration when context changes

  return (
    <OnbordaProviderLib>
      <Onborda steps={finalTours} cardComponent={OnbordaCard}>
        <TourStarter />
        {children}
      </Onborda>
    </OnbordaProviderLib>
  )
}

