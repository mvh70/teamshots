'use client'

import { ReactNode, useRef, useEffect, useState, useMemo } from 'react'
import { OnbordaProvider as OnbordaProviderLib, Onborda, useOnborda } from 'onborda'
import { createTranslatedTours, OnboardingContext } from '@/lib/onborda/config'
import { OnbordaCard } from '@/components/onboarding/OnbordaCard'
import { useTranslations } from 'next-intl'
import { useOnboardingState, useOnbordaTours } from '@/lib/onborda/hooks'

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
  const { pendingTour } = useOnbordaTours()
  const onborda = useOnborda()

  useEffect(() => {
    console.log('[Tour Debug] TourStarter: Effect triggered', { 
      pendingTour, 
      onborda: !!onborda,
      startOnborda: !!onborda?.startOnborda,
      isOnbordaVisible: onborda?.isOnbordaVisible 
    })
    
    if (pendingTour && onborda?.startOnborda && !onborda.isOnbordaVisible) {
      console.log('[Tour Debug] TourStarter: Starting tour', { pendingTour, isOnbordaVisible: onborda.isOnbordaVisible })
      // Start the tour using Onborda's API
      setTimeout(() => {
        console.log('[Tour Debug] TourStarter: Calling startOnborda', pendingTour)
        onborda.startOnborda(pendingTour)
      }, 500)
    } else {
      console.log('[Tour Debug] TourStarter: Not starting tour', { 
        pendingTour, 
        hasStartOnborda: !!onborda?.startOnborda, 
        isOnbordaVisible: onborda?.isOnbordaVisible 
      })
    }
  }, [pendingTour, onborda])

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
  
  // Track context values to detect changes
  const contextRef = useRef<{ teamName?: string; firstName?: string; isFreePlan?: boolean }>({})
  
  // Track previous mobile state to detect changes
  const prevMobileRef = useRef(isMobile)
  
  // Generate tours when context is loaded or mobile state changes, using ref to prevent unnecessary regenerations
  const toursRef = useRef<ReturnType<typeof generateTours> | null>(null)
  useEffect(() => {
    const teamNameChanged = context.teamName !== contextRef.current.teamName
    const firstNameChanged = context.firstName !== contextRef.current.firstName
    const isFreePlanChanged = context.isFreePlan !== contextRef.current.isFreePlan
    const mobileChanged = isMobile !== prevMobileRef.current
    
    // Regenerate tours if context is loaded and relevant values changed
    if (context._loaded && (teamNameChanged || firstNameChanged || isFreePlanChanged || mobileChanged || !toursRef.current)) {
      contextRef.current = { teamName: context.teamName, firstName: context.firstName, isFreePlan: context.isFreePlan }
      prevMobileRef.current = isMobile
      toursRef.current = generateTours(t, context, isMobile)
      setTours(toursRef.current)
    } else if (!toursRef.current) {
      // Generate initial tours with current context (will use fallbacks if values not available)
      prevMobileRef.current = isMobile
      toursRef.current = generateTours(t, context, isMobile)
      setTours(toursRef.current)
    }
  }, [context._loaded, context.teamName, context.firstName, context.isFreePlan, context, t, isMobile])
  
  // Use tours from ref if state is not ready yet
  const finalTours = useMemo(() => {
    return tours || toursRef.current || generateTours(t, context, isMobile)
  }, [tours, t, context, isMobile])

  return (
    <OnbordaProviderLib>
      <Onborda steps={finalTours} cardComponent={OnbordaCard}>
        <TourStarter />
        {children}
      </Onborda>
    </OnbordaProviderLib>
  )
}
