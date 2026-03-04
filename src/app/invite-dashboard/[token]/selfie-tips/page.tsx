'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import SelfieTipsContent from '@/components/generation/SelfieTipsContent'
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
import { useInviteFlowNavigation } from '@/hooks/useInviteFlowNavigation'
import { useInviteStats } from '@/hooks/useInviteStats'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { useScrollThreshold } from '@/hooks/useScrollThreshold'
import type { InviteDashboardStats } from '@/types/invite'
import { useHideScreen } from '@/hooks/useHideScreen'

type InviteCreditStats = Pick<InviteDashboardStats, 'creditsRemaining'>

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
  const params = useParams()
  const token = params.token as string
  const navigation = useInviteFlowNavigation(token)
  const tContent = useTranslations('customization.photoStyle.mobile.selfieTips')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const {
    markSeenSelfieTips,
    hydrated,
    hasCompletedBeautification,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps
  } = useInviteGenerationFlowState({
    token,
    syncBeautificationFromSession: true,
  })
  const { context, updateContext } = useOnboardingState()

  // Track scroll state for header transition (mobile only)
  const isScrolled = useScrollThreshold(60, isMobile)

  // Load selfie count for progress dock
  const { selectedIds } = useSelfieSelection({ token })
  const { stats } = useInviteStats<InviteCreditStats>(token, {
    initialStats: { creditsRemaining: 0 },
  })

  // Build step indicator for selfie tips (before selfie selection, so step 0)
  const hasEnoughSelfies = selectedIds.length >= MIN_SELFIES_REQUIRED
  const {
    stepperTotalDots,
    navCurrentIndex,
    navigationStepColors,
  } = buildNormalStepIndicator(customizationStepsMeta, {
    selfieComplete: hasEnoughSelfies,
    beautificationComplete: hasCompletedBeautification,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps,
    currentStep: 'selfies',
    hideCurrentStep: true,
  })

  const handleContinue = () => {
    markSeenSelfieTips()
    navigation.toSelfies()
  }

  const { handleHideScreen: handleSkip } = useHideScreen('selfie-tips', {
    context,
    updateContext,
    token,
    onComplete: () => {
      markSeenSelfieTips()
      navigation.toSelfies()
    },
    onErrorLogPrefix: '[InviteSelfieTipsPage] Failed to persist skip preference',
  })

  const handleBack = () => {
    navigation.toDashboard()
  }

  // Navigation handlers for FlowProgressDock
  const handleNavigateToSelfies = () => {
    markSeenSelfieTips()
    navigation.toSelfies()
  }

  const handleNavigateToCustomize = () => {
    if (hasEnoughSelfies) {
      navigation.toBeautification()
      return
    }
    navigation.toSelfies()
  }

  // Show skeleton while hydrating
  if (!hydrated) {
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
          onDashboardBack={handleBack}
          creditsRemaining={stats.creditsRemaining}
          photosAffordable={calculatePhotosFromCredits(stats.creditsRemaining)}
          flowHeader={{
            kicker: tContent('kicker', { default: 'Get the best results' }),
            title: tContent('title', { default: 'Selfie tips for amazing photos' }),
            onBack: handleBack,
          }}
        />

        {/* Content - wider on desktop */}
        <div className="max-w-7xl mx-auto w-full">
          <div className="md:pt-4 md:pb-52">
            <SelfieTipsContent
              variant="swipe"
            />
          </div>

          {/* Mobile: Space for sticky footer */}
          <div className="md:hidden h-40" />
        </div>

        <CustomizationMobileFooter
          leftAction={{
            label: tContent('prevLabel', { default: 'Dashboard' }),
            onClick: handleBack,
          }}
          centerAction={{
            label: tContent('skip', { default: "Don't show again" }),
            onClick: handleSkip,
          }}
          rightAction={{
            label: tContent('nextLabel', { default: 'Selfies' }),
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

        {/* Desktop: FlowProgressDock */}
        {!isMobile && (
          <FlowProgressDock
            selfieCount={selectedIds.length}
            hasUneditedFields={!customizationComplete}
            hasEnoughCredits={hasEnoughCredits}
            currentStep="tips"
            onNavigateToPreviousStep={handleBack}
            onNavigateToSelfieStep={handleNavigateToSelfies}
            onNavigateToCustomize={handleNavigateToCustomize}
            onGenerate={handleNavigateToCustomize}
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
