'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useRef, useEffect, useTransition, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SelectableGrid } from '@/components/generation/selection'
import { SwipeableContainer, FlowProgressDock, SelfieNavButtons, StandardThreeStepIndicator } from '@/components/generation/navigation'
import { LoadingGrid, Toast } from '@/components/ui'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import dynamic from 'next/dynamic'
import { StickyFlowPage } from '@/components/generation/layout'
import { buildNormalStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { MIN_SELFIES_REQUIRED, hasEnoughSelfies } from '@/constants/generation'
import SharedMobileSelfieFlow from '@/components/generation/selfie/SharedMobileSelfieFlow'
import Header from '@/app/[locale]/(product)/app/components/Header'
import { QRPlaceholder } from '@/components/MobileHandoff'
import { useOnboardingState } from '@/lib/onborda/hooks'
import SelfieTypeOverlay, { useSelfieTypeStatus } from '@/components/Upload/SelfieTypeOverlay'
import { useClassificationQueue } from '@/hooks/useClassificationQueue'
import { buildSelfieStatusBadge } from '@/components/generation/selfie/SelfieStatusBadge'
import { mapSessionSelfiesToGridItems } from '@/lib/selfieGridItems'

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

/**
 * Selfie selection page for logged-in users.
 * 
 * Flow: /app/generate/selfie-tips → /app/generate/selfie → /app/generate/beautification → /app/generate/customization-intro → /app/generate/start
 * 
 * Users select existing selfies or upload new ones before proceeding to customization.
 */
function SelfieSelectionPageContent() {
  const t = useTranslations('generate.selfie')
  const tSelection = useTranslations('inviteDashboard.selfieSelection.mobile')
  const router = useRouter()
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const {
    markInFlow,
    setPendingGeneration,
    setCompletedBeautification,
    hasCompletedBeautification,
    hydrated,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps,
    completedSteps
  } = useGenerationFlowState({ syncBeautificationFromSession: true })
  const [isNavigating, startNavigateTransition] = useTransition()
  const { context: onboardingContext } = useOnboardingState()
  const { refreshKey: selfieTypeRefreshKey, refresh: refreshSelfieTypeStatus } = useSelfieTypeStatus()
  const classificationQueue = useClassificationQueue()
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  
  const uploadErrorHandler = useCallback((error: string) => {
    // Don't show alert for camera errors - PhotoUpload handles those with a modal
    if (error.includes('Camera') || error.includes('camera')) {
      console.log('Camera error handled by PhotoUpload modal:', error)
      return
    }
    console.error('Selfie upload error:', error)
    setToastMessage(`Error: ${error}`)
  }, [])

  const selfieManager = useSelfieManagement({
    autoSelectNewUploads: true,
    onSelfiesApproved: async () => {
      // Reload selected state to trigger re-render with updated selectedIds
      await loadSelected()
      // Refresh selfie type status overlay to show newly classified selfies
      refreshSelfieTypeStatus()
      // Small delay to allow React to process state updates
      await new Promise(resolve => setTimeout(resolve, 100))
    },
    onUploadError: uploadErrorHandler
  })

  if (selfieManager.mode !== 'individual') {
    throw new Error('Selfie selection page requires individual selfie management mode')
  }

  const { uploads, selectedIds, selectedSet, loading, loadSelected, loadUploads, toggleSelect, handleSelfiesApproved } = selfieManager
  
  // Type assertion: in individual mode, uploads is always UploadListItem[]
  type UploadListItem = {
    id: string
    uploadedKey: string
    createdAt: string
    hasGenerations: boolean
    selfieType?: string | null
    selfieTypeConfidence?: number | null
    personCount?: number | null
    isProper?: boolean | null
    improperReason?: string | null
    lightingQuality?: string | null
    backgroundQuality?: string | null
  }
  const uploadListItems = uploads as UploadListItem[]

  if (!handleSelfiesApproved) {
    throw new Error('Selfie management did not provide handleSelfiesApproved')
  }

  useEffect(() => {
    markInFlow({ pending: true })
  }, [markInFlow])

  // Use a ref to prevent infinite loops
  const isLoadingRef = useRef(false)
  const handleSelectionChange = useCallback(async () => {
    // Only reload if not already loading
    if (isLoadingRef.current) return

    isLoadingRef.current = true
    try {
      await loadSelected()
    } finally {
      // Always reset flag even if error occurs
      isLoadingRef.current = false
    }
  }, [loadSelected])

  // Check if we have at least MIN_SELFIES_REQUIRED selfies selected
  const selectedCount = selectedIds.length
  const canContinue = hasEnoughSelfies(selectedCount)
  const remainingSelfies = Math.max(0, MIN_SELFIES_REQUIRED - selectedCount)
  const { stepperTotalDots, navCurrentIndex, navigationStepColors } = buildNormalStepIndicator(customizationStepsMeta, {
    selfieComplete: canContinue,
    beautificationComplete: hasCompletedBeautification,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps,
    currentStep: 'selfies'
  })

  const handleContinue = () => {
    if (!canContinue || isNavigating) {
      return
    }
    setCompletedBeautification(false)
    setPendingGeneration(true)
    startNavigateTransition(() => {
      router.push('/app/generate/beautification')
    })
  }

  const handleBack = () => {
    router.push('/app/dashboard')
  }

  // Memoize grid items to prevent unnecessary re-renders
  const gridItems = useMemo(() => mapSessionSelfiesToGridItems(uploadListItems), [uploadListItems])

  const selectableGridProps = {
    items: gridItems,
    selection: {
      mode: 'managed' as const,
      onAfterChange: handleSelectionChange
    },
    externalManagedSelection: { selectedSet, toggleSelect },
    allowDelete: false,
    showUploadTile: !isMobile,
    upload: {
      onSelfiesApproved: handleSelfiesApproved,
      onError: uploadErrorHandler
    },
    qrTile: (
      <QRPlaceholder
        size={100}
        className="w-full h-full"
        onSelfieUploaded={async () => {
          await loadUploads()
          await loadSelected()
        }}
      />
    ),
    classificationQueue: classificationQueue as import('@/components/generation/selection/SelectableGrid').ClassificationQueueStatus | undefined
  }

  const navButtonsControls = (
    <SelfieNavButtons
      onBack={handleBack}
      onContinue={handleContinue}
      canContinue={canContinue}
      backLabel={tSelection('prevLabel', { default: 'Dashboard' })}
      continueLabel={tSelection('nextLabel', { default: 'Beautification' })}
    />
  )

  const navigationControls = (
    <StandardThreeStepIndicator
      currentIndex={navCurrentIndex}
      totalSteps={Math.max(1, stepperTotalDots)}
      visitedSteps={navigationStepColors?.visitedEditableSteps}
      lockedSteps={navigationStepColors?.lockedSteps}
    />
  )

  const statusBadgeContent = buildSelfieStatusBadge({
    readyLabel: tSelection('badgeReady', { default: 'Ready to customize' }),
    selectingLabel: tSelection('badgeSelecting', { default: 'Need {remaining} more', remaining: remainingSelfies }),
  })

  const mobileUploadSection = (
    <SelfieUploadFlow
      hideHeader
      buttonLayout="horizontal"
      inline={true}
      onSelfiesApproved={handleSelfiesApproved}
      onCancel={() => {}}
      onError={uploadErrorHandler}
    />
  )

  // Don't render while checking intro state
  if (!hydrated) {
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
      {/* Progress Dock - Bottom Center (Desktop) */}
      {!isMobile && (
        <FlowProgressDock
          selfieCount={selectedCount}
          hasUneditedFields={false}
          hasEnoughCredits={true}
          currentStep="selfies"
          onNavigateToPreviousStep={() => {}} // Already on selfies page
          onNavigateToCustomize={() => {
            if (!canContinue) return
            setCompletedBeautification(false)
            setPendingGeneration(true)
            router.push('/app/generate/beautification')
          }}
          onNavigateToDashboard={() => router.push('/app/dashboard')}
          isGenerating={isNavigating}
          customizationStepsMeta={customizationStepsMeta}
          visitedEditableSteps={completedSteps}
        />
      )}

      <SwipeableContainer
        onSwipeLeft={canContinue ? handleContinue : undefined}
        onSwipeRight={handleBack}
        enabled={isSwipeEnabled}
      >
        <StickyFlowPage
        topHeader={<Header standalone showBackToDashboard />}
        flowHeader={{
          // Only show flow header content on mobile - desktop has step navigation at the bottom
          kicker: isMobile ? tSelection('bannerTitle', { default: 'Select your selfies' }) : undefined,
          title: isMobile ? t('title', { default: 'Choose your selfie' }) : '',
          subtitle: undefined, // Subtitle not needed - info banner provides context
          // Hide step indicator in header on mobile - it's shown in the sticky footer instead
          step: undefined,
          showBack: isMobile,
          onBack: handleBack,
          fullBleed: true
        }}
        maxWidth="full"
        contentClassName="px-0 py-0"
        bottomPadding={isMobile ? 'none' : 'lg'}
        mobileHeaderSpacerHeight={120}
        fixedHeaderOnMobile
      >
        {loading ? (
          <div className="px-4 sm:px-6 lg:px-8 py-8">
            <LoadingGrid cols={4} rows={2} />
          </div>
        ) : (
          <>
            {/* Mobile: unified selfie selection experience */}
            {isMobile && (
              <SharedMobileSelfieFlow
                canContinue={canContinue}
                selfieTypeOverlay={
                  <SelfieTypeOverlay refreshKey={selfieTypeRefreshKey} showTipsHeader />
                }
                grid={<SelectableGrid {...selectableGridProps} />}
                navButtons={navButtonsControls}
                navigation={navigationControls}
                uploadSection={mobileUploadSection}
                statusBadge={statusBadgeContent}
              />
            )}

            {/* Desktop layout */}
            {!isMobile && (
              <div className="px-4 sm:px-6 lg:px-8 pt-8 md:pt-10 pb-52">
                {/* Desktop Page Header - matches intro pages typography */}
                <div className="mb-8 space-y-3">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-[1.1] font-serif tracking-tight">
                    {t('title')}
                  </h1>
                  <p className="text-lg text-gray-600 leading-relaxed max-w-3xl">
                    {t('subtitle')}
                  </p>
                </div>
                
                {/* Selfie Type Progress with Tips */}
                <SelfieTypeOverlay
                  refreshKey={selfieTypeRefreshKey}
                  showTipsHeader
                  className="max-w-xl mb-6"
                />
                
                <SelectableGrid {...selectableGridProps} />
              </div>
            )}
          </>
        )}
      </StickyFlowPage>
    </SwipeableContainer>
    </>
  )
}

export default function SelfieSelectionPage() {
  return <SelfieSelectionPageContent />
}
