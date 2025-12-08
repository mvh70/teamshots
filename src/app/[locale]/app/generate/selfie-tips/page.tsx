'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import SelfieTipsContent from '@/components/generation/SelfieTipsContent'
import { StickyFlowPage } from '@/components/generation/layout'
import { SwipeableContainer, FlowNavigation } from '@/components/generation/navigation'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { buildSelfieStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import Header from '@/app/[locale]/app/components/Header'
import { useOnboardingState } from '@/lib/onborda/hooks'
import { useEffect, useRef, useState, useCallback } from 'react'

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
  const tSelfieHeader = useTranslations('customization.photoStyle.mobile.selfieTips')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const { markSeenSelfieTips, hydrated, customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META } = useGenerationFlowState()
  const { context, updateContext } = useOnboardingState()
  const [isSavingPreference, setIsSavingPreference] = useState(false)
  const hasAutoSkippedRef = useRef(false)

  const skipSelfieTips = context.hiddenScreens?.includes('selfie-tips')

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
    if (!hydrated || !context._loaded || !skipSelfieTips || hasAutoSkippedRef.current) return
    hasAutoSkippedRef.current = true
    handleContinue()
  }, [hydrated, context._loaded, skipSelfieTips, handleContinue])

  // Don't render until hydration completes to avoid flash
  // Show nothing while loading or if we're about to auto-skip
  if (!hydrated || !context._loaded || skipSelfieTips) {
    return null
  }

  const handleBack = () => {
    router.back()
  }

  return (
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
        bottomPadding={isMobile ? 'lg' : 'none'}
        fixedHeaderOnMobile
        mobileHeaderSpacerHeight={80}
        contentClassName="py-0 sm:py-6"
      >
        <div className="pt-6 md:pt-10">
          <SelfieTipsContent 
            variant="swipe"
            onSkip={handleDontShow}
            onContinue={handleContinue}
          />
        </div>

        {/* Step navigation */}
        <div className="pb-8 md:pb-12">
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
      </StickyFlowPage>
    </SwipeableContainer>
  )
}

