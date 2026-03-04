'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import CustomizationIntroContent from '@/components/generation/CustomizationIntroContent'
import { SwipeableContainer, FlowProgressDock, StandardThreeStepIndicator, CustomizationMobileFooter } from '@/components/generation/navigation'
import InviteFlowStickyHeader from '@/components/invite/InviteFlowStickyHeader'
import FlowPageSkeleton from '@/components/generation/loading/FlowPageSkeleton'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useInviteGenerationFlowState } from '@/hooks/useInviteGenerationFlowState'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { buildNormalStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META, isCustomizationComplete } from '@/lib/customizationSteps'
import { PRICING_CONFIG } from '@/config/pricing'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { useInviteFlowNavigation } from '@/hooks/useInviteFlowNavigation'
import { useInviteStats } from '@/hooks/useInviteStats'
import { useScrollThreshold } from '@/hooks/useScrollThreshold'
import type { InviteDashboardStats } from '@/types/invite'
import { useHideScreen } from '@/hooks/useHideScreen'

type InviteCreditStats = Pick<InviteDashboardStats, 'creditsRemaining'>

/**
 * Customization intro page for invited users.
 *
 * Flow: /invite-dashboard/[token]/selfies → /invite-dashboard/[token]/beautification → /invite-dashboard/[token]/customization-intro → /invite-dashboard/[token]/customization
 *
 * This page explains the customization options before users see them.
 * On mobile: Full-screen with swipe gestures, FlowNavigation at bottom
 * On desktop: Wider layout with FlowProgressDock at bottom center
 */
