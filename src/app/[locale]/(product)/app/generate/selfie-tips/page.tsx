'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import SelfieTipsContent from '@/components/generation/SelfieTipsContent'
import { StickyFlowPage } from '@/components/generation/layout'
import { SwipeableContainer, FlowNavigation, FlowProgressDock, CustomizationMobileFooter } from '@/components/generation/navigation'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { buildNormalStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import Header from '@/app/[locale]/(product)/app/components/Header'
import { useOnboardingState } from '@/lib/onborda/hooks'
import { useEffect, useRef, useCallback } from 'react'
import { preloadFaceDetectionModel } from '@/lib/face-detection'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'
import { useHideScreen } from '@/hooks/useHideScreen'

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
  const {
    markSeenSelfieTips,
    hydrated,
    hasCompletedBeautification,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps
  } = useGenerationFlowState({ syncBeautificationFromSession: true })
  const { context, updateContext } = useOnboardingState()
  const hasAutoSkippedRef = useRef(false)

  // Get selfie count for the progress dock
  const selfieManager = useSelfieManagement({ autoSelectNewUploads: false })
  const selfieCount = selfieManager.mode === 'individual' ? selfieManager.selectedIds.length : 0

  // Check if force parameter is set (from info icon click) - always show when forced
  const forceShow = searchParams.get('force') === '1'

  // Build step indicator for selfie tips (before selfie selection, so step 0)
  const { stepperTotalDots, navCurrentIndex, navigationStepColors } = buildNormalStepIndicator(customizationStepsMeta, {
    selfieComplete: false,
    beautificationComplete: hasCompletedBeautification,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps,
    currentStep: 'selfies',
    hideCurrentStep: true,
  })

  const handleContinue = useCallback(() => {
    markSeenSelfieTips()
    router.push('/app/generate/selfie')
  }, [markSeenSelfieTips, router])

  const { handleHideScreen: handleDontShow, isSaving: isSavingPreference } = useHideScreen('selfie-tips', {
    context,
    updateContext,
    onComplete: handleContinue,
    onErrorLogPrefix: '[SelfieTipsPage] Failed to persist skip preference',
  })

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
      {!isMobile && (
        <FlowProgressDock
          selfieCount={selfieCount}
          hasUneditedFields={false}
          hasEnoughCredits={true}
          currentStep="tips"
          onNavigateToPreviousStep={handleBack}
          onNavigateToSelfieStep={handleContinue}
          onNavigateToCustomize={() => {
            if (selfieCount >= MIN_SELFIES_REQUIRED) {
              router.push('/app/generate/beautification')
              return
            }
            router.push('/app/generate/selfie')
          }}
          onNavigateToDashboard={() => router.push('/app/dashboard')}
          customizationStepsMeta={customizationStepsMeta}
          visitedEditableSteps={visitedSteps}
          onDontShowAgain={handleDontShow}
        />
      )}

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

      <CustomizationMobileFooter
        leftAction={{
          label: tSelfieHeader('prevLabel', { default: 'Dashboard' }),
          onClick: handleBack,
        }}
        centerAction={{
          label: tSelfieHeader('skip', { default: "Don't show again" }),
          onClick: handleDontShow,
          disabled: isSavingPreference,
        }}
        rightAction={{
          label: tSelfieHeader('nextLabel', { default: 'Selfies' }),
          onClick: handleContinue,
          tone: 'primary',
          icon: 'chevron-right',
        }}
        progressContent={
          <FlowNavigation
            variant="dots-only"
            size="md"
            current={navCurrentIndex}
            total={Math.max(1, stepperTotalDots)}
            onPrev={handleBack}
            onNext={handleContinue}
            stepColors={navigationStepColors}
          />
        }
      >
        {null}
      </CustomizationMobileFooter>
    </SwipeableContainer>
    </>
  )
}
