'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect } from 'react'
import { SelectableGrid } from '@/components/generation/selection'
import { FlowNavigation, SwipeableContainer, FlowProgressDock } from '@/components/generation/navigation'
import { StickyFlowPage } from '@/components/generation/layout'
import { buildSelfieStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import dynamic from 'next/dynamic'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { ErrorBanner } from '@/components/ui'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import { useInviteSelfieEndpoints } from '@/hooks/useInviteSelfieEndpoints'
import SharedMobileSelfieFlow from '@/components/generation/selfie/SharedMobileSelfieFlow'
import SelfieUploadSuccess from '@/components/Upload/SelfieUploadSuccess'
import { QRPlaceholder } from '@/components/MobileHandoff'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { hasEnoughSelfies } from '@/constants/generation'
import { useTranslations } from 'next-intl'
import SelfieTypeOverlay, { useSelfieTypeStatus } from '@/components/Upload/SelfieTypeOverlay'
import { preloadFaceDetectionModel } from '@/lib/face-detection'
import { PRICING_CONFIG } from '@/config/pricing'

const isNonNullObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

interface DashboardStats {
  creditsRemaining: number
}

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

/**
 * Selfie management page for invited users.
 * 
 * Flow: /invite-dashboard/[token]/selfie-tips → /invite-dashboard/[token]/selfies → /invite-dashboard/[token]/customization-intro
 * 
 * Users can select existing selfies or upload new ones.
 */
export default function SelfiesPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = params.token as string
  const uploadOnly = (searchParams?.get('mode') || '') === 'upload'
  const t = useTranslations('inviteDashboard.selfieSelection.mobile')
  const tSelectionHint = useTranslations('selfies.selectionHint')

  const [error, setError] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState<boolean>(false)
  const [stats, setStats] = useState<DashboardStats>({ creditsRemaining: 0 })
  // Header resolves invite info internally; no local invite state needed

  const { uploadEndpoint: inviteUploadEndpoint, saveEndpoint: inviteSaveEndpoint } = useInviteSelfieEndpoints(token)
  const {
    inFlow,
    clearFlow,
    setOpenStartFlow,
    setPendingGeneration,
    hydrated,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps
  } = useGenerationFlowState()

  // Selfie type status for progress overlay
  const { refreshKey: selfieTypeRefreshKey, refresh: refreshSelfieTypeStatus } = useSelfieTypeStatus()

  // Note: Redirect logic removed - flow is now controlled by main dashboard handleStartFlow

  // Preload face detection model immediately when page loads
  useEffect(() => {
    console.log('[InviteSelfiesPage] Preloading face detection model...')
    preloadFaceDetectionModel()
  }, [])

  // Fetch stats for credit check
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/member/stats?token=${token}`)
      if (response.ok) {
        const data = await response.json()
        if (isNonNullObject(data) && isNonNullObject(data.stats)) {
          setStats(data.stats as unknown as DashboardStats)
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [token])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

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
        router.push(`/invite-dashboard/${token}`)
        return
      }

      // On mobile in generation flow, auto-navigate back to dashboard
      if (isMobile && inFlow) {
        setOpenStartFlow(true)
        router.push(`/invite-dashboard/${token}`)
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
    loading,
    loadSelected,
    loadUploads,
    handlePhotoUpload,
    handleSelfiesApproved
  } = selfieManager

  // Handle selection changes from SelectableGrid - must be defined before any conditional throws
  const handleSelectionChange = useCallback(() => {
    // Reload selection state when gallery changes selections
    loadSelected()
  }, [loadSelected])

  // Mode check must come AFTER all hooks to avoid "Rendered fewer hooks" error
  if (selfieManager.mode !== 'invite') {
    throw new Error('Invite selfie page requires invite mode selfie management')
  }

  // Type assertion: in invite mode, uploads is always Selfie[]
  type Selfie = {
    id: string
    key: string
    url: string
    uploadedAt: string
    used?: boolean
    selfieType?: string | null
    selfieTypeConfidence?: number | null
    isProper?: boolean | null
    improperReason?: string | null
    lightingQuality?: string | null
    backgroundQuality?: string | null
  }
  const selfies = hookSelfies as Selfie[]

  // Count all selected selfies, including newly uploaded ones that may not be in hookSelfies yet
  // The filtering was causing newly uploaded selfies to not count toward the continue button
  const selectedCount = selectedIds.length
  const canContinue = hasEnoughSelfies(selectedCount)
  const remainingSelfies = Math.max(0, 2 - selectedCount)
  const handleContinue = () => {
    if (canContinue) {
      setOpenStartFlow(true)
      setPendingGeneration(true)
      // Navigate to customization intro (which then goes to dashboard)
      router.push(`/invite-dashboard/${token}/customization-intro`)
    }
  }
  
  // Show skeleton while hydrating
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header skeleton */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        {/* Grid skeleton */}
        <div className="px-4 py-6">
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Check if all customization steps have been visited
  const hasEnoughCredits = stats.creditsRemaining >= PRICING_CONFIG.credits.perGeneration
  const isCustomizationComplete = customizationStepsMeta.editableSteps > 0 &&
    visitedSteps.length >= customizationStepsMeta.editableSteps
  const canGeneratePhoto = canContinue && hasEnoughCredits && isCustomizationComplete

  const handleCancelUpload = () => {
    setIsApproved(false)
  }

  if (loading) { // loading comes from useSelfieManagement hook
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading selfies...</p>
        </div>
      </div>
    )
  }

  const handleBack = () => {
    router.push(`/invite-dashboard/${token}/selfie-tips`)
  }

  // Navigation handlers for FlowProgressDock
  const handleNavigateToSelfies = () => {
    // Already here
  }

  const handleNavigateToCustomize = () => {
    if (canContinue) {
      setOpenStartFlow(true)
      setPendingGeneration(true)
      router.push(`/invite-dashboard/${token}/customization`)
    }
  }

  const handleNavigateToSelfieTips = () => {
    router.push(`/invite-dashboard/${token}/selfie-tips`)
  }

  const handleNavigateToCustomizationIntro = () => {
    if (canContinue) {
      setOpenStartFlow(true)
      setPendingGeneration(true)
      router.push(`/invite-dashboard/${token}/customization-intro`)
    }
  }

  const selfieStepIndicator = buildSelfieStepIndicator(customizationStepsMeta, {
    selfieComplete: canContinue,
    isDesktop: !isMobile,
    visitedCustomizationSteps: visitedSteps
  })

  const stepperTotalDots = selfieStepIndicator.totalWithLocked ?? selfieStepIndicator.total
  const navCurrentIndex = selfieStepIndicator.currentAllStepsIndex ?? Math.max(0, selfieStepIndicator.current - 1)
  // Merge selfie completion with persisted customization visited steps
  // Mobile indices: 0 = selfie, 1+ = customization steps (shifted by 1)
  const mergedVisitedSteps = [
    ...(canContinue ? [0] : []),
    ...visitedSteps.map(idx => idx + 1) // shift customization indices by 1 for selfie at index 0
  ]
  const navigationStepColors = selfieStepIndicator.lockedSteps || mergedVisitedSteps.length > 0
    ? {
        lockedSteps: selfieStepIndicator.lockedSteps,
        visitedEditableSteps: mergedVisitedSteps
      }
    : undefined

  // Override selfieStepIndicator's visitedEditableSteps with merged visited steps
  const stepIndicatorWithVisited = {
    ...selfieStepIndicator,
    visitedEditableSteps: mergedVisitedSteps
  }

  const flowHeaderConfig = {
    kicker: t('bannerTitle', { default: 'Select your selfies' }),
    title: tSelectionHint('text', { default: 'Select at least 2 selfies' }),
    // Hide step indicator in header - it's shown in the sticky footer instead
    step: undefined,
    showBack: !isMobile,
    onBack: () => {
      clearFlow()
      router.replace(`/invite-dashboard/${token}`)
    },
    fullBleed: true,
    hideOnDesktop: true
  }

  const topHeader = (
    <InviteDashboardHeader
      showBackToDashboard
      token={token}
      hideTitle
      creditsRemaining={stats.creditsRemaining}
      photosAffordable={Math.floor(stats.creditsRemaining / PRICING_CONFIG.credits.perGeneration)}
      onBackClick={() => {
        clearFlow()
        router.replace(`/invite-dashboard/${token}`)
      }}
    />
  )

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
        mobileHeaderSpacerHeight={0}
      >
        {/* Mobile: unified selfie selection experience */}
        {!uploadOnly && (
          <SharedMobileSelfieFlow
            canContinue={canContinue}
            selfieTypeOverlay={
              <SelfieTypeOverlay token={token} refreshKey={selfieTypeRefreshKey} />
            }
            grid={
              <SelectableGrid
                items={selfies.map(s => ({
                  id: s.id,
                  key: s.key,
                  url: s.url,
                  uploadedAt: s.uploadedAt,
                  used: s.used,
                  selfieType: s.selfieType,
                  selfieTypeConfidence: s.selfieTypeConfidence,
                  isProper: s.isProper ?? undefined,
                  improperReason: s.improperReason,
                  lightingQuality: s.lightingQuality,
                  backgroundQuality: s.backgroundQuality
                }))}
                selection={{
                  mode: 'managed',
                  token,
                  onAfterChange: handleSelectionChange
                }}
                token={token}
                allowDelete
                showUploadTile={!isMobile}
                onDeleted={async () => {
                  await loadUploads()
                  await loadSelected()
                }}
                upload={{
                  onSelfiesApproved: handleSelfiesApproved!,
                  onError: (error) => setError(error),
                  uploadEndpoint: handlePhotoUpload,
                  saveEndpoint: inviteSaveEndpoint
                }}
                qrTile={
                  <QRPlaceholder 
                    inviteToken={token}
                    size={100}
                    className="w-full h-full"
                    onSelfieUploaded={async () => {
                      await loadUploads()
                      await loadSelected()
                    }}
                  />
                }
              />
            }
            navButtons={
              <div className="flex items-center justify-between">
                {/* Back to Dashboard */}
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-2 pr-4 pl-3 h-11 rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm font-medium">{t('prevLabel', { default: 'Dashboard' })}</span>
                </button>

                {/* Forward to Customization */}
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!canContinue}
                  className={`flex items-center gap-2 pl-4 pr-3 h-11 rounded-full shadow-sm transition ${
                    canContinue
                      ? 'bg-brand-primary text-white hover:brightness-110'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span className="text-sm font-medium">{t('nextLabel', { default: 'Customization' })}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            }
            navigation={
              <FlowNavigation
                variant="dots-only"
                size="md"
                current={navCurrentIndex}
                total={Math.max(1, stepperTotalDots)}
                onPrev={handleBack}
                onNext={handleContinue}
                stepColors={navigationStepColors}
              />
            }
            statusBadge={
              !isApproved
                ? {
                    readyContent: (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {t('badgeReady', { default: 'Ready to continue!' })}
                      </>
                    ),
                    selectingContent: (
                      <>
                        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('badgeSelecting', { default: 'Select {remaining} more', remaining: remainingSelfies })}
                      </>
                    )
                  }
                : undefined
            }
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

            {!uploadOnly && (
              <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200">
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
                  <SelectableGrid
                    items={selfies.map(s => ({
                      id: s.id,
                      key: s.key,
                      url: s.url,
                      uploadedAt: s.uploadedAt,
                      used: s.used,
                      selfieType: s.selfieType,
                      selfieTypeConfidence: s.selfieTypeConfidence,
                      isProper: s.isProper ?? undefined,
                      improperReason: s.improperReason,
                      lightingQuality: s.lightingQuality,
                      backgroundQuality: s.backgroundQuality
                    }))}
                    selection={{
                      mode: 'managed',
                      token,
                      onAfterChange: handleSelectionChange
                    }}
                    token={token}
                    allowDelete
                    showUploadTile={!isMobile}
                    onDeleted={async () => {
                      await loadUploads()
                      await loadSelected()
                    }}
                    upload={{
                      onSelfiesApproved: handleSelfiesApproved!,
                      onError: (error) => setError(error),
                      uploadEndpoint: handlePhotoUpload,
                      saveEndpoint: inviteSaveEndpoint
                    }}
                    qrTile={
                      <QRPlaceholder 
                        inviteToken={token} 
                        size={100}
                        className="w-full h-full"
                        onSelfieUploaded={async () => {
                          await loadUploads()
                          await loadSelected()
                        }}
                      />
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </StickyFlowPage>

      {/* Desktop: FlowProgressDock */}
      <FlowProgressDock
        selfieCount={selectedCount}
        uneditedFields={!isCustomizationComplete ? ['customization'] : []}
        hasUneditedFields={!isCustomizationComplete}
        canGenerate={canGeneratePhoto}
        hasEnoughCredits={hasEnoughCredits}
        currentStep="selfies"
        onNavigateToSelfies={handleNavigateToSelfies}
        onNavigateToCustomize={handleNavigateToCustomize}
        onGenerate={handleNavigateToCustomize}
        onNavigateToDashboard={() => router.push(`/invite-dashboard/${token}`)}
        customizationStepsMeta={customizationStepsMeta}
        visitedEditableSteps={visitedSteps}
      />
    </SwipeableContainer>
  )
}
