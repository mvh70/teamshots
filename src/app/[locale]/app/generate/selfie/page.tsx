'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SelectableGrid } from '@/components/generation/selection'
import { SwipeableContainer, FlowNavigation } from '@/components/generation/navigation'
import { LoadingGrid } from '@/components/ui'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import dynamic from 'next/dynamic'
import SelfieSelectionInfoBanner from '@/components/generation/SelfieSelectionInfoBanner'
import { StickyFlowPage } from '@/components/generation/layout'
import { buildSelfieStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { MIN_SELFIES_REQUIRED, hasEnoughSelfies } from '@/constants/generation'
import SharedMobileSelfieFlow from '@/components/generation/selfie/SharedMobileSelfieFlow'
import Header from '@/app/[locale]/app/components/Header'

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

  const { uploads, selectedIds, loading, loadSelected, handleSelfiesApproved } = selfieManager
  
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
  const handleSelectionChange = useCallback(() => {
    // Only reload if not already loading
    if (!isLoadingRef.current) {
      isLoadingRef.current = true
      loadSelected().finally(() => {
        isLoadingRef.current = false
      })
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
    }
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
    <SwipeableContainer
      onSwipeLeft={canContinue ? handleContinue : undefined}
      onSwipeRight={handleBack}
      enabled={isSwipeEnabled}
    >
      <StickyFlowPage
        topHeader={<Header standalone showBackToDashboard />}
        flowHeader={{
          kicker: tSelection('bannerTitle', { default: 'Select your selfies' }),
          title: t('title', { default: 'Choose your selfie' }),
          subtitle: !isMobile ? t('subtitle', { default: 'Select a selfie to use for generation, or upload a new one.' }) : undefined,
          step: selfieStepIndicator,
          showBack: true,
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
                infoBanner={<SelfieSelectionInfoBanner selectedCount={selectedCount} className="flex-1 mb-0" />}
                grid={<SelectableGrid {...selectableGridProps} />}
                navigation={navigationControls}
                uploadSection={mobileUploadSection}
                statusBadge={statusBadgeContent}
              />
            ) : (
              <div className="px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-4">
                  <SelfieSelectionInfoBanner selectedCount={selectedCount} />
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
  )
}

export default function SelfieSelectionPage() {
  return <SelfieSelectionPageContent />
}
