'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useSelfieUpload } from '@/hooks/useSelfieUpload'
import { promoteUploads } from '@/lib/uploadHelpers'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })
const SelfieApproval = dynamic(() => import('@/components/Upload/SelfieApproval'), { ssr: false })

interface SelfieUploadFlowProps {
  onSelfiesApproved: (results: { key: string; selfieId?: string }[]) => void
  onCancel: () => void
  onError?: (error: string) => void
  onRetake?: () => void
  saveEndpoint?: (key: string) => Promise<string | undefined> // Custom save function for invite flows, can return selfie ID
  uploadEndpoint?: (file: File) => Promise<{ key: string; url?: string }> // Custom upload function for invite flows or other custom flows
  hideHeader?: boolean // Hide title and cancel button for compact/sticky views
  onProcessingCompleteRef?: React.MutableRefObject<(() => void) | null> // Ref to call when upload processing is complete
}

export default function SelfieUploadFlow({
  onSelfiesApproved,
  onCancel,
  onError,
  onRetake,
  saveEndpoint,
  uploadEndpoint,
  hideHeader = false,
  onProcessingCompleteRef
}: SelfieUploadFlowProps) {
  // Debug: always log hideHeader value to verify prop is received
  if (typeof window !== 'undefined') {
    console.log('[SelfieUploadFlow] hideHeader prop value:', hideHeader)
  }
  const t = useTranslations('selfies')
  const {
    handlePhotoUpload
  } = useSelfieUpload({
    onSuccess: (key, id) => {
      onSelfiesApproved([{ key, selfieId: id }])
    },
    onError: onError,
    saveEndpoint,
    uploadEndpoint
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const [pendingApproval, setPendingApproval] = useState<{ key: string; previewUrl: string } | null>(null)
  const pendingApprovalRef = useRef<{ key: string; previewUrl: string } | null>(null)
  const [cameraKey, setCameraKey] = useState(0) // Key to force PhotoUpload remount for retake
  const [shouldOpenCamera, setShouldOpenCamera] = useState(false) // Track if camera should open
  
  // Reset shouldOpenCamera after a short delay to allow camera to open
  useEffect(() => {
    if (shouldOpenCamera) {
      const timer = setTimeout(() => {
        setShouldOpenCamera(false)
      }, 1000) // Reset after 1 second to allow camera to open
      return () => clearTimeout(timer)
    }
  }, [shouldOpenCamera])

  // Wrapper for handlePhotoUpload - detect camera captures and show approval
  const handlePhotoUploadWrapper = async (file: File): Promise<{ key: string; url?: string }> => {
    const isFromCamera = file.name.startsWith('capture-')
    const result = await handlePhotoUpload(file)
    
    // Reset camera open flag after capture
    setShouldOpenCamera(false)
    
    // Store file and preview URL for camera captures
    if (isFromCamera && result.url) {
      const approvalData = { key: result.key, previewUrl: result.url }
      setPendingApproval(approvalData)
      pendingApprovalRef.current = approvalData
    }
    
    return result
  }

  // Wrapper for handlePhotoUploaded - both single and multiple uploads process directly
  const handlePhotoUploadedWrapper = async (result: { key: string; url?: string } | { key: string; url?: string }[]) => {
    // If this is a camera capture, don't process yet - wait for approval
    const uploads = Array.isArray(result) ? result : [result]
    const hasCameraCapture = uploads.some(upload => {
      // Check if we have pending approval for this key
      return pendingApprovalRef.current?.key === upload.key
    })
    
    if (hasCameraCapture) {
      // Don't process yet - approval screen will handle it
      return
    }

    // Set processing state IMMEDIATELY and SYNCHRONOUSLY before any async operations
    // This ensures spinner stays visible without any gaps
    setIsProcessing(true)
    
    try {
      let successfulResults: { key: string; selfieId?: string }[]

      // Check if saveEndpoint is provided (indicates invite flow with direct uploads)
      if (saveEndpoint) {
        // Invite flow: Handle direct uploads (non-temp keys) separately
        const directUploads = uploads.filter(upload => !upload.key.startsWith('temp:'))
        const tempUploads = uploads.filter(upload => upload.key.startsWith('temp:'))

        // Process direct uploads by calling saveEndpoint directly
        const directResults = await Promise.all(
          directUploads.map(async (upload) => {
            try {
              const selfieId = await saveEndpoint(upload.key)
              return { key: upload.key, selfieId }
            } catch (error) {
              console.error('Failed to save direct upload:', error)
              return { key: upload.key, selfieId: undefined }
            }
          })
        )

        // Process temp uploads through promoteUploads (for authenticated users)
        const tempResults = tempUploads.length > 0 ? await promoteUploads(tempUploads) : []

        // Combine results
        successfulResults = [...directResults, ...tempResults]
      } else {
        // Standard flow: Use promoteUploads for all uploads (authenticated users)
        successfulResults = await promoteUploads(uploads)
      }

      // Small delay to ensure database is ready
      await new Promise(resolve => setTimeout(resolve, 200))

      // Call parent callback
      onSelfiesApproved(successfulResults)
      
      // Reset processing state after a brief delay to show success
      // This is important for mobile where component stays mounted
      setTimeout(() => {
        setIsProcessing(false)
      }, 1500)
    } catch (error) {
      console.error('Failed to handle upload:', error)
      onError?.('Selfie upload failed. Please try again.')
      setIsProcessing(false)
    }
  }

  // Handle approval for camera captures
  const handleApprove = async () => {
    const approvalData = pendingApprovalRef.current
    if (!approvalData) {
      console.error('Approval data not found')
      setPendingApproval(null)
      return
    }

    setIsProcessing(true)
    
    try {
      let successfulResults: { key: string; selfieId?: string }[]

      // Check if saveEndpoint is provided (indicates invite flow with direct uploads)
      if (saveEndpoint) {
        // Invite flow: Direct upload - call saveEndpoint
        try {
          const selfieId = await saveEndpoint(approvalData.key)
          successfulResults = [{ key: approvalData.key, selfieId }]
        } catch (error) {
          console.error('Failed to save direct upload:', error)
          throw error
        }
      } else {
        // Standard flow: Promote temp file
        const results = await promoteUploads([approvalData])
        successfulResults = results
      }

      // Small delay to ensure database is ready
      await new Promise(resolve => setTimeout(resolve, 200))

      // Clear approval state
      setPendingApproval(null)
      pendingApprovalRef.current = null

      // Call parent callback
      onSelfiesApproved(successfulResults)
      
      // Reset processing state after a brief delay
      // This is important for mobile where component stays mounted
      setTimeout(() => {
        setIsProcessing(false)
      }, 1500)
    } catch (error) {
      console.error('Failed to approve camera capture:', error)
      onError?.('Failed to approve selfie. Please try again.')
      setIsProcessing(false)
    }
  }

  const handleRetake = () => {
    setPendingApproval(null)
    pendingApprovalRef.current = null
    // Force PhotoUpload remount and trigger camera to reopen
    setCameraKey(prev => prev + 1)
    setShouldOpenCamera(true)
    if (onRetake) {
      onRetake()
    }
  }

  // Show approval screen for camera captures
  if (pendingApproval) {
    return (
      <div data-testid="approval-flow" className="md:static fixed inset-x-0 bottom-0 z-50 md:z-auto bg-white md:bg-transparent" style={{ transform: 'translateZ(0)' }}>
        <SelfieApproval
          uploadedPhotoKey={pendingApproval.key}
          previewUrl={pendingApproval.previewUrl}
          onApprove={handleApprove}
          onRetake={handleRetake}
          onCancel={onCancel}
        />
      </div>
    )
  }

  // When hideHeader is true, render a minimal wrapper for mobile (no padding/border)
  // PhotoUpload component handles all its own styling
  if (hideHeader) {
    const mobileContent = (
      <div data-testid="upload-flow" className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white pt-4 pb-4 px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]" style={{ transform: 'translateZ(0)' }}>
        <div data-testid="mobile-upload-interface" className="[&>div]:!p-0">
          <PhotoUpload
            key={cameraKey}
            multiple
            onUpload={handlePhotoUploadWrapper}
            onUploaded={handlePhotoUploadedWrapper}
            onProcessingCompleteRef={onProcessingCompleteRef}
            testId="desktop-file-input"
            autoOpenCamera={shouldOpenCamera}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    )

    return (
      <>
        {/* Mobile: Fixed at bottom of viewport using portal to ensure it's not affected by parent containers */}
        {typeof window !== 'undefined' && createPortal(mobileContent, document.body)}
        {/* Desktop: Static positioning */}
        <div data-testid="upload-flow-desktop" className="hidden md:block">
          <PhotoUpload
            key={cameraKey}
            multiple
            onUpload={handlePhotoUploadWrapper}
            onUploaded={handlePhotoUploadedWrapper}
            onProcessingCompleteRef={onProcessingCompleteRef}
            testId="desktop-file-input"
            autoOpenCamera={shouldOpenCamera}
            isProcessing={isProcessing}
          />
        </div>
      </>
    )
  }

  return (
    <div data-testid="upload-flow">
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
        <PhotoUpload
          key={cameraKey}
          multiple
          onUpload={handlePhotoUploadWrapper}
          onUploaded={handlePhotoUploadedWrapper}
          onProcessingCompleteRef={onProcessingCompleteRef}
          testId="desktop-file-input"
          autoOpenCamera={shouldOpenCamera}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  )
}
