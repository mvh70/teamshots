'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Header from '@/app/[locale]/(product)/app/components/Header'
import BeautificationStep from '@/components/generation/beautification/BeautificationStep'
import { StickyFlowPage } from '@/components/generation/layout'
import { CustomizationMobileFooter, FlowProgressDock, StandardThreeStepIndicator, SwipeableContainer } from '@/components/generation/navigation'
import { Toast } from '@/components/ui'
import { MIN_SELFIES_REQUIRED, hasEnoughSelfies } from '@/constants/generation'
import { useAccessoriesLoader } from '@/hooks/useAccessoriesLoader'
import { useBeautificationDefaults } from '@/hooks/useBeautificationDefaults'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { buildNormalStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'

export default function BeautificationPage() {
  const router = useRouter()
  const t = useTranslations('customization.photoStyle.mobile')
  const tNav = useTranslations('generation.progressDock.navigation')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const {
    hydrated,
    setCompletedBeautification,
    setPendingGeneration,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps,
  } = useGenerationFlowState({ syncBeautificationFromSession: true })

  const selfieManager = useSelfieManagement({ autoSelectNewUploads: false })
  const selectedCount = selfieManager.mode === 'individual' ? selfieManager.selectedIds.length : 0
  const hasLoadedSelection = selfieManager.hasLoadedSelection
  const canProceed = hasEnoughSelfies(selectedCount)

  const { value, setValue, persistDraftToSession } = useBeautificationDefaults({
    defaultsEndpoint: '/api/person/beautification',
    enabled: hydrated,
  })
  const { accessories, isLoading: isLoadingAccessories } = useAccessoriesLoader({
    endpoint: '/api/person/accessories',
    enabled: hydrated,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!hydrated || !hasLoadedSelection) return
    if (selectedCount >= MIN_SELFIES_REQUIRED) return
    router.replace('/app/generate/selfie')
  }, [hydrated, hasLoadedSelection, selectedCount, router])

  const handleBack = useCallback(() => {
    setCompletedBeautification(false)
    router.push('/app/generate/selfie')
  }, [router, setCompletedBeautification])

  const handleContinue = useCallback(async () => {
    if (!canProceed || isSaving) return
    setIsSaving(true)
    try {
      const response = await fetch('/api/person/beautification', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaults: value }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setToastMessage(payload?.error || t('beautification.saveFailed', { default: 'Failed to save beautification settings. Please try again.' }))
        return
      }

      persistDraftToSession(value)
      setCompletedBeautification(true)
      setPendingGeneration(false)
      router.push('/app/generate/customization-intro')
    } finally {
      setIsSaving(false)
    }
  }, [canProceed, isSaving, persistDraftToSession, router, setCompletedBeautification, setPendingGeneration, t, value])

  const { stepperTotalDots, navCurrentIndex, navigationStepColors } = useMemo(
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

  if (!hydrated || !hasLoadedSelection) {
    return null
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
      {!isMobile && (
        <FlowProgressDock
          selfieCount={selectedCount}
          hasUneditedFields={false}
          hasEnoughCredits={true}
          currentStep="beautification"
          onNavigateToPreviousStep={handleBack}
          onNavigateToCustomize={handleContinue}
          onNavigateToDashboard={() => router.push('/app/dashboard')}
          customizationStepsMeta={customizationStepsMeta}
          visitedEditableSteps={visitedSteps}
        />
      )}

      <SwipeableContainer
        onSwipeLeft={isSwipeEnabled && canProceed ? handleContinue : undefined}
        onSwipeRight={isSwipeEnabled ? handleBack : undefined}
        enabled={isSwipeEnabled}
      >
        <StickyFlowPage
          topHeader={<Header standalone showBackToDashboard />}
          flowHeader={{
            title: isMobile ? t('beautification.title', { default: 'Beautification' }) : '',
            subtitle: isMobile ? t('beautification.subtitle', { default: 'Retouching and accessory preferences' }) : undefined,
            showBack: isMobile,
            onBack: handleBack,
          }}
          maxWidth="full"
          background="white"
          fixedHeaderOnMobile
          mobileHeaderSpacerHeight={120}
          contentClassName="px-0 py-0"
        >
          <div className="px-4 sm:px-6 lg:px-8 pt-8 md:pt-10 pb-52">
            <div className="hidden md:block mb-8 space-y-3">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-[1.1] font-serif tracking-tight">
                {t('beautification.title', { default: 'Beautification' })}
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed max-w-3xl">
                {t('beautification.subtitle', { default: 'Retouching and accessory preferences' })}
              </p>
            </div>

            <div className="max-w-2xl">
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

          <div className="md:hidden h-40" />
        </StickyFlowPage>

        <CustomizationMobileFooter
          leftAction={{
            label: tNav('selfies', { default: 'Selfies' }),
            onClick: handleBack
          }}
          rightAction={{
            label: tNav('customize', { default: 'Customize' }),
            onClick: handleContinue,
            disabled: !canProceed || isSaving,
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
      </SwipeableContainer>
    </>
  )
}
