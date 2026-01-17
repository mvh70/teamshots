'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import SelfieTipsContent from '@/components/generation/SelfieTipsContent'
import { StickyFlowPage } from '@/components/generation/layout'
import { SwipeableContainer, FlowNavigation, FlowProgressDock } from '@/components/generation/navigation'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { buildSelfieStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import Header from '@/app/[locale]/(product)/app/components/Header'
import { useOnboardingState } from '@/lib/onborda/hooks'
import { useEffect, useRef, useState, useCallback } from 'react'
import { preloadFaceDetectionModel } from '@/lib/face-detection'

/**
 * Selfie tips intro page for logged-in users.
 * 
 * Flow: /app/generate/start → /app/generate/selfie-tips → /app/generate/selfie
 * 
 * This page is shown before selfie selection to help users take better selfies.
 * On mobile: Full-screen with swipe left to continue
 * On desktop: Card layout with continue button
 */
export default function SelfieTipsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tSelfieHeader = useTranslations('customization.photoStyle.mobile.selfieTips')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const { markSeenSelfieTips, hydrated, customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META, visitedSteps } = useGenerationFlowState()
  const { context, updateContext } = useOnboardingState()
  const [isSavingPreference, setIsSavingPreference] = useState(false)
  const hasAutoSkippedRef = useRef(false)

  // Get selfie count for the progress dock
  const selfieManager = useSelfieManagement({ autoSelectNewUploads: false })
  const selfieCount = selfieManager.mode === 'individual' ? selfieManager.selectedIds.length : 0

  // Check if force parameter is set (from info icon click) - always show when forced
  const forceShow = searchParams.get('force') === '1'
  const skipSelfieTips = !forceShow && context.hiddenScreens?.includes('selfie-tips')

  // Build step indicator for selfie tips (before selfie selection, so step 0)
  const selfieStepIndicator = buildSelfieStepIndicator(customizationStepsMeta, {
    selfieComplete: false,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps
  })
  const stepperTotalDots = selfieStepIndicator.totalWithLocked ?? selfieStepIndicator.total
  // Info pages are not part of the steps, so use -1 to not highlight any step as current
  const navCurrentIndex = -1
  const navigationStepColors = selfieStepIndicator.lockedSteps || selfieStepIndicator.visitedEditableSteps
    ? {
        lockedSteps: selfieStepIndicator.lockedSteps,
        visitedEditableSteps: selfieStepIndicator.visitedEditableSteps
      }
    : undefined

  const handleContinue = useCallback(() => {
    markSeenSelfieTips()
    router.push('/app/generate/selfie')
  }, [markSeenSelfieTips, router])

  const handleDontShow = async () => {
    if (isSavingPreference) return
    setIsSavingPreference(true)
    try {
      const response = await fetch('/api/onboarding/hide-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenName: 'selfie-tips' })
      })
      const data = await response.json().catch(() => ({}))
      const updatedHiddenScreens = Array.from(
        new Set([...(context.hiddenScreens || []), ...(data.hiddenScreens || ['selfie-tips'])])
      )
      updateContext({ hiddenScreens: updatedHiddenScreens })
    } catch (error) {
      console.error('[SelfieTipsPage] Failed to persist skip preference', error)
    } finally {
      setIsSavingPreference(false)
      handleContinue()
    }
  }

  useEffect(() => {
    // Never auto-skip if force parameter is set (user explicitly clicked info icon)
    // Check directly from searchParams inside effect to avoid stale closure issues
    const isForced = searchParams.get('force') === '1'
    if (isForced) return
    if (!hydrated || !context._loaded || hasAutoSkippedRef.current) return
    if (!context.hiddenScreens?.includes('selfie-tips')) return

    hasAutoSkippedRef.current = true
    handleContinue()
  }, [hydrated, context._loaded, context.hiddenScreens, handleContinue, searchParams])

  // Preload face detection model in the background while user reads tips
  // This ensures the model is ready when they reach the selfie capture page
  useEffect(() => {
    console.log('[SelfieTipsPage] Preloading face detection model...')
    preloadFaceDetectionModel()
  }, [])

  // Don't render until hydration completes to avoid flash
  // Always show if force parameter is set (user clicked info icon)
  // Otherwise, show nothing while loading or if hidden screen will be auto-skipped
  if (!hydrated || !context._loaded) {
    return null
  }
  if (!forceShow && context.hiddenScreens?.includes('selfie-tips')) {
    return null
  }

  const handleBack = () => {
    router.push('/app/dashboard')
  }

  return (
    <>
      {/* Progress Dock - Bottom Center (Desktop) */}
      <FlowProgressDock
        selfieCount={selfieCount}
        uneditedFields={[]}
        hasUneditedFields={false}
        canGenerate={false}
        hasEnoughCredits={true}
        currentStep="tips"
        onNavigateToSelfies={handleContinue}
        onNavigateToCustomize={() => {
          // Clicking on customize step always goes directly to customize page
          router.push('/app/generate/start?skipUpload=1')
        }}
        onGenerate={() => {}} // Not available on this page
        onNavigateToDashboard={() => router.push('/app/dashboard')}
        customizationStepsMeta={customizationStepsMeta}
        visitedEditableSteps={visitedSteps}
        onDontShowAgain={handleDontShow}
      />

      <SwipeableContainer
        onSwipeLeft={isSwipeEnabled ? handleContinue : undefined}
        onSwipeRight={isSwipeEnabled ? handleBack : undefined}
        enabled={isSwipeEnabled}
      >
      <StickyFlowPage
        topHeader={<Header standalone showBackToDashboard />}
        flowHeader={{
          // Only show flow header content on mobile - desktop shows it in the main content area
          kicker: isMobile ? tSelfieHeader('kicker', { default: 'Get the best results' }) : undefined,
          title: isMobile ? tSelfieHeader('title', { default: 'Selfie tips for amazing photos' }) : '',
          subtitle: isMobile ? tSelfieHeader('body', { default: 'Great photos start with great selfies.' }) : undefined,
          showBack: isMobile,
          onBack: handleBack
        }}
        maxWidth="full"
        background="white"
        bottomPadding="lg"
        fixedHeaderOnMobile
        mobileHeaderSpacerHeight={80}
        contentClassName="py-0"
      >
        <SelfieTipsContent
          variant="swipe"
          onSkip={handleDontShow}
          onContinue={handleContinue}
          hideBottomActions
        />

        {/* Mobile: Space for sticky footer */}
        <div className="md:hidden h-40" />
      </StickyFlowPage>

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
              <span className="text-sm font-medium">{tSelfieHeader('prevLabel', { default: 'Dashboard' })}</span>
            </button>

            {/* Don't show again (centered) */}
            <button
              type="button"
              onClick={handleDontShow}
              disabled={isSavingPreference}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
            >
              {tSelfieHeader('skip', { default: "Don't show again" })}
            </button>

            {/* Forward (to Selfies) */}
            <button
              type="button"
              onClick={handleContinue}
              className="flex items-center gap-2 pl-4 pr-3 h-11 rounded-full bg-brand-primary text-white shadow-sm hover:brightness-110 transition"
            >
              <span className="text-sm font-medium">{tSelfieHeader('nextLabel', { default: 'Selfies' })}</span>
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
    </SwipeableContainer>
    </>
  )
}

