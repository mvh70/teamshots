'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import SelfieApproval from './SelfieApproval'
import SelfieUploadSuccess from './SelfieUploadSuccess'
import { useSelfieUpload } from '@/hooks/useSelfieUpload'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })

interface SelfieUploadFlowProps {
  onSelfieApproved: (selfieKey: string, selfieId?: string) => void
  onCancel: () => void
  onError?: (error: string) => void
  onRetake?: () => void
  saveEndpoint?: (key: string) => Promise<string | undefined> // Custom save function for invite flows, can return selfie ID
  uploadEndpoint?: (file: File) => Promise<{ key: string; url?: string }> // Custom upload function for invite flows or other custom flows
  hideHeader?: boolean // Hide title and cancel button for compact/sticky views
}

export default function SelfieUploadFlow({ onSelfieApproved, onCancel, onError, onRetake, saveEndpoint, uploadEndpoint, hideHeader = false }: SelfieUploadFlowProps) {
  // Debug: always log hideHeader value to verify prop is received
  if (typeof window !== 'undefined') {
    console.log('[SelfieUploadFlow] hideHeader prop value:', hideHeader)
  }
  const t = useTranslations('selfies')
  const {
    uploadedKey,
    isApproved,
    handlePhotoUpload,
    handlePhotoUploaded,
    handleApprove,
    handleReject,
    handleRetake
  } = useSelfieUpload({
    onSuccess: (key, id) => {
      onSelfieApproved(key, id)
    },
    onError: onError,
    saveEndpoint,
    uploadEndpoint
  })

  // Store the preview URL for the approval screen
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [forceCamera, setForceCamera] = useState<boolean>(false)

  // Wrapper for handlePhotoUploaded to store preview URL
  const handlePhotoUploadedWrapper = async (result: { key: string; url?: string }) => {
    try {
      await handlePhotoUploaded(result)
      if (result.url) {
        setPreviewUrl(result.url)
      }
    } catch (error) {
      console.error('Failed to handle upload:', error)
      onError?.('Selfie upload failed. Please try again.')
    }
  }

  // Wrapper for handleRetake to call parent callback
  const handleRetakeWrapper = async () => {
    await handleRetake()
    setForceCamera(true)
    onRetake?.()
  }

  // Wrapper for handleReject to call parent onCancel callback
  const handleRejectWrapper = async () => {
    await handleReject()
    onCancel()
  }

  if (uploadedKey && !isApproved) {
    return (
      <SelfieApproval
        uploadedPhotoKey={uploadedKey}
        previewUrl={previewUrl || undefined}
        onApprove={async () => {
          // Ensure the async operation completes and state updates propagate on mobile
          try {
            await handleApprove()
            // Force a small delay to ensure React state updates propagate on mobile browsers
            // This helps with mobile browsers that batch state updates differently
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (error) {
            console.error('Error in onApprove callback:', error)
            throw error
          }
        }}
        onRetake={handleRetakeWrapper}
        onCancel={() => {
          // On cancel, reject the upload
          handleRejectWrapper()
        }}
      />
    )
  }

  if (isApproved) {
    return <SelfieUploadSuccess />
  }

  // When hideHeader is true, render a minimal wrapper for mobile (no padding/border)
  // but keep styling for desktop
  if (hideHeader) {
    return (
      <div className="md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 md:p-6" data-testid="upload-flow">
        <div data-testid="mobile-upload-interface">
          <div className="md:max-w-md">
            <PhotoUpload onUpload={handlePhotoUpload} onUploaded={handlePhotoUploadedWrapper} testId="desktop-file-input" autoOpenCamera={forceCamera} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" data-testid="upload-flow">
      <div data-testid="mobile-upload-interface">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900" data-testid="desktop-upload-title">{t('upload.title')}</h2>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
            data-testid="cancel-upload"
          >
            Cancel
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4" data-testid="upload-description">{t('upload.description')}</p>
        <div className="max-w-md">
          <PhotoUpload onUpload={handlePhotoUpload} onUploaded={handlePhotoUploadedWrapper} testId="desktop-file-input" autoOpenCamera={forceCamera} />
        </div>
      </div>
    </div>
  )
}
