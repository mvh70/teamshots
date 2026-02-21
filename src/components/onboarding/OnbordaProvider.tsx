'use client'

import { ReactNode, useRef, useEffect, useState, useMemo } from 'react'
import { OnbordaProvider as OnbordaProviderLib, Onborda, useOnborda } from 'onborda'
import { createTranslatedTours, OnboardingContext, getTour } from '@/lib/onborda/config'
import { OnbordaCard } from '@/components/onboarding/OnbordaCard'
import { useTranslations } from 'next-intl'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { usePathname } from 'next/navigation'
import { routing } from '@/i18n/routing'

interface OnbordaProviderProps {
  children: ReactNode
}

// Helper function to generate tours with translations and firstName interpolation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateTours(t: (key: string, values?: Record<string, any>) => string, context?: OnboardingContext, isMobile = false) {
  const translatedTours = createTranslatedTours(t)
  
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
        if (tour.name === 'generation-detail') {
          // For the generation detail tour, the targets are at the bottom of the generation card,
          // so we must force the tour card to appear on top to be visible.
          adjustedSide = 'top'
        } else if (step.side === 'top' || step.side === 'bottom') {
          // For other tours on mobile, prefer bottom positioning to avoid keyboard interference
          adjustedSide = 'bottom'
        }
        
        if (step.pointerPadding) {
          adjustedPointerPadding = Math.max(step.pointerPadding, 30) // Ensure at least 30px padding
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

const normalizePathname = (pathname: string) => {
  const localeMatch = pathname.match(/^\/([^/]+)(\/.*|$)/)
  if (!localeMatch) return pathname

  const possibleLocale = localeMatch[1]
  const isLocalePrefix = routing.locales.includes(possibleLocale as (typeof routing.locales)[number])
  if (!isLocalePrefix) {
    return pathname
  }

  const rest = localeMatch[2] || '/'
  return rest.length > 0 ? rest : '/'
}

function TourStarter() {
  const { pendingTour, clearPendingTour, context } = useOnbordaTours()
  const onborda = useOnborda()
  const t = useTranslations('app')
  const pathname = usePathname()
  const normalizedPathname = normalizePathname(pathname || '/')
  const forceCloseRef = useRef<string | null>(null)

  useEffect(() => {
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
  }, [onborda?.isOnbordaVisible, onborda?.currentTour, onborda, context.completedTours])

  useEffect(() => {
    if (!pendingTour || !onborda?.startOnborda || onborda.isOnbordaVisible) {
      return
    }

    const completedTours = context.completedTours || []
    if (completedTours.includes(pendingTour)) {
      clearPendingTour()
      return
    }

    const translatedTours = createTranslatedTours(t)
    const tour = translatedTours[pendingTour] || getTour(pendingTour, t, context)
    const isGenerationDetailTour = pendingTour === 'generation-detail'

    if (tour?.startingPath) {
      const matchesStartingPath = normalizedPathname.startsWith(tour.startingPath)
      const matchesInvitePath = isGenerationDetailTour
        && normalizedPathname.includes('/invite-dashboard')
        && normalizedPathname.includes('/generations')

      if (!matchesStartingPath && !matchesInvitePath) {
        return
      }
    } else if (isGenerationDetailTour) {
      const matchesInvitePath = normalizedPathname.includes('/invite-dashboard') && normalizedPathname.includes('/generations')
      const matchesAppPath = normalizedPathname.includes('/app/generations')

      if (!matchesInvitePath && !matchesAppPath) {
        return
      }
    }

    if (isGenerationDetailTour && typeof window !== 'undefined' && window.innerWidth < 1024) {
      window.dispatchEvent(new CustomEvent('close-sidebar-for-tour'))
    }

    let cancelled = false
    let attempts = 0
    const maxAttempts = 4

    const tryStart = () => {
      if (cancelled || onborda.isOnbordaVisible) {
        return
      }

      const stillCompleted = (context.completedTours || []).includes(pendingTour)
      if (stillCompleted) {
        clearPendingTour()
        return
      }

      try {
        onborda.startOnborda(pendingTour)
      } catch (error) {
        attempts += 1
        if (attempts < maxAttempts) {
          window.setTimeout(tryStart, 250)
          return
        }
        console.error('[TourStarter Debug] Unable to start tour after retries:', pendingTour, error)
      }
    }

    tryStart()

    return () => {
      cancelled = true
    }
  }, [
    pendingTour,
    onborda?.startOnborda,
    onborda?.isOnbordaVisible,
    onborda,
    clearPendingTour,
    context.completedTours,
    t,
    context,
    normalizedPathname,
  ])

  return null
}

export function OnbordaProvider({ children }: OnbordaProviderProps) {
  const t = useTranslations('app')
  const { context } = useOnboardingState()
  const [tours, setTours] = useState<ReturnType<typeof generateTours> | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  // Track window size for responsive tour positioning - intentional client-only pattern
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
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
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */
  
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
      <Onborda 
        steps={finalTours} 
        cardComponent={OnbordaCard}
        shadowOpacity="0.8"
      >
        <TourStarter />
        {children}
      </Onborda>
    </OnbordaProviderLib>
  )
}
