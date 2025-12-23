'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SelectableGrid } from '@/components/generation/selection'
import { SwipeableContainer, FlowNavigation } from '@/components/generation/navigation'
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
import { ChevronRightIcon } from '@heroicons/react/24/outline'

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
  const { markInFlow, setPendingGeneration, hydrated, customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META } = useGenerationFlowState()
  const [isNavigating, startNavigateTransition] = useTransition()
  
  
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
  type UploadListItem = { id: string; uploadedKey: string; createdAt: string; hasGenerations: boolean }
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
      used: u.hasGenerations
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
      {/* Floating Customization Button - Top Right (Desktop) */}
      {!isMobile && (
        <div className="hidden md:flex fixed top-19 right-8 z-[100] pointer-events-auto">
          <div className={`rounded-xl shadow-lg p-3 min-w-[200px] transition-colors duration-200 ${
            canContinue 
              ? 'bg-gradient-to-br from-green-50 to-emerald-50/50 border border-green-200/60' 
              : 'bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/60'
          }`}>
            {!canContinue ? (
              <div className="mb-2 flex items-start gap-2">
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs text-amber-800 leading-snug flex-1">
                  {t('floatingButton.needMoreSelfies')}
                </p>
              </div>
            ) : (
              <div className="mb-2 flex items-start gap-2">
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs text-green-800 leading-snug flex-1 font-medium">
                  {t('floatingButton.readyToCustomize')}
                </p>
              </div>
            )}
            
            <button
              onClick={handleContinue}
              disabled={!canContinue || isNavigating}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold rounded-xl transition-all duration-200 ${
                canContinue && !isNavigating
                  ? 'bg-gradient-to-r from-brand-primary to-indigo-600 text-white hover:from-brand-primary-hover hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isNavigating ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  {t('floatingButton.photoCustomization')}
                  <ChevronRightIcon className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>
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
          step: isMobile ? selfieStepIndicator : undefined,
          showBack: isMobile,
          onBack: handleBack,
          fullBleed: true
        }}
        maxWidth="full"
        contentClassName="px-0 py-0"
        bottomPadding="none"
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
              <div className="px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-4">
                  <SelfieInfoOverlayTrigger />
                </div>
                <SelectableGrid {...selectableGridProps} />
                <div className="mt-8 pb-8">
                  {navigationControls}
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
