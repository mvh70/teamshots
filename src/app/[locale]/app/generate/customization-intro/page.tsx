'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import CustomizationIntroContent from '@/components/generation/CustomizationIntroContent'
import { FlowLayout } from '@/components/generation/layout'
import { SwipeableContainer, FlowNavigation } from '@/components/generation/navigation'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { buildSelfieStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { useEffect } from 'react'

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
  const t = useTranslations('generation.flow')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const {
    markSeenCustomizationIntro,
    hasSeenCustomizationIntro,
    hydrated,
    flags,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    setPendingGeneration
  } = useGenerationFlowState()

  // Build step indicator for customization intro (after selfie selection, so selfie is complete)
  const selfieStepIndicator = buildSelfieStepIndicator(customizationStepsMeta, {
    selfieComplete: true,
    isDesktop: !isMobile
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
  // If coming from selfie selection, always show the intro page
  useEffect(() => {
    if (hydrated && hasSeenCustomizationIntro && !flags.pendingGeneration) {
      router.replace('/app/generate/start')
    }
  }, [hydrated, hasSeenCustomizationIntro, flags.pendingGeneration, router])

  const handleContinue = () => {
    markSeenCustomizationIntro()
    router.push('/app/generate/start?skipUpload=1')
  }

  // Don't render while checking or if redirecting (but allow rendering if coming from selfie selection)
  if (!hydrated || (hasSeenCustomizationIntro && !flags.pendingGeneration)) {
    return null
  }

  const handleBack = () => {
    router.push('/app/generate/selfie')
  }

  return (
    <SwipeableContainer
      onSwipeLeft={isSwipeEnabled ? handleContinue : undefined}
      onSwipeRight={isSwipeEnabled ? handleBack : undefined}
      enabled={isSwipeEnabled}
    >
      <FlowLayout
        maxWidth="2xl"
        background="white"
        bottomPadding={isMobile ? 'lg' : 'none'}
      >
        <div className="py-8 md:py-12">
          <CustomizationIntroContent 
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
            canGoPrev={true}
            stepColors={navigationStepColors}
          />
        </div>
      </FlowLayout>
    </SwipeableContainer>
  )
}

