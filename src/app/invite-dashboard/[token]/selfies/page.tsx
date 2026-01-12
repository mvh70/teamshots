'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect } from 'react'
import { SelectableGrid } from '@/components/generation/selection'
import { FlowNavigation, SwipeableContainer } from '@/components/generation/navigation'
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
import SelfieInfoOverlayTrigger from '@/components/generation/SelfieInfoOverlayTrigger'
import { preloadFaceDetectionModel } from '@/lib/face-detection'

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
  // Header resolves invite info internally; no local invite state needed

  const { uploadEndpoint: inviteUploadEndpoint, saveEndpoint: inviteSaveEndpoint } = useInviteSelfieEndpoints(token)
  const {
    inFlow,
    clearFlow,
    setOpenStartFlow,
    setPendingGeneration,
    hydrated,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META
  } = useGenerationFlowState()
  
  // Note: Redirect logic removed - flow is now controlled by main dashboard handleStartFlow

  // Preload face detection model immediately when page loads
  useEffect(() => {
    console.log('[InviteSelfiesPage] Preloading face detection model...')
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

  if (selfieManager.mode !== 'invite') {
    throw new Error('Invite selfie page requires invite mode selfie management')
  }

  const {
    uploads: hookSelfies,
    selectedIds,
    loading,
    loadSelected,
    loadUploads,
    handlePhotoUpload,
    handleSelfiesApproved
  } = selfieManager
  
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  
  
  // Type assertion: in invite mode, uploads is always Selfie[]
  type Selfie = { id: string; key: string; url: string; uploadedAt: string; used?: boolean }
  const selfies = hookSelfies as Selfie[]


  // Handle selection changes from SelectableGrid
  const handleSelectionChange = useCallback(() => {
    // Reload selection state when gallery changes selections
    loadSelected()
  }, [loadSelected])

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
  
  // Don't render while hydrating
  if (!hydrated) {
    return null
  }

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

  const flowHeaderConfig = {
    kicker: t('bannerTitle', { default: 'Select your selfies' }),
    title: tSelectionHint('text', { default: 'Select at least 2 selfies' }),
    step: selfieStepIndicator,
    showBack: !isMobile,
    onBack: () => {
      clearFlow()
      router.replace(`/invite-dashboard/${token}`)
    },
    fullBleed: true
  }

  const topHeader = (
    <InviteDashboardHeader
      showBackToDashboard
      token={token}
      title=""
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
            infoBanner={
              <div className="flex-1">
                <SelfieInfoOverlayTrigger dense className="w-full" />
              </div>
            }
            grid={
              <SelectableGrid
                items={selfies.map(s => ({
                  id: s.id,
                  key: s.key,
                  url: s.url,
                  uploadedAt: s.uploadedAt,
                  used: s.used
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
            navigation={
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
                        {t('badgeReady', { default: 'Ready! Swipe left →' })}
                      </>
                    ),
                    selectingContent: (
                      <>
                        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('badgeSelecting', { default: 'Need {remaining} more', remaining: remainingSelfies })}
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  <h2 className="text-lg md:text-2xl font-semibold text-gray-900">Your Selfies</h2>
                  {inFlow && (
                    <button
                      onClick={handleContinue}
                      disabled={!canContinue}
                      className={`px-5 py-3 text-base font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary shadow-md ${
                        canContinue
                          ? 'text-white bg-brand-primary hover:bg-brand-primary-hover'
                          : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                      }`}
                    >
                      Continue
                    </button>
                  )}
                </div>
                <div className="px-6 pb-4">
                  <SelfieInfoOverlayTrigger />
                </div>
                <div className="px-6 pt-2 pb-6">
                  <SelectableGrid
                    items={selfies.map(s => ({
                      id: s.id,
                      key: s.key,
                      url: s.url,
                      uploadedAt: s.uploadedAt,
                      used: s.used
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
                <div className="px-6 pb-6">
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
                </div>
              </div>
            )}
          </div>
        </div>
      </StickyFlowPage>
    </SwipeableContainer>
  )
}
