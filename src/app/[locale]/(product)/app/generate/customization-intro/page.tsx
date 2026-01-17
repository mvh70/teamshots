'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import CustomizationIntroContent from '@/components/generation/CustomizationIntroContent'
import { StickyFlowPage } from '@/components/generation/layout'
import { SwipeableContainer, FlowNavigation, FlowProgressDock } from '@/components/generation/navigation'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { buildSelfieStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { useEffect, useRef, useState } from 'react'
import Header from '@/app/[locale]/(product)/app/components/Header'
import { useOnboardingState } from '@/lib/onborda/hooks'

/**
 * Customization intro page for logged-in users.
 * 
 * Flow: /app/generate/selfie → /app/generate/customization-intro → /app/generate/start
 * 
 * This page explains the customization options before users see them.
 * On mobile: Full-screen with swipe left to continue
 * On desktop: Card layout with continue button
 */
export default function CustomizationIntroPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tIntro = useTranslations('customization.photoStyle.mobile.intro')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const {
    markSeenCustomizationIntro,
    hasSeenCustomizationIntro,
    hydrated,
    flags,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps
  } = useGenerationFlowState()
  const { context, updateContext } = useOnboardingState()
  const [isSavingPreference, setIsSavingPreference] = useState(false)
  const hasAutoSkippedRef = useRef(false)

  // Get selfie count for the progress dock
  const selfieManager = useSelfieManagement({ autoSelectNewUploads: false })
  const selfieCount = selfieManager.mode === 'individual' ? selfieManager.selectedIds.length : 0

  // Check if force parameter is set (from info icon click) - always show when forced
  const forceShow = searchParams.get('force') === '1'
  const skipCustomizationIntro = !forceShow && context.hiddenScreens?.includes('customization-intro')

  // Build step indicator for customization intro (after selfie selection, so selfie is complete)
  const selfieStepIndicator = buildSelfieStepIndicator(customizationStepsMeta, {
    selfieComplete: true,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps
  })
  const stepperTotalDots = selfieStepIndicator.totalWithLocked ?? selfieStepIndicator.total
  // Info pages are not part of the steps, so use -1 to not highlight any step as current
  // But show selfie step as visited (green) since it's complete
  const navCurrentIndex = -1
  const navigationStepColors = selfieStepIndicator.lockedSteps || selfieStepIndicator.visitedEditableSteps
    ? {
        lockedSteps: selfieStepIndicator.lockedSteps,
        visitedEditableSteps: selfieStepIndicator.visitedEditableSteps
      }
    : undefined

  // Only redirect if already seen AND not coming from selfie selection (pendingGeneration flag)
  // If coming from selfie selection or force=1, always show the intro page
  useEffect(() => {
    // Never auto-skip if force parameter is set (user clicked info icon)
    // Check directly from searchParams inside effect to avoid stale closure issues
    const isForced = searchParams.get('force') === '1'
    if (isForced) return

    const shouldSkip =
      skipCustomizationIntro ||
      (hasSeenCustomizationIntro && !flags.pendingGeneration)

    if (hydrated && context._loaded && shouldSkip && !hasAutoSkippedRef.current) {
      hasAutoSkippedRef.current = true
      if (skipCustomizationIntro && !hasSeenCustomizationIntro) {
        markSeenCustomizationIntro()
      }
      router.replace('/app/generate/start?skipUpload=1')
    }
  }, [
    hydrated,
    hasSeenCustomizationIntro,
    skipCustomizationIntro,
    context._loaded,
    flags.pendingGeneration,
    router,
    markSeenCustomizationIntro,
    searchParams
  ])

  const handleContinue = () => {
    markSeenCustomizationIntro()
    router.push('/app/generate/start?skipUpload=1')
  }

  const handleDontShow = async () => {
    if (isSavingPreference) return
    setIsSavingPreference(true)
    try {
      const response = await fetch('/api/onboarding/hide-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenName: 'customization-intro' })
      })
      const data = await response.json().catch(() => ({}))
      const updatedHiddenScreens = Array.from(
        new Set([...(context.hiddenScreens || []), ...(data.hiddenScreens || ['customization-intro'])])
      )
      updateContext({ hiddenScreens: updatedHiddenScreens })
    } catch (error) {
      console.error('[CustomizationIntroPage] Failed to persist skip preference', error)
    } finally {
      setIsSavingPreference(false)
      handleContinue()
    }
  }

  // Don't render while checking or if redirecting (but allow rendering if force=1 or coming from selfie selection)
  const shouldRedirect =
    !forceShow && (skipCustomizationIntro || (hasSeenCustomizationIntro && !flags.pendingGeneration))

  if (!hydrated || !context._loaded || shouldRedirect) {
    return null
  }

  const handleBack = () => {
    router.push('/app/generate/selfie')
  }

  return (
    <>
      {/* Progress Dock - Bottom Center (Desktop) */}
      <FlowProgressDock
        selfieCount={selfieCount}
        uneditedFields={[]}
        hasUneditedFields={true} // All fields are unedited at this point
        canGenerate={false}
        hasEnoughCredits={true}
        currentStep="intro"
        onNavigateToSelfies={() => router.push('/app/generate/selfie')}
        onNavigateToCustomize={handleContinue}
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
          kicker: undefined,
          title: isMobile ? tIntro('title', { default: 'Customize your professional headshots' }) : '',
          subtitle: isMobile ? tIntro('subtitle', { default: "You're about to customize how your photos look." }) : undefined,
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
        <CustomizationIntroContent
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
          {/* Single-line navigation: ← | Don't show again | Customize → */}
          <div className="flex items-center justify-between">
            {/* Back (to selfies) */}
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
              onClick={handleDontShow}
              disabled={isSavingPreference}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
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
    </SwipeableContainer>
    </>
  )
}

