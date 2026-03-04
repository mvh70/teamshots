'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { SelectableGrid } from '@/components/generation/selection'
import { SwipeableContainer, FlowProgressDock, SelfieNavButtons, StandardThreeStepIndicator } from '@/components/generation/navigation'
import { StickyFlowPage } from '@/components/generation/layout'
import FlowPageSkeleton from '@/components/generation/loading/FlowPageSkeleton'
import { buildNormalStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META, isCustomizationComplete } from '@/lib/customizationSteps'
import dynamic from 'next/dynamic'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { ErrorBanner } from '@/components/ui'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import { useUploadSelfieEndpoints } from '@/hooks/useUploadSelfieEndpoints'
import SharedMobileSelfieFlow from '@/components/generation/selfie/SharedMobileSelfieFlow'
import SelfieUploadSuccess from '@/components/Upload/SelfieUploadSuccess'
import { QRPlaceholder } from '@/components/MobileHandoff'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { hasEnoughSelfies } from '@/constants/generation'
import { useTranslations } from 'next-intl'
import SelfieTypeOverlay, { useSelfieTypeStatus } from '@/components/Upload/SelfieTypeOverlay'
import { preloadFaceDetectionModel } from '@/lib/face-detection'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { useClassificationQueue } from '@/hooks/useClassificationQueue'
import { useRefreshOnClassificationComplete } from '@/hooks/useRefreshOnClassificationComplete'
import { buildSelfieStatusBadge } from '@/components/generation/selfie/SelfieStatusBadge'
import { mapSelfieListItemsToGridItems, type SelfieListItem } from '@/lib/selfieGridItems'
import { useInviteGenerationFlowState } from '@/hooks/useInviteGenerationFlowState'
import { useInviteFlowNavigation } from '@/hooks/useInviteFlowNavigation'
import { useInviteStats } from '@/hooks/useInviteStats'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import type { InviteDashboardStats } from '@/types/invite'

type InviteCreditStats = Pick<InviteDashboardStats, 'creditsRemaining' | 'teamName'>

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

/**
 * Selfie management page for invited users.
 * 
 * Flow: /invite-dashboard/[token]/selfie-tips → /invite-dashboard/[token]/selfies → /invite-dashboard/[token]/beautification → /invite-dashboard/[token]/customization-intro
 * 
 * Users can select existing selfies or upload new ones.
 */
