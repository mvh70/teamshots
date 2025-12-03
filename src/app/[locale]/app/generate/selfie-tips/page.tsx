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

  const handleContinue = () => {
    markSeenSelfieTips()
    router.push('/app/generate/selfie')
  }

  // Don't render until hydration completes to avoid flash
  if (!hydrated) {
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
          kicker: tSelfieHeader('kicker', { default: 'Get the best results' }),
          title: tSelfieHeader('title', { default: 'Selfie tips for amazing photos' }),
          subtitle: tSelfieHeader('body', { default: 'Great photos start with great selfies.' }),
          showBack: true,
          onBack: handleBack
        }}
        maxWidth="2xl"
        background="white"
        bottomPadding={isMobile ? 'lg' : 'none'}
        fixedHeaderOnMobile
        mobileHeaderSpacerHeight={120}
      >
        <div className="py-8 md:py-12">
          <SelfieTipsContent 
            variant="swipe"
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

