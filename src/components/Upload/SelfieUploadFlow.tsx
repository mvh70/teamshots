'use client'

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useUploadFlow } from '@/hooks/useUploadFlow'
import type { UploadResult } from '@/hooks/useUploadFlow'
import StickyUploadBar from './StickyUploadBar'

// Detect if we can auto-trigger file picker (desktop with pointer device)
function getCanAutoTrigger(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(pointer: fine)').matches &&
    !('ontouchstart' in window || navigator.maxTouchPoints > 0)
  )
}

function subscribeToMediaQuery(callback: () => void): () => void {
  const mediaQuery = window.matchMedia?.('(pointer: fine)')
  mediaQuery?.addEventListener?.('change', callback)
  return () => mediaQuery?.removeEventListener?.('change', callback)
}

function getServerSnapshot(): boolean {
  return false
}

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })
const SelfieApproval = dynamic(() => import('@/components/Upload/SelfieApproval'), { ssr: false })

interface SelfieUploadFlowProps {
  onSelfiesApproved: (results: { key: string; selfieId?: string }[]) => void
  onCancel: () => void
  onError?: (error: string) => void
  saveEndpoint?: (key: string) => Promise<string | undefined> // Custom save function for invite flows, can return selfie ID
  uploadEndpoint?: (file: File) => Promise<{ key: string; url?: string }> // Custom upload function for invite flows or other custom flows
  hideHeader?: boolean // Hide title and cancel button for compact/sticky views
  initialMode?: 'camera' | 'upload' // Auto-open camera or file picker on mount
  buttonLayout?: 'vertical' | 'horizontal' // Layout for camera/upload buttons
}

