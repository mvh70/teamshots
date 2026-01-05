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
import Header from '@/app/[locale]/app/components/Header'
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
    isDesktop: !isMobile
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
    router.back()
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
        hiddenScreens={context.hiddenScreens}
        onNavigateToSelfieTips={() => {}} // Already on selfie tips page
        onNavigateToCustomizationIntro={() => router.push('/app/generate/customization-intro?force=1')}
        customizationStepsMeta={customizationStepsMeta}
        visitedEditableSteps={visitedSteps}
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
        />

        {/* Step navigation - Mobile Only */}
        {isMobile && (
          <div className="pb-8">
            <FlowNavigation
              variant="both"
              size="sm"
              current={navCurrentIndex}
              total={Math.max(1, stepperTotalDots)}
              onPrev={handleBack}
              onNext={handleContinue}
              canGoPrev={false}
              stepColors={navigationStepColors}
            />
          </div>
        )}
      </StickyFlowPage>
    </SwipeableContainer>
    </>
  )
}

