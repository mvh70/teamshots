'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PreviewImage } from '@/components/ui'

interface SelfieApprovalProps {
  uploadedPhotoKey: string
  previewUrl?: string
  onApprove: () => void
  onRetake: () => void
  onCancel: () => void
}

export default function SelfieApproval({
  uploadedPhotoKey,
  previewUrl,
  onApprove,
  onRetake,
  onCancel
}: SelfieApprovalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const t = useTranslations('selfieApproval')

  const handleApprove = async (e?: React.MouseEvent | React.TouchEvent) => {
    // Prevent double-tap/click on mobile
    if (isProcessing) {
      e?.preventDefault()
      e?.stopPropagation()
      return
    }
    
    setIsProcessing(true)
    
    try {
      // Call the approve callback - it may be async, so wrap it
      const result = onApprove()
      
      // If it returns a promise, wait for it to complete
      // This is especially important on mobile where async operations can be delayed
      if (result !== undefined && typeof result === 'object' && result !== null && 'then' in result) {
        await result
      }
      
      // Give mobile browsers time to process the state update
      // Don't reset immediately - let the parent component handle the state transition
      // The parent will hide this component when approval succeeds
    } catch (error) {
      console.error('Error in handleApprove:', error)
      // Reset processing state on error so user can try again
      setIsProcessing(false)
    }
    // Note: We intentionally don't reset isProcessing in finally
    // The parent component will handle hiding this component when approval succeeds
  }
  
  // Mobile-friendly touch handler with better event handling
  const handleApproveTouch = (e: React.TouchEvent) => {
    // Prevent default touch behavior that might interfere
    e.preventDefault()
    e.stopPropagation()
    
    // Use a small delay to ensure touch event is fully processed
    // This helps prevent double-tap issues on mobile
    setTimeout(() => {
      handleApprove(e)
    }, 50)
  }

  const handleCancel = () => {
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


  return (
    <div className="md:space-y-6" data-testid="approval-screen">
      {/* Main content container */}
      <div className="bg-white rounded-xl md:rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6 md:p-6 md:mb-6">
        <h1 className="text-xl sm:text-lg font-semibold text-gray-900 mb-5 sm:mb-4" data-testid="approval-title">
          {t('title')}
        </h1>

        {/* Quality Guidelines - Responsive */}
        <div className="flex justify-center mb-5 sm:mb-6">
          <div className="bg-blue-50 rounded-xl md:rounded-lg border border-blue-200 p-4 md:p-4 max-w-md w-full" data-testid="quality-guidelines">
            <h3 className="text-base md:text-sm font-medium text-blue-900 mb-3 md:mb-2 text-center">{t('guidelines.title')}</h3>
            {/* Stack guidelines vertically on mobile for better readability */}
            <div className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-2 text-sm md:text-xs text-blue-800">
              {guidelineItems.map(item => renderGuidelineItem(item))}
            </div>
          </div>
        </div>
        
        {/* Photo Preview - Responsive */}
        <div className="flex flex-col items-center space-y-4">
          <PreviewImage
            src={previewUrl || (uploadedPhotoKey && uploadedPhotoKey !== 'undefined' ? `/api/files/get?key=${encodeURIComponent(uploadedPhotoKey)}` : '/placeholder-image.png')}
            alt="Uploaded selfie"
            width={300}
            height={300}
            data-testid="selfie-preview"
          />
        </div>
      </div>

      {/* Action Buttons - Responsive */}
      <div className="bg-white rounded-t-xl md:rounded-lg shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] border-t border-x md:border border-gray-200 pt-4 px-4 pb-4 sm:pt-6 sm:px-6 sm:pb-4 md:pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-3 sm:justify-center">
          <button
            onClick={handleApprove}
            onTouchEnd={handleApproveTouch}
            disabled={isProcessing}
            className={`w-full sm:w-auto px-8 py-4 sm:px-6 sm:py-2 rounded-xl sm:rounded-md text-lg sm:text-sm font-semibold sm:font-medium transition-colors touch-manipulation ${
              isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-hover'
            }`}
            data-testid="approve-button"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isProcessing ? t('buttons.processing') : t('buttons.approveContinue')}
          </button>

          <button
            onClick={handleRetake}
            disabled={isProcessing}
            className="w-full sm:w-auto px-8 py-4 sm:px-6 sm:py-2 border-2 sm:border border-gray-300 text-gray-700 rounded-xl sm:rounded-md hover:bg-gray-50 text-lg sm:text-sm font-semibold sm:font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="retake-button"
          >
            {t('buttons.retakePhoto')}
          </button>

          <button
            onClick={handleCancel}
            disabled={isProcessing}
            className="w-full sm:w-auto px-8 py-4 sm:px-6 sm:py-2 border-2 sm:border border-gray-300 text-gray-700 rounded-xl sm:rounded-md hover:bg-gray-50 text-lg sm:text-sm font-semibold sm:font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
