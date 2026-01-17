'use client'

import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import CustomizationIntroContent from '@/components/generation/CustomizationIntroContent'
import { FlowHeader } from '@/components/generation/layout'
import { FlowNavigation, SwipeableContainer, FlowProgressDock } from '@/components/generation/navigation'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { buildSelfieStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { PRICING_CONFIG } from '@/config/pricing'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'

const isNonNullObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

interface DashboardStats {
  creditsRemaining: number
}

/**
 * Customization intro page for invited users.
 *
 * Flow: /invite-dashboard/[token]/selfies → /invite-dashboard/[token]/customization-intro → /invite-dashboard/[token]/customization
 *
 * This page explains the customization options before users see them.
 * On mobile: Full-screen with swipe gestures, FlowNavigation at bottom
 * On desktop: Wider layout with FlowProgressDock at bottom center
 */
export default function InviteCustomizationIntroPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const tIntro = useTranslations('customization.photoStyle.mobile.intro')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const { markSeenCustomizationIntro, setPendingGeneration, markInFlow, hydrated, customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META, visitedSteps } = useGenerationFlowState()

  // Track scroll state for header transition (mobile only)
  const [isScrolled, setIsScrolled] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Track hidden screens from onboarding context (persisted in database)
  const [hiddenScreens, setHiddenScreens] = useState<string[]>([])
  const [contextLoaded, setContextLoaded] = useState(false)
  const [isSavingPreference, setIsSavingPreference] = useState(false)
  const hasAutoSkippedRef = useRef(false)

  // Check if force parameter is set (from info icon click) - always show when forced
  const forceShow = searchParams.get('force') === '1'
  const skipCustomizationIntro = !forceShow && hiddenScreens.includes('customization-intro')

  // Load selfie count for progress dock
  const { selectedIds, loadSelected } = useSelfieSelection({ token })
  const [stats, setStats] = useState<DashboardStats>({ creditsRemaining: 0 })

  // Fetch stats for credit check
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/member/stats?token=${token}`)
      if (response.ok) {
        const data = await response.json()
        if (isNonNullObject(data) && isNonNullObject(data.stats)) {
          setStats(data.stats as unknown as DashboardStats)
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [token])

  useEffect(() => {
    loadSelected()
    fetchStats()
  }, [loadSelected, fetchStats])

  // Load onboarding context to check if screen is hidden
  useEffect(() => {
    const loadOnboardingContext = async () => {
      try {
        const response = await fetch(`/api/onboarding/context?token=${token}`)
        if (response.ok) {
          const data = await response.json()
          if (data.hiddenScreens && Array.isArray(data.hiddenScreens)) {
            setHiddenScreens(data.hiddenScreens)
          }
        }
      } catch (error) {
        console.error('Error loading onboarding context:', error)
      } finally {
        setContextLoaded(true)
      }
    }
    loadOnboardingContext()
  }, [token])

  // Auto-skip if customization-intro is hidden (user previously clicked "Don't show again")
  useEffect(() => {
    // Never auto-skip if force parameter is set (user clicked info icon)
    const isForced = searchParams.get('force') === '1'
    if (isForced) return

    if (hydrated && contextLoaded && skipCustomizationIntro && !hasAutoSkippedRef.current) {
      hasAutoSkippedRef.current = true
      // Mark as seen in session storage too
      markSeenCustomizationIntro()
      setPendingGeneration(false)
      markInFlow()
      router.replace(`/invite-dashboard/${token}/customization`)
    }
  }, [hydrated, contextLoaded, skipCustomizationIntro, router, token, markSeenCustomizationIntro, setPendingGeneration, markInFlow, searchParams])

  // Build step indicator for customization intro (after selfie selection)
  // Note: hasEnoughSelfies is computed later in the file, so we use selectedIds.length directly here
  const selfieComplete = selectedIds.length >= MIN_SELFIES_REQUIRED
  const selfieStepIndicator = buildSelfieStepIndicator(customizationStepsMeta, {
    selfieComplete,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps
  })
  const stepperTotalDots = selfieStepIndicator.totalWithLocked ?? selfieStepIndicator.total
  // Info pages are not part of the steps, so use -1 to not highlight any step as current
  // But show selfie step as visited (green) since it's complete
  const navCurrentIndex = -1
  // Merge selfie completion with persisted customization visited steps
  // Mobile indices: 0 = selfie, 1+ = customization steps (shifted by 1)
  const mergedVisitedSteps = [
    ...(selfieComplete ? [0] : []),
    ...visitedSteps.map(idx => idx + 1) // shift customization indices by 1 for selfie at index 0
  ]
  const navigationStepColors = selfieStepIndicator.lockedSteps || mergedVisitedSteps.length > 0
    ? {
        lockedSteps: selfieStepIndicator.lockedSteps,
        visitedEditableSteps: mergedVisitedSteps
      }
    : undefined

  const handleContinue = () => {
    // Mark customization intro as seen first
    markSeenCustomizationIntro()
    // Clear pendingGeneration flag since we've completed selfie selection and are moving to customization
    setPendingGeneration(false)
    // Mark as in flow (sets fromGeneration and openStartFlow) so dashboard knows we're continuing
    // Don't pass { pending: true } since we've already cleared pendingGeneration
    markInFlow()
    // Navigate to the customization page (now a separate route)
    router.push(`/invite-dashboard/${token}/customization`)
  }

  const handleSkip = async () => {
    if (isSavingPreference) return
    setIsSavingPreference(true)
    try {
      // Persist the "don't show" preference to the database
      const response = await fetch('/api/onboarding/hide-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenName: 'customization-intro', token })
      })
      const data = await response.json().catch(() => ({}))
      if (data.hiddenScreens) {
        setHiddenScreens(data.hiddenScreens)
      }
    } catch (error) {
      console.error('[CustomizationIntroPage] Failed to persist skip preference', error)
    } finally {
      setIsSavingPreference(false)
      // Navigate after persisting
      markSeenCustomizationIntro()
      setPendingGeneration(false)
      markInFlow()
      router.push(`/invite-dashboard/${token}/customization`)
    }
  }

  const handleBack = () => {
    router.push(`/invite-dashboard/${token}/selfies`)
  }

  const goBackToDashboard = () => {
    router.push(`/invite-dashboard/${token}`)
  }

  // Navigation handlers for FlowProgressDock
  const handleNavigateToSelfies = () => {
    router.push(`/invite-dashboard/${token}/selfies`)
  }

  const handleNavigateToCustomize = () => {
    markSeenCustomizationIntro()
    setPendingGeneration(false)
    markInFlow()
    router.push(`/invite-dashboard/${token}/customization`)
  }

  const handleNavigateToSelfieTips = () => {
    router.push(`/invite-dashboard/${token}/selfie-tips`)
  }

  const handleNavigateToCustomizationIntro = () => {
    // Already here
  }

  // Monitor scroll position to toggle header (mobile only)
  useEffect(() => {
    if (!isMobile) return

    const handleScroll = () => {
      // Transition at 60px scroll (about when content title leaves viewport)
      setIsScrolled(window.scrollY > 60)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isMobile])

  // Don't render while checking or if redirecting
  const shouldRedirect = !forceShow && skipCustomizationIntro

  // Show skeleton while hydrating or loading context, or if about to redirect
  if (!hydrated || !contextLoaded || shouldRedirect) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header skeleton */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        {/* Content skeleton */}
        <div className="px-4 py-8 space-y-6">
          <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
          <div className="mt-8 space-y-4">
            <div className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            <div className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const hasEnoughCredits = stats.creditsRemaining >= PRICING_CONFIG.credits.perGeneration
  const hasEnoughSelfies = selectedIds.length >= MIN_SELFIES_REQUIRED
  // Check if all customization steps have been visited
  const isCustomizationComplete = customizationStepsMeta.editableSteps > 0 &&
    visitedSteps.length >= customizationStepsMeta.editableSteps
  const canGenerate = hasEnoughSelfies && hasEnoughCredits && isCustomizationComplete

  return (
    <SwipeableContainer
      onSwipeLeft={isSwipeEnabled ? handleContinue : undefined}
      onSwipeRight={isSwipeEnabled ? handleBack : undefined}
      enabled={isSwipeEnabled}
    >
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Sticky header container - transitions between dashboard header and content header */}
        <div className="sticky top-0 z-50">
          {/* Dashboard header - visible when at top */}
          <div
            className={`transition-opacity duration-200 ${
              isMobile && isScrolled ? 'opacity-0 pointer-events-none absolute inset-x-0' : 'opacity-100'
            }`}
          >
            <InviteDashboardHeader
              token={token}
              showBackToDashboard
              onBackClick={goBackToDashboard}
              hideTitle
              creditsRemaining={stats.creditsRemaining}
              photosAffordable={Math.floor(stats.creditsRemaining / PRICING_CONFIG.credits.perGeneration)}
            />
          </div>

          {/* Content header - visible when scrolled (mobile only) */}
          {isMobile && (
            <div
              className={`transition-opacity duration-200 ${
                isScrolled ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-x-0'
              }`}
            >
              <FlowHeader
                kicker={tIntro('kicker', { default: 'Before you dive in' })}
                title={tIntro('title', { default: 'A quick pit stop before the glow-up' })}
                showBack
                onBack={handleBack}
              />
            </div>
          )}
        </div>

        {/* Content - wider on desktop */}
        <div ref={contentRef} className="max-w-7xl mx-auto w-full">
          <div className="md:pt-4 md:pb-52">
            <CustomizationIntroContent
              variant="swipe"
            />
          </div>

          {/* Mobile: Space for sticky footer */}
          <div className="md:hidden h-40" />
        </div>

        {/* Mobile: Sticky footer with compact navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="px-4 py-4">
            {/* Single-line navigation: ← Selfies | Don't show again | Customize → */}
            <div className="flex items-center justify-between">
              {/* Back (to Selfies) */}
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 pr-4 pl-3 h-11 rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">{tIntro('prevLabel', { default: 'Selfies' })}</span>
              </button>

              {/* Don't show again (centered) */}
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSavingPreference}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2 disabled:opacity-50"
              >
                {tIntro('skip', { default: "Don't show again" })}
              </button>

              {/* Forward (to Customize) */}
              <button
                type="button"
                onClick={handleContinue}
                className="flex items-center gap-2 pl-4 pr-3 h-11 rounded-full bg-brand-primary text-white shadow-sm hover:brightness-110 transition"
              >
                <span className="text-sm font-medium">{tIntro('nextLabel', { default: 'Customize' })}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          {/* Progress dots */}
          <div className="px-4 pb-4">
            <FlowNavigation
              variant="dots-only"
              size="md"
              current={navCurrentIndex}
              total={Math.max(1, stepperTotalDots)}
              onPrev={handleBack}
              onNext={handleContinue}
              stepColors={navigationStepColors}
            />
          </div>
        </div>

        {/* Desktop: FlowProgressDock */}
        <FlowProgressDock
          selfieCount={selectedIds.length}
          uneditedFields={!isCustomizationComplete ? ['customization'] : []}
          hasUneditedFields={!isCustomizationComplete}
          canGenerate={canGenerate}
          hasEnoughCredits={hasEnoughCredits}
          currentStep="intro"
          onNavigateToSelfies={handleNavigateToSelfies}
          onNavigateToCustomize={handleNavigateToCustomize}
          onGenerate={handleContinue}
          onNavigateToDashboard={() => router.push(`/invite-dashboard/${token}`)}
          customizationStepsMeta={customizationStepsMeta}
          visitedEditableSteps={visitedSteps}
          onDontShowAgain={handleSkip}
        />
      </div>
    </SwipeableContainer>
  )
}
