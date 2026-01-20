'use client'

import { useTranslations } from 'next-intl'
import { SelectableGrid } from '@/components/generation/selection'
import { useState, useEffect, useRef, useCallback } from 'react'
import React from 'react'
import { SecondaryButton, LoadingGrid } from '@/components/ui'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import dynamic from 'next/dynamic'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { QRPlaceholder } from '@/components/MobileHandoff'
import SelfieTypeOverlay, { useSelfieTypeStatus } from '@/components/Upload/SelfieTypeOverlay'
import { preloadFaceDetectionModel } from '@/lib/face-detection'
import { useClassificationQueue } from '@/hooks/useClassificationQueue'

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })


function SelfiesPageContent() {
  const t = useTranslations('selfies')
  const [error, setError] = useState<string | null>(null)
  const isMobile = useMobileViewport()
  const { refreshKey: selfieTypeRefreshKey, refresh: refreshSelfieTypeStatus } = useSelfieTypeStatus()
  const classificationQueue = useClassificationQueue()

  const selfieManager = useSelfieManagement()

  if (selfieManager.mode !== 'individual') {
    throw new Error('Selfies page requires individual selfie management mode')
  }

  const { uploads, loading, loadUploads, handleSelfiesApproved } = selfieManager

  // Preload face detection model immediately when page loads
  useEffect(() => {
    console.log('[SelfiesPage] Preloading face detection model...')
    preloadFaceDetectionModel()
  }, [])

  // Track previously active/queued selfies to detect when classification completes
  const prevQueueRef = useRef<{ active: string[]; queued: string[] }>({ active: [], queued: [] })
  
  // Auto-refresh when classification completes
  useEffect(() => {
    if (!classificationQueue) return
    
    const prevActive = prevQueueRef.current.active
    const prevQueued = prevQueueRef.current.queued
    const currentActive = classificationQueue.activeSelfieIds || []
    const currentQueued = classificationQueue.queuedSelfieIds || []
    
    // Check if any selfie that was being processed is now done
    const completedFromActive = prevActive.filter(id => !currentActive.includes(id) && !currentQueued.includes(id))
    const completedFromQueued = prevQueued.filter(id => !currentActive.includes(id) && !currentQueued.includes(id))
    
    if (completedFromActive.length > 0 || completedFromQueued.length > 0) {
      // Classification completed for some selfies - refresh the list
      loadUploads()
      refreshSelfieTypeStatus()
    }
    
    // Update ref for next comparison
    prevQueueRef.current = { active: currentActive, queued: currentQueued }
  }, [classificationQueue, loadUploads, refreshSelfieTypeStatus])
  
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

  // Memoize the grid items to prevent unnecessary re-renders
  const gridItems = React.useMemo(() =>
    uploadListItems.map(u => ({
      id: u.id,
      key: u.uploadedKey,
      url: `/api/files/get?key=${encodeURIComponent(u.uploadedKey)}`,
      uploadedAt: u.createdAt,
      used: u.hasGenerations,
      selfieType: u.selfieType,
      selfieTypeConfidence: u.selfieTypeConfidence,
      isProper: u.isProper ?? undefined,
      improperReason: u.improperReason,
      lightingQuality: u.lightingQuality,
      backgroundQuality: u.backgroundQuality,
    })), [uploadListItems])

  // Hook handles initialization internally

  const handleSelfiesApprovedWrapper = async (results: { key: string; selfieId?: string }[]) => {
    await handleSelfiesApproved?.(results)
    refreshSelfieTypeStatus()
    setError(null)
  }

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight" data-testid="selfies-title">{t('title')}</h1>
        <p className="text-gray-600 text-base sm:text-lg font-medium leading-relaxed">{t('subtitle')}</p>
      </div>

      {/* Selfie Type Progress with Tips */}
      <SelfieTypeOverlay
        refreshKey={selfieTypeRefreshKey}
        showTipsHeader
        className="max-w-xl"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4" data-testid="error-message">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <SecondaryButton
                    onClick={() => setError(null)}
                    size="sm"
                    className="bg-red-50 text-red-800 hover:bg-red-100 focus:ring-red-600"
                  >
                    Dismiss
                  </SecondaryButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingGrid cols={4} rows={2} />
      ) : (
        <div className={isMobile ? 'pb-40' : ''}>
          <SelectableGrid
            items={gridItems}
            selection={{ mode: 'managed' }}
            allowDelete
            showUploadTile={!isMobile}
            onDeleted={loadUploads}
            upload={{
              onSelfiesApproved: handleSelfiesApprovedWrapper,
              onError: handleUploadError
            }}
            qrTile={
              <QRPlaceholder
                size={100}
                className="w-full h-full"
                onSelfieUploaded={async () => {
                  await loadUploads()
                }}
              />
            }
            classificationQueue={classificationQueue}
          />
        </div>
      )}
      
      {/* Mobile: Always show sticky upload flow at bottom */}
      {isMobile && (
        <SelfieUploadFlow
          hideHeader={true}
          onSelfiesApproved={handleSelfiesApprovedWrapper}
          onCancel={() => {}}
          onError={handleUploadError}
        />
      )}
    </div>
  )
}

export default function SelfiesPage() {
  return <SelfiesPageContent />
}
