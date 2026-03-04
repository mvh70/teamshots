'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import BeautificationStep from '@/components/generation/beautification/BeautificationStep'
import { StickyFlowPage } from '@/components/generation/layout'
import { CustomizationMobileFooter, FlowProgressDock, StandardThreeStepIndicator, SwipeableContainer } from '@/components/generation/navigation'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import FlowPageSkeleton from '@/components/generation/loading/FlowPageSkeleton'
import { Toast } from '@/components/ui'
import { MIN_SELFIES_REQUIRED, hasEnoughSelfies } from '@/constants/generation'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { useAccessoriesLoader } from '@/hooks/useAccessoriesLoader'
import { useBeautificationDefaults } from '@/hooks/useBeautificationDefaults'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { buildNormalStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { isAbortError } from '@/lib/errors'
import { useInviteGenerationFlowState } from '@/hooks/useInviteGenerationFlowState'
import { useInviteFlowNavigation } from '@/hooks/useInviteFlowNavigation'
import { useInviteStats } from '@/hooks/useInviteStats'
import type { InviteDashboardStats } from '@/types/invite'

export default function InviteBeautificationPage() {
  const params = useParams()
  const token = params.token as string
  const navigation = useInviteFlowNavigation(token)
  const tNav = useTranslations('generation.progressDock.navigation')
  const tBeautification = useTranslations('beautification')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const { stats } = useInviteStats<Pick<InviteDashboardStats, 'creditsRemaining' | 'teamName'>>(token, {
    initialStats: { creditsRemaining: 0, teamName: '' },
  })
  const {
    hydrated,
    setCompletedBeautification,
    setPendingGeneration,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps,
  } = useInviteGenerationFlowState({
    token,
    syncBeautificationFromSession: true,
  })
  const { selectedIds, hasLoaded } = useSelfieSelection({ token })
  const selectedCount = selectedIds.length
  const canProceed = hasEnoughSelfies(selectedCount)
  const styleSettingsScope = useMemo(() => `invite_${token}`, [token])

  const defaultsEndpoint = useMemo(
    () => `/api/team/member/beautification?token=${encodeURIComponent(token)}`,
    [token]
  )
  const accessoriesEndpoint = useMemo(
    () => `/api/team/member/accessories?token=${encodeURIComponent(token)}`,
    [token]
  )
  const { value, setValue, isLoadingDefaults, persistDraftToSession } = useBeautificationDefaults({
    defaultsEndpoint,
    scope: styleSettingsScope,
    enabled: hydrated,
  })
  const { accessories, isLoading: isLoadingAccessories } = useAccessoriesLoader({
    endpoint: accessoriesEndpoint,
    enabled: hydrated,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const continueAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!hydrated || !hasLoaded) return
    if (selectedCount >= MIN_SELFIES_REQUIRED) return
    navigation.replaceSelfies()
  }, [hydrated, hasLoaded, navigation, selectedCount])

  useEffect(() => {
    return () => {
      continueAbortRef.current?.abort()
    }
  }, [])

  const handleBack = useCallback(() => {
    setCompletedBeautification(false)
    navigation.toSelfies()
  }, [navigation, setCompletedBeautification])

  const handleContinue = useCallback(async () => {
    if (!canProceed || isSaving) return
    continueAbortRef.current?.abort()
    const controller = new AbortController()
    continueAbortRef.current = controller
    setIsSaving(true)
    try {
      const response = await fetch(`/api/team/member/beautification?token=${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaults: value }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setToastMessage(payload?.error || 'Failed to save beautification settings. Please try again.')
        return
      }

      persistDraftToSession(value)
      setCompletedBeautification(true)
      setPendingGeneration(false)
      navigation.toCustomizationIntro()
    } catch (error) {
      if (!isAbortError(error)) {
        setToastMessage('Failed to save beautification settings. Please try again.')
      }
    } finally {
      setIsSaving(false)
      if (continueAbortRef.current === controller) {
        continueAbortRef.current = null
      }
    }
  }, [canProceed, isSaving, navigation, persistDraftToSession, setCompletedBeautification, setPendingGeneration, token, value])

  const {
    stepperTotalDots,
    navCurrentIndex,
    navigationStepColors,
  } = useMemo(
    () =>
      buildNormalStepIndicator(customizationStepsMeta, {
        selfieComplete: canProceed,
        beautificationComplete: false,
        isDesktop: !isMobile,
        visitedCustomizationSteps: visitedSteps,
        currentStep: 'beautification',
      }),
    [customizationStepsMeta, canProceed, isMobile, visitedSteps]
  )

  if (!hydrated || isLoadingDefaults || !hasLoaded) {
    return <FlowPageSkeleton variant="content" />
  }

  return (
    <>
      {toastMessage ? (
        <Toast
          message={toastMessage}
          type="error"
          onDismiss={() => setToastMessage(null)}
        />
      ) : null}
      <SwipeableContainer
        onSwipeLeft={isSwipeEnabled && canProceed ? handleContinue : undefined}
        onSwipeRight={isSwipeEnabled ? handleBack : undefined}
        enabled={isSwipeEnabled}
      >
        <StickyFlowPage
          topHeader={
            <InviteDashboardHeader
              token={token}
              showBackToDashboard
              hideTitle
              teamName={stats.teamName}
              onBackClick={navigation.toDashboard}
              creditsRemaining={stats.creditsRemaining}
              photosAffordable={calculatePhotosFromCredits(stats.creditsRemaining)}
            />
          }
          flowHeader={{
            title: tBeautification('title', { default: 'Beautification' }),
            subtitle: tBeautification('subtitle', {
              default: 'Retouching and accessory preferences',
            }),
            showBack: true,
            onBack: handleBack,
            hideOnDesktop: true,
          }}
          showTopOnDesktop
          maxWidth="full"
          contentClassName="px-0 py-0"
          bottomPadding="none"
          mobileHeaderSpacerHeight={120}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-52">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="hidden md:block px-6 sm:px-8 pt-6 pb-5 border-b border-gray-100">
                <h2 className="text-lg md:text-2xl font-semibold text-gray-900">
                  {tBeautification('title', { default: 'Beautification' })}
                </h2>
                <p className="mt-1 text-sm md:text-base text-gray-600 leading-relaxed max-w-3xl">
                  {tBeautification('subtitle', {
                    default: 'Set your preferred retouching level and choose whether to keep or remove detected accessories.',
                  })}
                </p>
              </div>

              <div className="p-6 sm:p-8">
                <BeautificationStep
                  value={value}
                  onChange={(next) => {
                    setValue(next)
                    persistDraftToSession(next)
                  }}
                  accessories={accessories}
                  isLoadingAccessories={isLoadingAccessories}
                />
              </div>
            </div>
          </div>

          <div className="md:hidden h-40" />
        </StickyFlowPage>

        {isMobile && (
          <CustomizationMobileFooter
            leftAction={{
              label: tNav('selfies', { default: 'Selfies' }),
              onClick: handleBack
            }}
            rightAction={{
              label: tNav('customize', { default: 'Customize' }),
              onClick: handleContinue,
              disabled: !canProceed || isSaving,
              loading: isSaving,
              tone: 'primary',
              icon: 'chevron-right'
            }}
            progressContent={
              <StandardThreeStepIndicator
                className="pb-3"
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

        {!isMobile && (
          <FlowProgressDock
            selfieCount={selectedCount}
            hasUneditedFields={false}
            hasEnoughCredits={calculatePhotosFromCredits(stats.creditsRemaining) > 0}
            currentStep="beautification"
            onNavigateToPreviousStep={handleBack}
            onNavigateToCustomize={handleContinue}
            onGenerate={handleContinue}
            onNavigateToDashboard={navigation.toDashboard}
            customizationStepsMeta={customizationStepsMeta}
            visitedEditableSteps={visitedSteps}
          />
        )}
      </SwipeableContainer>
    </>
  )
}
