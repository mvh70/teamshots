'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

interface SelfieApprovalProps {
  uploadedPhotoKey: string
  previewUrl?: string
  onApprove: () => void
  onReject: () => void
  onRetake: () => void
  onCancel: () => void
}

export default function SelfieApproval({
  uploadedPhotoKey,
  previewUrl,
  onApprove,
  onReject,
  onRetake,
  onCancel
}: SelfieApprovalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const t = useTranslations('selfieApproval')

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      onApprove()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = () => {
    onReject()
    onCancel()
  }

  const handleRetake = () => {
    onRetake()
  }


  // Common guideline items
  const guidelineItems = [
    { key: 'clearFace', testId: 'guideline-clear-face' },
    { key: 'lookingAtCamera', testId: 'guideline-looking-camera' },
    { key: 'goodResolution', testId: 'guideline-good-resolution' },
    { key: 'cleanBackground', testId: 'guideline-clean-background' }
  ]

  const renderGuidelineItem = (item: typeof guidelineItems[0]) => (
    <div 
      key={item.key}
      className="flex items-center justify-center md:justify-start gap-1 md:gap-2"
      data-testid={item.testId}
    >
      <svg 
        className="w-3 h-3 md:w-4 md:h-4 text-blue-600 flex-shrink-0" 
        fill="currentColor" 
        viewBox="0 0 20 20"
      >
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      <span>{t(`guidelines.${item.key}`)}</span>
    </div>
  )

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
    const placeholder = target.nextElementSibling as HTMLElement;
    if (placeholder) placeholder.style.display = 'flex';
  }

  return (
    <div className="space-y-6" data-testid="approval-screen">
      {/* Main content container */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        <h1 className="text-lg md:text-xl font-semibold text-gray-900 mb-4" data-testid="approval-title">
          {t('title')}
        </h1>
        
        {/* Quality Guidelines - Responsive */}
        <div className="flex justify-center mb-4 md:mb-6">
          <div className="bg-blue-50 rounded-md md:rounded-lg border border-blue-200 p-3 md:p-4 max-w-md" data-testid="quality-guidelines">
            <h3 className="text-xs md:text-sm font-medium text-blue-900 mb-2 text-center">{t('guidelines.title')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 md:gap-2 text-xs md:text-sm text-blue-800">
              {guidelineItems.map(item => renderGuidelineItem(item))}
            </div>
          </div>
        </div>
        
        {/* Photo Preview - Responsive */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative" data-testid="selfie-preview">
            <Image 
              src={previewUrl || (uploadedPhotoKey && uploadedPhotoKey !== 'undefined' ? `/api/files/get?key=${encodeURIComponent(uploadedPhotoKey)}` : '/placeholder-image.png')}
              alt="Uploaded selfie" 
              width={300}
              height={300}
              className="w-full max-w-sm h-auto rounded-lg border border-gray-200 shadow-sm"
              unoptimized
              data-testid="selfie-image"
              onError={handleImageError}
            />
            <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center" style={{ display: 'none' }}>
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Responsive */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className={`px-6 py-2 md:py-2 rounded-md text-sm font-medium transition-colors ${
              isProcessing
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-brand-primary text-white hover:bg-brand-primary-hover'
            }`}
            data-testid="approve-button"
          >
            {isProcessing ? t('buttons.processing') : t('buttons.approveContinue')}
          </button>
          
          <button
            onClick={handleRetake}
            disabled={isProcessing}
            className="px-6 py-2 md:py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="retake-button"
          >
            {t('buttons.retakePhoto')}
          </button>
          
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="px-6 py-2 md:py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="cancel-button"
          >
            {t('buttons.cancel')}
          </button>
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-3">
          {t('disclaimer')}
        </p>
      </div>
    </div>
  )
}
