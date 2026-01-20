'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import SelfieTipsContent from '@/components/generation/SelfieTipsContent'
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
 * Selfie tips intro page for invited users.
 *
 * Flow: /invite-dashboard/[token] → /invite-dashboard/[token]/selfie-tips → /invite-dashboard/[token]/selfies
 *
 * This page is shown before selfie selection to help users take better selfies.
 * On mobile: Full-screen with swipe gestures, FlowNavigation at bottom
 * On desktop: Wider layout with FlowProgressDock at bottom center
 */
export default function InviteSelfieTipsPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const tContent = useTranslations('customization.photoStyle.mobile.selfieTips')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const { markSeenSelfieTips, hydrated, customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META, visitedSteps } = useGenerationFlowState()

  // Track scroll state for header transition (mobile only)
  const [isScrolled, setIsScrolled] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

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

  // Build step indicator for selfie tips (before selfie selection, so step 0)
  const hasEnoughSelfies = selectedIds.length >= MIN_SELFIES_REQUIRED
  const selfieStepIndicator = buildSelfieStepIndicator(customizationStepsMeta, {
    selfieComplete: hasEnoughSelfies,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps
  })
  const stepperTotalDots = selfieStepIndicator.totalWithLocked ?? selfieStepIndicator.total
  // Info pages are not part of the steps, so use -1 to not highlight any step as current
  const navCurrentIndex = -1
  // Merge selfie completion with persisted customization visited steps
  // Mobile indices: 0 = selfie, 1+ = customization steps (shifted by 1)
  const mergedVisitedSteps = [
    ...(hasEnoughSelfies ? [0] : []),
    ...visitedSteps.map(idx => idx + 1) // shift customization indices by 1 for selfie at index 0
  ]
  const navigationStepColors = selfieStepIndicator.lockedSteps || mergedVisitedSteps.length > 0
    ? {
        lockedSteps: selfieStepIndicator.lockedSteps,
        visitedEditableSteps: mergedVisitedSteps
      }
    : undefined

  const handleContinue = () => {
    markSeenSelfieTips()
    router.push(`/invite-dashboard/${token}/selfies`)
  }

  const handleSkip = () => {
    // Skip marks as seen and navigates directly to selfies
    markSeenSelfieTips()
    router.push(`/invite-dashboard/${token}/selfies`)
  }

  const handleBack = () => {
    router.push(`/invite-dashboard/${token}`)
  }

  // Navigation handlers for FlowProgressDock
  const handleNavigateToSelfies = () => {
    markSeenSelfieTips()
    router.push(`/invite-dashboard/${token}/selfies`)
  }

  const handleNavigateToCustomize = () => {
    router.push(`/invite-dashboard/${token}/customization`)
  }

  const handleNavigateToSelfieTips = () => {
    // Already here
  }

  const handleNavigateToCustomizationIntro = () => {
    router.push(`/invite-dashboard/${token}/customization-intro`)
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

  // Show skeleton while hydrating
  if (!hydrated) {
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
  // Check if all customization steps have been visited
  // If editableSteps is 0 (admin preset everything), customization is complete
  const isCustomizationComplete = customizationStepsMeta.editableSteps === 0 ||
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
              onBackClick={handleBack}
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
                kicker={tContent('kicker', { default: 'Get the best results' })}
                title={tContent('title', { default: 'Selfie tips for amazing photos' })}
                showBack
                onBack={handleBack}
              />
            </div>
          )}
        </div>

        {/* Content - wider on desktop */}
        <div ref={contentRef} className="max-w-7xl mx-auto w-full">
          <div className="md:pt-4 md:pb-52">
            <SelfieTipsContent
              variant="swipe"
            />
          </div>

          {/* Mobile: Space for sticky footer */}
          <div className="md:hidden h-40" />
        </div>

        {/* Mobile: Sticky footer with compact navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="px-4 py-4">
            {/* Single-line navigation: ← | Don't show again | Selfies → */}
            <div className="flex items-center justify-between">
              {/* Back (to dashboard) */}
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 pr-4 pl-3 h-11 rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">{tContent('prevLabel', { default: 'Dashboard' })}</span>
              </button>

              {/* Don't show again (centered) */}
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
              >
                {tContent('skip', { default: "Don't show again" })}
              </button>

              {/* Forward (to Selfies) */}
              <button
                type="button"
                onClick={handleContinue}
                className="flex items-center gap-2 pl-4 pr-3 h-11 rounded-full bg-brand-primary text-white shadow-sm hover:brightness-110 transition"
              >
                <span className="text-sm font-medium">{tContent('nextLabel', { default: 'Selfies' })}</span>
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
          currentStep="tips"
          onNavigateToSelfies={handleNavigateToSelfies}
          onNavigateToCustomize={handleNavigateToCustomize}
          onGenerate={handleNavigateToCustomize}
          onNavigateToDashboard={() => router.push(`/invite-dashboard/${token}`)}
          customizationStepsMeta={customizationStepsMeta}
          visitedEditableSteps={visitedSteps}
          onDontShowAgain={handleSkip}
        />
      </div>
    </SwipeableContainer>
  )
}