export default function SelfiesPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const navigation = useInviteFlowNavigation(token)
  const uploadOnly = (searchParams?.get('mode') || '') === 'upload'
  const t = useTranslations('inviteDashboard.selfieSelection.mobile')
  const tSelectionHint = useTranslations('selfies.selectionHint')
  const { context } = useOnboardingState()

  const [error, setError] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState<boolean>(false)
  const { stats } = useInviteStats<InviteCreditStats>(token, {
    initialStats: { creditsRemaining: 0, teamName: '' },
  })
  // Header resolves invite info internally; no local invite state needed

  const { uploadEndpoint: inviteUploadEndpoint, saveEndpoint: inviteSaveEndpoint } = useUploadSelfieEndpoints(token, 'invite')
  const {
    inFlow,
    clearFlow,
    setOpenStartFlow,
    setPendingGeneration,
    hydrated,
    hasCompletedBeautification,
    setCompletedBeautification,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps
  } = useInviteGenerationFlowState({
    token,
    syncBeautificationFromSession: true,
  })

  // Selfie type status for progress overlay
  const { refreshKey: selfieTypeRefreshKey, refresh: refreshSelfieTypeStatus } = useSelfieTypeStatus()

  // Classification queue status to show "Analyzing" vs "Queued" states
  const classificationQueue = useClassificationQueue({ token })

  // Note: Redirect logic removed - flow is now controlled by main dashboard handleStartFlow

  // Preload face detection model immediately when page loads
  useEffect(() => {
    preloadFaceDetectionModel()
  }, [])

  // Multi-select: load and manage selected selfies
  const selfieManager = useSelfieManagement({
    token,
    inviteMode: true,
    customUploadEndpoint: inviteUploadEndpoint,
    autoSelectNewUploads: true,
    onSelfiesApproved: async () => {
      // Reload selected state to ensure UI updates with newly selected selfies
      // This is critical for the continue button to enable after uploading 2 selfies
      await loadSelected()

      // Refresh selfie type status overlay to show newly classified selfies
      // This triggers the type-status API which does lazy classification
      refreshSelfieTypeStatus()

      // After classification completes, refresh the selfie list to get updated selfieType
      // The type-status API classifies selfies and updates the DB, so we need to reload
      // the selfie list to show the classification badges on individual thumbnails
      setTimeout(() => {
        loadUploads()
      }, 1500)

      // Small delay to allow React to process state updates and re-render
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Handle navigation and approval state for invited flow
      // Only navigate away if in upload-only mode
      if (uploadOnly) {
        navigation.toDashboard()
        return
      }

      // On mobile in generation flow, auto-navigate back to dashboard
      if (isMobile && inFlow) {
        setOpenStartFlow(true)
        navigation.toDashboard()
        return
      }

      // Show success briefly, then handle mobile/desktop differences
      setIsApproved(true)

      // Clear approval state after delay
      setTimeout(() => {
        setIsApproved(false)
      }, 1500)
    },
    onUploadError: (error) => {
      setError(error)
    }
  })

  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()

  // Extract values from selfieManager first (needed for useCallback below)
  const {
    uploads: hookSelfies,
    selectedIds,
    selectedSet,
    loading,
    loadSelected,
    loadUploads,
    toggleSelect,
    handlePhotoUpload,
    handleSelfiesApproved
  } = selfieManager

  const handleClassificationComplete = useCallback(() => {
    void loadUploads()
    refreshSelfieTypeStatus()
  }, [loadUploads, refreshSelfieTypeStatus])

  useRefreshOnClassificationComplete({
    classificationQueue,
    onComplete: handleClassificationComplete
  })

  // Handle selection changes from SelectableGrid - must be defined before any conditional throws
  const handleSelectionChange = useCallback(() => {
    // Reload selection state when gallery changes selections
    loadSelected()
  }, [loadSelected])

  // Mode check must come AFTER all hooks to avoid "Rendered fewer hooks" error
  if (selfieManager.mode !== 'invite') {
    throw new Error('Invite selfie page requires invite mode selfie management')
  }

  // Type assertion: in invite mode, uploads now follow the shared /api/uploads/list contract
  const selfies = hookSelfies as SelfieListItem[]
  const gridItems = useMemo(
    () => mapSelfieListItemsToGridItems(selfies, { token }),
    [selfies, token]
  )

  // Count all selected selfies, including newly uploaded ones that may not be in hookSelfies yet
  // The filtering was causing newly uploaded selfies to not count toward the continue button
  const selectedCount = selectedIds.length
  const canContinue = hasEnoughSelfies(selectedCount)
  const remainingSelfies = Math.max(0, 2 - selectedCount)
  const handleContinue = () => {
    if (canContinue) {
      setOpenStartFlow(true)
      setPendingGeneration(true)
      setCompletedBeautification(false)
      navigation.toBeautification()
    }
  }
  
  // Show skeleton while hydrating
  if (!hydrated) {
    return <FlowPageSkeleton variant="grid" />
  }

  // Check if all customization steps have been visited
  const hasEnoughCredits = stats.creditsRemaining >= PRICING_CONFIG.credits.perGeneration
  // If editableSteps is 0 (admin preset everything), customization is complete
  const customizationComplete = isCustomizationComplete(customizationStepsMeta, visitedSteps)

  const handleCancelUpload = () => {
    setIsApproved(false)
  }

  if (loading) { // loading comes from useSelfieManagement hook
    return <FlowPageSkeleton variant="centered-spinner" />
  }

  const handleBack = () => {
    if (context.hiddenScreens?.includes('selfie-tips')) {
      navigation.toDashboard()
      return
    }
    navigation.toSelfieTips()
  }

  // Navigation handlers for FlowProgressDock
  const handleNavigateToCustomize = () => {
    if (canContinue) {
      setOpenStartFlow(true)
      setPendingGeneration(true)
      setCompletedBeautification(false)
      navigation.toBeautification()
    }
  }

  const {
    stepperTotalDots,
    navCurrentIndex,
    navigationStepColors,
  } = buildNormalStepIndicator(customizationStepsMeta, {
    selfieComplete: canContinue,
    beautificationComplete: hasCompletedBeautification,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps,
    currentStep: 'selfies',
  })

  const flowHeaderConfig = {
    kicker: t('bannerTitle', { default: 'Select your selfies' }),
    title: tSelectionHint('text', { default: 'Select at least 2 selfies' }),
    // Hide step indicator in header - it's shown in the sticky footer instead
    step: undefined,
    showBack: !isMobile,
    onBack: () => {
      clearFlow()
      navigation.replaceDashboard()
    },
    fullBleed: true,
    hideOnDesktop: true
  }

  const topHeader = (
    <InviteDashboardHeader
      showBackToDashboard
      token={token}
      hideTitle
      teamName={stats.teamName}
      creditsRemaining={stats.creditsRemaining}
      photosAffordable={calculatePhotosFromCredits(stats.creditsRemaining)}
      onBackClick={() => {
        clearFlow()
        navigation.replaceDashboard()
      }}
    />
  )

  const selectableGridProps = {
    items: gridItems,
    selection: {
      mode: 'managed' as const,
      token,
      onAfterChange: handleSelectionChange,
    },
    externalManagedSelection: { selectedSet, toggleSelect },
    token,
    allowDelete: true,
    showUploadTile: !isMobile,
    onDeleted: async () => {
      await loadUploads()
      await loadSelected()
    },
    upload: {
      onSelfiesApproved: handleSelfiesApproved!,
      onError: (error: string) => setError(error),
      uploadEndpoint: handlePhotoUpload,
      saveEndpoint: inviteSaveEndpoint,
    },
    qrTile: (
      <QRPlaceholder
        inviteToken={token}
        size={100}
        className="w-full h-full"
        onSelfieUploaded={async () => {
          await loadUploads()
          await loadSelected()
        }}
      />
    ),
    classificationQueue,
  }

  const statusBadgeContent = buildSelfieStatusBadge({
    readyLabel: t('badgeReady', { default: 'Ready to continue!' }),
    selectingLabel: t('badgeSelecting', { default: 'Select {remaining} more', remaining: remainingSelfies }),
  })

  return (
    <SwipeableContainer
      onSwipeLeft={isSwipeEnabled && canContinue ? handleContinue : undefined}
      onSwipeRight={isSwipeEnabled ? handleBack : undefined}
      enabled={isSwipeEnabled}
    >
      <StickyFlowPage
        topHeader={topHeader}
        flowHeader={flowHeaderConfig}
        showTopOnDesktop
        maxWidth="full"
        contentClassName="px-0 py-0"
        bottomPadding="none"
        mobileHeaderSpacerHeight={120}
      >
        {/* Mobile: unified selfie selection experience */}
        {!uploadOnly && isMobile && (
          <SharedMobileSelfieFlow
            canContinue={canContinue}
            selfieTypeOverlay={
              <SelfieTypeOverlay token={token} refreshKey={selfieTypeRefreshKey} />
            }
            grid={
              <SelectableGrid {...selectableGridProps} />
            }
            navButtons={
              <SelfieNavButtons
                onBack={handleBack}
                onContinue={handleContinue}
                canContinue={canContinue}
                backLabel={t('prevLabel', { default: 'Dashboard' })}
                continueLabel={t('nextLabel', { default: 'Beautification' })}
              />
            }
            navigation={
              <StandardThreeStepIndicator
                currentIndex={navCurrentIndex}
                totalSteps={Math.max(1, stepperTotalDots)}
                visitedSteps={navigationStepColors?.visitedEditableSteps}
                lockedSteps={navigationStepColors?.lockedSteps}
              />
            }
            statusBadge={!isApproved ? statusBadgeContent : undefined}
            uploadSection={
              !isApproved ? (
                <SelfieUploadFlow
                  hideHeader={true}
                  buttonLayout="horizontal"
                  inline={true}
                  uploadEndpoint={handlePhotoUpload}
                  saveEndpoint={inviteSaveEndpoint}
                  onSelfiesApproved={handleSelfiesApproved!}
                  onCancel={handleCancelUpload}
                />
              ) : null
            }
            successBanner={
              isApproved ? <SelfieUploadSuccess className="border-0 shadow-none p-0" /> : undefined
            }
          />
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-52">
          {error && <ErrorBanner message={error} className="mb-6" />}

          <div className="space-y-6">
            {isApproved && (
              <div className="hidden md:block">
                <SelfieUploadSuccess />
              </div>
            )}

            {!uploadOnly && !isMobile && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex p-6 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg md:text-2xl font-semibold text-gray-900">Your Selfies</h2>
                    <span className={`px-2.5 py-1 text-sm font-medium rounded-full ${
                      selectedCount >= 2
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {selectedCount} selected
                    </span>
                  </div>
                </div>
                {/* Selfie Type Progress with Tips */}
                <div className="px-6 pb-4">
                  <SelfieTypeOverlay
                    token={token}
                    refreshKey={selfieTypeRefreshKey}
                    showTipsHeader
                    className="max-w-xl"
                  />
                </div>
                <div className="px-6 pt-2 pb-6">
                  <SelectableGrid {...selectableGridProps} />
                </div>
              </div>
            )}
          </div>
        </div>
      </StickyFlowPage>

      {/* Desktop: FlowProgressDock */}
      {!isMobile && (
        <FlowProgressDock
          selfieCount={selectedCount}
          hasUneditedFields={!customizationComplete}
          hasEnoughCredits={hasEnoughCredits}
          currentStep="selfies"
          onNavigateToSelfieStep={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          onNavigateToPreviousStep={navigation.toDashboard}
          onNavigateToCustomize={handleNavigateToCustomize}
          onGenerate={handleNavigateToCustomize}
          onNavigateToDashboard={navigation.toDashboard}
          customizationStepsMeta={customizationStepsMeta}
          visitedEditableSteps={visitedSteps}
        />
      )}
    </SwipeableContainer>
  )
}