export default function SelfieUploadFlow({
  onSelfiesApproved,
  onCancel,
  onError,
  saveEndpoint,
  uploadEndpoint,
  hideHeader = false,
  initialMode,
  buttonLayout = 'vertical'
}: SelfieUploadFlowProps) {
  const t = useTranslations('selfies')
  const [cameraKey, setCameraKey] = useState(0)
  const [shouldOpenCamera, setShouldOpenCamera] = useState(initialMode === 'camera')
  // Track if user dismissed the manual upload prompt
  const [promptDismissed, setPromptDismissed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasTriggeredInitialMode = useRef(false)
  const autoUploadTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initialModeRef = useRef(initialMode)
  
  // Use useSyncExternalStore for SSR-safe auto-trigger detection
  const canAutoTrigger = useSyncExternalStore(subscribeToMediaQuery, getCanAutoTrigger, getServerSnapshot)
  
  // Derive whether to show manual upload prompt
  const shouldShowManualUploadPrompt = initialMode === 'upload' && !canAutoTrigger && !promptDismissed

  const {
    pendingApproval,
    isProcessing,
    uploadFile,
    handleUploadResult,
    approvePending,
    cancelPending,
    retakePending
  } = useUploadFlow({
    uploadEndpoint,
    saveEndpoint,
    onApproved: onSelfiesApproved,
    onError
  })

  // Update ref when initialMode changes
  useEffect(() => {
    initialModeRef.current = initialMode
  }, [initialMode])

  useEffect(() => {
    if (initialModeRef.current === 'upload' && !hasTriggeredInitialMode.current && canAutoTrigger) {
      hasTriggeredInitialMode.current = true
      autoUploadTimerRef.current = setTimeout(() => {
        fileInputRef.current?.click()
      }, 150)
    }

    return () => {
      if (autoUploadTimerRef.current) {
        clearTimeout(autoUploadTimerRef.current)
        autoUploadTimerRef.current = null
      }
    }
  }, [canAutoTrigger])

  const handleHiddenInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    try {
      const uploads: UploadResult[] = []
      for (const file of Array.from(files)) {
        const result = await uploadFile(file)
        if (result) {
          uploads.push(result)
        }
      }
      if (uploads.length > 0) {
        await handleUploadResult(uploads)
      }
    } catch (error) {
      console.error('File upload error:', error)
      onError?.('Failed to upload file. Please try again.')
    } finally {
      e.target.value = ''
    }
  }

  useEffect(() => {
    if (!shouldOpenCamera) return
    const timer = setTimeout(() => {
      setShouldOpenCamera(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [shouldOpenCamera])

  const triggerHiddenFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleApprove = useCallback(async () => {
    await approvePending()
  }, [approvePending])

  const handleRetake = useCallback(() => {
    retakePending()
    setCameraKey(prev => prev + 1)
    setShouldOpenCamera(true)
  }, [retakePending])

  const handleCancelApproval = useCallback(() => {
    cancelPending()
    onCancel()
  }, [cancelPending, onCancel])

  if (pendingApproval) {
    return (
      <div data-testid="approval-flow" className="md:static fixed inset-x-0 bottom-0 z-50 md:z-auto bg-white md:bg-transparent" style={{ transform: 'translateZ(0)' }}>
        <SelfieApproval
          uploadedPhotoKey={pendingApproval.key}
          previewUrl={pendingApproval.previewUrl}
          onApprove={handleApprove}
          onRetake={handleRetake}
          onCancel={handleCancelApproval}
        />
      </div>
    )
  }

  const commonPhotoUploadProps = {
    multiple: true,
    onUpload: uploadFile,
    onUploaded: (result: UploadResult | UploadResult[]) => handleUploadResult(result),
    testId: 'desktop-file-input',
    autoOpenCamera: shouldOpenCamera,
    isProcessing,
    onCameraError: onError,
    buttonLayout: hideHeader ? 'horizontal' : buttonLayout,
    hidePlusIcon: hideHeader
  }

  if (hideHeader) {
    const manualPrompt = shouldShowManualUploadPrompt ? (
      <div className="mb-3 rounded-xl border border-dashed border-gray-300 bg-white/80 px-4 py-3 text-sm text-gray-700">
        <p className="mb-2">Tap below to open your photo library.</p>
        <button
          type="button"
          className="w-full rounded-lg bg-brand-primary px-4 py-2 text-white font-semibold hover:bg-brand-primary-hover transition-colors"
          onClick={() => {
            triggerHiddenFilePicker()
            setPromptDismissed(true)
          }}
        >
          Choose from Library
        </button>
      </div>
    ) : null

    const mobileContent = (
      <StickyUploadBar className="md:hidden">
        {manualPrompt}
        <PhotoUpload {...commonPhotoUploadProps} />
      </StickyUploadBar>
    )

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleHiddenInputChange}
          className="hidden"
          aria-hidden="true"
        />
        {typeof window !== 'undefined' && createPortal(mobileContent, document.body)}
        <div data-testid="upload-flow-desktop" className="hidden md:block">
          <PhotoUpload key={cameraKey} {...commonPhotoUploadProps} />
        </div>
      </>
    )
  }

  const showManualPrompt = shouldShowManualUploadPrompt

  return (
    <div data-testid="upload-flow">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleHiddenInputChange}
        className="hidden"
        aria-hidden="true"
      />
      {showManualPrompt && (
        <div className="mb-4 rounded-2xl border border-dashed border-gray-300 bg-white/80 p-4 text-gray-700">
          <p className="text-sm mb-2">
            Having trouble opening your photo library automatically? Tap below to select photos manually.
          </p>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-hover transition-colors"
            onClick={() => {
              triggerHiddenFilePicker()
              setPromptDismissed(true)
            }}
          >
            Choose photos
          </button>
        </div>
      )}
      <div data-testid="mobile-upload-interface" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900" data-testid="desktop-upload-title">{t('upload.title')}</h2>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            data-testid="cancel-upload"
          >
            Cancel
          </button>
        </div>
        <p className="text-sm text-gray-600" data-testid="upload-description">{t('upload.description')}</p>
        <PhotoUpload key={cameraKey} {...commonPhotoUploadProps} />
      </div>
    </div>
  )
}