export default function InviteCustomizationIntroPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const navigation = useInviteFlowNavigation(token)
  const tIntro = useTranslations('customization.photoStyle.mobile.intro')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const {
    markSeenCustomizationIntro,
    setPendingGeneration,
    markInFlow,
    hasCompletedBeautification,
    hydrated,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps
  } = useInviteGenerationFlowState({
    token,
    syncBeautificationFromSession: true,
  })
  const { context, updateContext } = useOnboardingState()

  // Track scroll state for header transition (mobile only)
  const isScrolled = useScrollThreshold(60, isMobile)

  const hasAutoSkippedRef = useRef(false)

  // Check if force parameter is set (from info icon click) - always show when forced
  const forceShow = searchParams.get('force') === '1'
  const skipCustomizationIntro = !forceShow && context.hiddenScreens?.includes('customization-intro')

  // Load selfie count for progress dock
  const { selectedIds } = useSelfieSelection({ token })
  const { stats } = useInviteStats<InviteCreditStats>(token, {
    initialStats: { creditsRemaining: 0 },
  })

  // Auto-skip if customization-intro is hidden (user previously clicked "Don't show again")
  useEffect(() => {
    // Never auto-skip if force parameter is set (user clicked info icon)
    const isForced = searchParams.get('force') === '1'
    if (isForced) return

    if (hydrated && context._loaded && skipCustomizationIntro && !hasAutoSkippedRef.current) {
      hasAutoSkippedRef.current = true
      // Mark as seen in session storage too
      markSeenCustomizationIntro()
      setPendingGeneration(false)
      markInFlow()
      navigation.replaceCustomization()
    }
  }, [hydrated, context._loaded, skipCustomizationIntro, navigation, markSeenCustomizationIntro, setPendingGeneration, markInFlow, searchParams])

  // Build step indicator for customization intro (after selfie selection)
  // Note: hasEnoughSelfies is computed later in the file, so we use selectedIds.length directly here
  const selfieComplete = selectedIds.length >= MIN_SELFIES_REQUIRED
  const {
    stepperTotalDots,
    navCurrentIndex,
    navigationStepColors,
  } = buildNormalStepIndicator(customizationStepsMeta, {
    selfieComplete,
    beautificationComplete: hasCompletedBeautification,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps,
    currentStep: 'customization',
    hideCurrentStep: true,
  })

  const handleContinue = () => {
    // Mark customization intro as seen first
    markSeenCustomizationIntro()
    // Clear pendingGeneration flag since we've completed selfie selection and are moving to customization
    setPendingGeneration(false)
    // Mark as in flow (sets fromGeneration and openStartFlow) so dashboard knows we're continuing
    // Don't pass { pending: true } since we've already cleared pendingGeneration
    markInFlow()
    // Navigate to the customization page (now a separate route)
    navigation.toCustomization()
  }

  const { handleHideScreen: handleSkip, isSaving: isSavingPreference } = useHideScreen('customization-intro', {
    context,
    updateContext,
    token,
    onComplete: () => {
      markSeenCustomizationIntro()
      setPendingGeneration(false)
      markInFlow()
      navigation.toCustomization()
    },
    onErrorLogPrefix: '[CustomizationIntroPage] Failed to persist skip preference',
  })

  const handleBack = () => {
    navigation.toBeautification()
  }

  const goBackToDashboard = () => {
    navigation.toDashboard()
  }

  // Navigation handlers for FlowProgressDock
  const handleNavigateToBeautification = () => {
    navigation.toBeautification()
  }

  const handleNavigateToCustomize = () => {
    markSeenCustomizationIntro()
    setPendingGeneration(false)
    markInFlow()
    navigation.toCustomization()
  }

  // Don't render while checking or if redirecting
  const shouldRedirect = !forceShow && skipCustomizationIntro

  // Show skeleton while hydrating or loading context, or if about to redirect
  if (!hydrated || !context._loaded || shouldRedirect) {
    return <FlowPageSkeleton variant="content" />
  }

  const hasEnoughCredits = stats.creditsRemaining >= PRICING_CONFIG.credits.perGeneration
  // Check if all customization steps have been visited
  // If editableSteps is 0 (admin preset everything), customization is complete
  const customizationComplete = isCustomizationComplete(customizationStepsMeta, visitedSteps)

  return (
    <SwipeableContainer
      onSwipeLeft={isSwipeEnabled ? handleContinue : undefined}
      onSwipeRight={isSwipeEnabled ? handleBack : undefined}
      enabled={isSwipeEnabled}
    >
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <InviteFlowStickyHeader
          token={token}
          isMobile={isMobile}
          isScrolled={isScrolled}
          onDashboardBack={goBackToDashboard}
          creditsRemaining={stats.creditsRemaining}
          photosAffordable={calculatePhotosFromCredits(stats.creditsRemaining)}
          flowHeader={{
            kicker: tIntro('kicker', { default: 'Before you dive in' }),
            title: tIntro('title', { default: 'A quick pit stop before the glow-up' }),
            onBack: handleBack,
          }}
        />

        {/* Content - wider on desktop */}
        <div className="max-w-7xl mx-auto w-full">
          <div className="md:pt-4 md:pb-52">
            <CustomizationIntroContent
              variant="swipe"
            />
          </div>

          {/* Mobile: Space for sticky footer */}
          <div className="md:hidden h-40" />
        </div>

        {isMobile && (
          <CustomizationMobileFooter
            leftAction={{
              label: tIntro('prevLabel', { default: 'Beautification' }),
              onClick: handleBack,
            }}
            centerAction={{
              label: tIntro('skip', { default: "Don't show again" }),
              onClick: handleSkip,
              disabled: isSavingPreference,
            }}
            rightAction={{
              label: tIntro('nextLabel', { default: 'Customize' }),
              onClick: handleContinue,
              tone: 'primary',
              icon: 'chevron-right',
            }}
            progressContent={
              <StandardThreeStepIndicator
                currentIndex={navCurrentIndex}
                totalSteps={Math.max(1, stepperTotalDots)}
                visitedSteps={navigationStepColors?.visitedEditableSteps}
                lockedSteps={navigationStepColors?.lockedSteps}
              />
            }
          >
            {null}
          </CustomizationMobileFooter>
        )}

        {/* Desktop: FlowProgressDock */}
        {!isMobile && (
          <FlowProgressDock
            selfieCount={selectedIds.length}
            hasUneditedFields={!customizationComplete}
            hasEnoughCredits={hasEnoughCredits}
            currentStep="intro"
            onNavigateToPreviousStep={handleNavigateToBeautification}
            onNavigateToCustomize={handleNavigateToCustomize}
            onGenerate={handleContinue}
            onNavigateToDashboard={navigation.toDashboard}
            customizationStepsMeta={customizationStepsMeta}
            visitedEditableSteps={visitedSteps}
            onDontShowAgain={handleSkip}
          />
        )}
      </div>
    </SwipeableContainer>
  )
}
