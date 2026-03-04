'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import CustomizationIntroContent from '@/components/generation/CustomizationIntroContent'
import { StickyFlowPage } from '@/components/generation/layout'
import { SwipeableContainer, FlowNavigation, FlowProgressDock, CustomizationMobileFooter } from '@/components/generation/navigation'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { buildNormalStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { useEffect, useRef } from 'react'
import Header from '@/app/[locale]/(product)/app/components/Header'
import { useOnboardingState } from '@/lib/onborda/hooks'
import { useHideScreen } from '@/hooks/useHideScreen'

/**
 * Customization intro page for logged-in users.
 * 
 * Flow: /app/generate/selfie → /app/generate/beautification → /app/generate/customization-intro → /app/generate/start
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
    setPendingGeneration,
    hasSeenCustomizationIntro,
    hasCompletedBeautification,
    hydrated,
    flags,
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
  const skipCustomizationIntro = !forceShow && context.hiddenScreens?.includes('customization-intro')

  // Build step indicator for customization intro (after selfie selection, so selfie is complete)
  const { stepperTotalDots, navCurrentIndex, navigationStepColors } = buildNormalStepIndicator(customizationStepsMeta, {
    selfieComplete: true,
    beautificationComplete: hasCompletedBeautification,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps,
    currentStep: 'customization',
    hideCurrentStep: true,
  })

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
      setPendingGeneration(false)
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
    setPendingGeneration,
    searchParams
  ])

  const handleContinue = () => {
    markSeenCustomizationIntro()
    setPendingGeneration(false)
    router.push('/app/generate/start?skipUpload=1')
  }

  const { handleHideScreen: handleDontShow, isSaving: isSavingPreference } = useHideScreen('customization-intro', {
    context,
    updateContext,
    onComplete: handleContinue,
    onErrorLogPrefix: '[CustomizationIntroPage] Failed to persist skip preference',
  })

  // Don't render while checking or if redirecting (but allow rendering if force=1 or coming from selfie selection)
  const shouldRedirect =
    !forceShow && (skipCustomizationIntro || (hasSeenCustomizationIntro && !flags.pendingGeneration))

  if (!hydrated || !context._loaded || shouldRedirect) {
    return null
  }

  const handleBack = () => {
    router.push('/app/generate/beautification')
  }

  return (
    <>
      {/* Progress Dock - Bottom Center (Desktop) */}
      {!isMobile && (
        <FlowProgressDock
          selfieCount={selfieCount}
          hasUneditedFields={true} // All fields are unedited at this point
          hasEnoughCredits={true}
          currentStep="intro"
          onNavigateToPreviousStep={() => router.push('/app/generate/beautification')}
          onNavigateToCustomize={handleContinue}
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

      <CustomizationMobileFooter
        leftAction={{
          label: tIntro('prevLabel', { default: 'Beautification' }),
          onClick: handleBack,
        }}
        centerAction={{
          label: tIntro('skip', { default: "Don't show again" }),
          onClick: handleDontShow,
          disabled: isSavingPreference,
        }}
        rightAction={{
          label: tIntro('nextLabel', { default: 'Customize' }),
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
