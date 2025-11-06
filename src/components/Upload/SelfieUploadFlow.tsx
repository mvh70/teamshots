'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import SelfieApproval from './SelfieApproval'
import { useSelfieUpload } from '@/hooks/useSelfieUpload'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })

interface SelfieUploadFlowProps {
  onSelfieApproved: (selfieKey: string, selfieId?: string) => void
  onCancel: () => void
  onError?: (error: string) => void
  onRetake?: () => void
  saveEndpoint?: (key: string) => Promise<void> // Custom save function for invite flows
}

export default function SelfieUploadFlow({ onSelfieApproved, onCancel, onError, onRetake, saveEndpoint }: SelfieUploadFlowProps) {
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
    saveEndpoint
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
        onApprove={handleApprove}
        onReject={handleRejectWrapper}
        onRetake={handleRetakeWrapper}
        onCancel={onCancel}
      />
    )
  }

  if (isApproved) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" data-testid="upload-success">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="success-title">Selfie Approved!</h3>
          <p className="text-sm text-gray-600" data-testid="success-message">Your selfie has been saved successfully.</p>
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
