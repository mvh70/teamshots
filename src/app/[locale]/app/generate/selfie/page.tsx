'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SelectableGrid } from '@/components/generation/selection'
import { SwipeableContainer, FlowNavigation, FlowProgressDock } from '@/components/generation/navigation'
import { LoadingGrid } from '@/components/ui'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import dynamic from 'next/dynamic'
import { StickyFlowPage } from '@/components/generation/layout'
import { buildSelfieStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { MIN_SELFIES_REQUIRED, hasEnoughSelfies } from '@/constants/generation'
import SharedMobileSelfieFlow from '@/components/generation/selfie/SharedMobileSelfieFlow'
import Header from '@/app/[locale]/app/components/Header'
import { QRPlaceholder } from '@/components/MobileHandoff'
import SelfieInfoOverlayTrigger from '@/components/generation/SelfieInfoOverlayTrigger'
import { useOnboardingState } from '@/lib/onborda/hooks'
import SelfieTypeOverlay, { useSelfieTypeStatus } from '@/components/Upload/SelfieTypeOverlay'

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

/**
 * Selfie selection page for logged-in users.
 * 
 * Flow: /app/generate/selfie-tips → /app/generate/selfie → /app/generate/customization-intro → /app/generate/start
 * 
 * Users select existing selfies or upload new ones before proceeding to customization.
 */
function SelfieSelectionPageContent() {
  const t = useTranslations('generate.selfie')
  const tSelection = useTranslations('inviteDashboard.selfieSelection.mobile')
  const router = useRouter()
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const { markInFlow, setPendingGeneration, hydrated, customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META, visitedSteps } = useGenerationFlowState()
  const [isNavigating, startNavigateTransition] = useTransition()
  const { context: onboardingContext } = useOnboardingState()
  const { refreshKey: selfieTypeRefreshKey, refresh: refreshSelfieTypeStatus } = useSelfieTypeStatus()
  
  
  const uploadErrorHandler = useCallback((error: string) => {
    // Don't show alert for camera errors - PhotoUpload handles those with a modal
    if (error.includes('Camera') || error.includes('camera')) {
      console.log('Camera error handled by PhotoUpload modal:', error)
      return
    }
    console.error('Selfie upload error:', error)
    alert(`Error: ${error}`)
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

  const { uploads, selectedIds, loading, loadSelected, loadUploads, handleSelfiesApproved } = selfieManager
  
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
  const selfieStepIndicator = buildSelfieStepIndicator(customizationStepsMeta, {
    selfieComplete: canContinue,
    isDesktop: !isMobile
  })
  
  const stepperTotalDots = selfieStepIndicator.totalWithLocked ?? selfieStepIndicator.total
  const navCurrentIndex = selfieStepIndicator.currentAllStepsIndex ?? Math.max(0, selfieStepIndicator.current - 1)
  const navigationStepColors = selfieStepIndicator.lockedSteps || selfieStepIndicator.visitedEditableSteps
    ? {
        lockedSteps: selfieStepIndicator.lockedSteps,
        visitedEditableSteps: selfieStepIndicator.visitedEditableSteps
      }
    : undefined

  const handleContinue = () => {
    if (!canContinue || isNavigating) {
      return
    }
    setPendingGeneration(true)
    startNavigateTransition(() => {
      router.push('/app/generate/customization-intro')
    })
  }

  const handleBack = () => {
    router.push('/app/generate/selfie-tips')
  }

  const selectableGridProps = {
    items: uploadListItems.map(u => ({
      id: u.id,
      key: u.uploadedKey,
      url: `/api/files/get?key=${encodeURIComponent(u.uploadedKey)}`,
      uploadedAt: u.createdAt,
      used: u.hasGenerations,
      selfieType: u.selfieType,
      selfieTypeConfidence: u.selfieTypeConfidence,
      isProper: u.isProper ?? undefined,
      improperReason: u.improperReason
    })),
    selection: {
      mode: 'managed' as const,
      onAfterChange: handleSelectionChange
    },
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
    )
  }

  const navigationControls = (
    <FlowNavigation
      variant="both"
      size="sm"
      current={navCurrentIndex}
      total={Math.max(1, stepperTotalDots)}
      onPrev={handleBack}
      onNext={handleContinue}
      canGoPrev={true}
      canGoNext={canContinue}
      stepColors={navigationStepColors}
    />
  )

  const statusBadgeContent = {
    readyContent: (
      <>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {tSelection('badgeReady', { default: 'Ready to customize' })}
      </>
    ),
    selectingContent: (
      <>
        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {tSelection('badgeSelecting', { default: 'Need {remaining} more', remaining: remainingSelfies })}
      </>
    )
  }

  const mobileUploadSection = (
    <SelfieUploadFlow
      hideHeader
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
      {/* Progress Dock - Bottom Center (Desktop) */}
      <FlowProgressDock
        selfieCount={selectedCount}
        uneditedFields={[]}
        hasUneditedFields={false}
        canGenerate={false}
        hasEnoughCredits={true}
        currentStep="selfies"
        onNavigateToSelfies={() => {}} // Already on selfies page
        onNavigateToCustomize={() => {
          // Clicking on customize step always goes directly to customize page
          // (The intro is only shown during flow progression, not direct navigation)
          setPendingGeneration(true)
          router.push('/app/generate/start?skipUpload=1')
        }}
        onGenerate={() => {}} // Not available on this page
        isGenerating={isNavigating}
        hiddenScreens={onboardingContext.hiddenScreens}
        onNavigateToSelfieTips={() => router.push('/app/generate/selfie-tips?force=1')}
        onNavigateToCustomizationIntro={() => router.push('/app/generate/customization-intro?force=1')}
        customizationStepsMeta={customizationStepsMeta}
        visitedEditableSteps={visitedSteps}
      />

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
          step: isMobile ? selfieStepIndicator : undefined,
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
            {isMobile ? (
              <SharedMobileSelfieFlow
                canContinue={canContinue}
                selfieTypeOverlay={
                  <SelfieTypeOverlay refreshKey={selfieTypeRefreshKey} />
                }
                infoBanner={
                  <div className="flex-1">
                    <SelfieInfoOverlayTrigger dense className="w-full" />
                  </div>
                }
                grid={<SelectableGrid {...selectableGridProps} />}
                navigation={navigationControls}
                uploadSection={mobileUploadSection}
                statusBadge={statusBadgeContent}
              />
            ) : (
              <div className="px-4 sm:px-6 lg:px-8 pt-8 md:pt-10 pb-52">
                {/* Selfie Type Progress Overlay */}
                <div className="mb-6 flex justify-center">
                  <SelfieTypeOverlay refreshKey={selfieTypeRefreshKey} />
                </div>
                {/* Desktop Page Header - matches intro pages typography */}
                <div className="mb-8 space-y-3">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-[1.1] font-serif tracking-tight">
                    {t('title')}
                  </h1>
                  <p className="text-lg text-gray-600 leading-relaxed max-w-3xl">
                    {t('subtitle')}
                  </p>
                </div>
                <SelectableGrid {...selectableGridProps} />

                {/* Desktop Continue Button */}
                <div className="pt-8 space-y-3">
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!canContinue || isNavigating}
                    className={`w-full px-8 py-4 text-base font-semibold text-white rounded-xl shadow-lg transform transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${
                      canContinue && !isNavigating
                        ? 'bg-gradient-to-r from-brand-primary via-brand-primary to-indigo-600 hover:shadow-2xl hover:from-brand-primary-hover hover:via-brand-primary-hover hover:to-indigo-700 hover:-translate-y-1 active:translate-y-0'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {isNavigating ? t('continuing', { default: 'Continuing...' }) : t('continueToCustomize', { default: 'Continue to customize' })}
                  </button>
                  {!canContinue && (
                    <p className="text-center text-sm text-gray-500">
                      {t('selectMoreSelfies', { default: 'Select at least {count} selfies to continue', count: MIN_SELFIES_REQUIRED })}
                    </p>
                  )}
                </div>
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
