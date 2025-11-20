'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useSelfieUpload } from '@/hooks/useSelfieUpload'
import { promoteUploads } from '@/lib/uploadHelpers'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRetake: _onRetake,
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

  // Wrapper for handlePhotoUploaded - both single and multiple uploads process directly
  const handlePhotoUploadedWrapper = async (result: { key: string; url?: string } | { key: string; url?: string }[]) => {
    // Set processing state IMMEDIATELY and SYNCHRONOUSLY before any async operations
    // This ensures spinner stays visible without any gaps
    setIsProcessing(true)
    
    try {
      // Normalize to array for consistent handling
      const uploads = Array.isArray(result) ? result : [result]

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

      // Call parent callback - parent will hide this component
      // Keep isProcessing true to prevent flash of upload buttons
      // Component will unmount when parent sets showUpload=false
      onSelfiesApproved(successfulResults)
    } catch (error) {
      console.error('Failed to handle upload:', error)
      onError?.('Selfie upload failed. Please try again.')
      setIsProcessing(false)
    }
  }

  // No approval screen - all uploads process directly

  // When hideHeader is true, render a minimal wrapper for mobile (no padding/border)
  // PhotoUpload component handles all its own styling
  if (hideHeader) {
    return (
      <div data-testid="upload-flow">
        <div data-testid="mobile-upload-interface">
          <PhotoUpload
            multiple
            onUpload={handlePhotoUpload}
            onUploaded={handlePhotoUploadedWrapper}
            onProcessingCompleteRef={onProcessingCompleteRef}
            testId="desktop-file-input"
            autoOpenCamera={false}
            isProcessing={isProcessing}
          />
        </div>
      </div>
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
          multiple
          onUpload={handlePhotoUpload}
          onUploaded={handlePhotoUploadedWrapper}
          onProcessingCompleteRef={onProcessingCompleteRef}
          testId="desktop-file-input"
          autoOpenCamera={false}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  )
}
