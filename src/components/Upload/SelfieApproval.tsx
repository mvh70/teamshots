'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PreviewImage } from '@/components/ui'
import { useSelfieClassification } from '@/hooks/useSelfieClassification'
import SelfieTypeBadge from './SelfieTypeBadge'
import type { ClassificationResult } from '@/domain/selfie/selfie-types'

interface SelfieApprovalProps {
  photoKey: string
  previewUrl?: string
  imageFile?: File
  onApprove: (classification?: ClassificationResult) => void
  onRetake: () => void
  onCancel: () => void
}

export default function SelfieApproval({
  photoKey,
  previewUrl,
  imageFile,
  onApprove,
  onRetake,
  onCancel
}: SelfieApprovalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const t = useTranslations('selfieApproval')
  const { isClassifying, result: classification, classify } = useSelfieClassification()

  // Classify the image when component mounts and we have a file
  useEffect(() => {
    if (imageFile) {
      classify(imageFile)
    }
  }, [imageFile, classify])

  const handleApprove = async (e?: React.MouseEvent | React.TouchEvent) => {
    // Prevent double-tap/click on mobile
    if (isProcessing) {
      e?.preventDefault()
      e?.stopPropagation()
      return
    }

    setIsProcessing(true)

    try {
      // Call the approve callback with classification result
      const result = onApprove(classification || undefined)
      
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

  // Check if classification shows the selfie is improper (e.g., multiple faces)
  const isImproper = classification && classification.isProper === false
  const improperReason = classification?.improperReason

  return (
    <div className="md:space-y-6 animate-fade-in" data-testid="approval-screen">
      {/* Main content container */}
      <div className="relative bg-bg-white rounded-3xl md:rounded-2xl shadow-depth-lg border-2 border-brand-primary-lighter/30 p-6 sm:p-8 md:mb-6 overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/[0.02] via-transparent to-brand-secondary/[0.02] pointer-events-none" />
        
        {/* Header with icon and title */}
        <div className="relative flex items-center gap-3 mb-6 sm:mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-primary-hover flex items-center justify-center shadow-depth-md flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-lg font-bold font-display text-text-dark" data-testid="approval-title">
              {t('title')}
            </h1>
            <p className="text-sm text-text-muted hidden sm:block">{t('subtitle')}</p>
          </div>
        </div>

        {/* Quality Guidelines - Compact inline badges with staggered animation */}
        <div className="relative flex flex-wrap items-center justify-center gap-2 mb-6 sm:mb-8" data-testid="quality-guidelines">
          <span className="text-sm font-medium text-text-muted">{t('guidelines.title')}:</span>
          {guidelineItems.map((item, index) => (
            <span 
              key={item.key}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-secondary-light border border-brand-secondary-border text-brand-secondary-text text-xs font-semibold animate-fade-in hover:bg-brand-secondary-lighter hover:scale-105 transition-all duration-200 cursor-default"
              style={{ animationDelay: `${index * 100}ms` }}
              data-testid={item.testId}
            >
              <svg className="w-3.5 h-3.5 text-brand-secondary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {t(`guidelines.${item.key}`)}
            </span>
          ))}
        </div>
        
        {/* Photo Preview - With decorative glow */}
        <div className="relative flex flex-col items-center">
          {/* Pending review indicator and classification badge */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primary text-white text-xs font-bold shadow-depth-md animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
              {t('awaitingApproval')}
            </span>
            {/* Show classification badge when available */}
            {(isClassifying || classification) && !isImproper && (
              <SelfieTypeBadge
                type={classification?.selfieType || 'unknown'}
                confidence={classification?.confidence || 0}
                isLoading={isClassifying}
                className="shadow-depth-sm"
              />
            )}
            {/* Show error when selfie is improper (e.g., multiple faces) */}
            {isImproper && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold shadow-depth-sm border border-red-200">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {t('improperSelfie')}
              </span>
            )}
          </div>
          
          <div className="relative animate-scale-in pt-4">
            {/* Decorative glow background */}
            <div className="absolute -inset-4 bg-gradient-to-br from-brand-primary/25 via-brand-secondary/15 to-brand-primary/25 rounded-[2rem] blur-2xl opacity-50" />
            
            {/* Photo container */}
            <div className="relative rounded-2xl overflow-hidden shadow-depth-2xl ring-4 ring-white bg-white p-1.5">
              <div className="rounded-xl overflow-hidden">
                <PreviewImage
                  src={previewUrl || (photoKey && photoKey !== 'undefined' ? `/api/files/get?key=${encodeURIComponent(photoKey)}` : '/placeholder-image.png')}
                  alt="Uploaded selfie"
                  width={320}
                  height={320}
                  data-testid="selfie-preview"
                />
              </div>
            </div>
          </div>

          {/* Error message when selfie is improper */}
          {isImproper && improperReason && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-center animate-fade-in">
              <p className="text-sm text-red-700 font-medium">{improperReason}</p>
              <p className="text-xs text-red-600 mt-1">
                {t('pleaseRetake')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons - Responsive */}
      <div className="relative bg-bg-white rounded-t-3xl md:rounded-2xl shadow-depth-xl border-t-2 border-x-2 md:border-2 border-brand-primary-lighter/30 pt-6 px-5 pb-5 sm:pt-8 sm:px-8 sm:pb-6 overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-secondary/[0.02] to-transparent pointer-events-none" />
        
        {/* Button container with clear visual hierarchy */}
        <div className="relative space-y-4">
          {/* Primary action - most prominent */}
          <button
            onClick={handleApprove}
            onTouchEnd={handleApproveTouch}
            disabled={isProcessing || isClassifying || !!isImproper}
            className={`group w-full px-10 py-4 rounded-2xl text-base font-bold transition-all duration-300 touch-manipulation shadow-depth-lg flex items-center justify-center gap-2.5 ${
              isProcessing || isClassifying || isImproper
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white hover:shadow-depth-xl hover:shadow-brand-cta-shadow/50 hover:-translate-y-0.5 active:scale-[0.98] focus:ring-4 focus:ring-brand-cta-ring/50 focus:outline-none'
            }`}
            data-testid="approve-button"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isProcessing ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('buttons.processing')}
              </>
            ) : isClassifying ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('buttons.analyzing')}
              </>
            ) : isImproper ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('buttons.cannotApprove')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {t('buttons.approveContinue')}
              </>
            )}
          </button>

          {/* Secondary actions row */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
            <button
              onClick={handleRetake}
              disabled={isProcessing}
              className="group flex-1 sm:flex-none sm:min-w-[160px] px-6 py-3.5 border-2 border-brand-primary-lighter text-text-body rounded-xl hover:bg-brand-primary-light hover:border-brand-primary/40 text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="retake-button"
            >
              <svg className="w-4 h-4 group-hover:rotate-[-15deg] transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('buttons.retakePhoto')}
            </button>

            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className="flex-1 sm:flex-none sm:min-w-[120px] px-6 py-3.5 text-text-muted rounded-xl hover:bg-bg-gray-50 hover:text-text-body text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-gray-200"
              data-testid="cancel-button"
            >
              {t('buttons.cancel')}
            </button>
          </div>
        </div>
        
        {/* Disclaimer with subtle styling */}
        <div className="relative flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-100 text-xs text-text-muted hover:text-text-body transition-colors">
          <svg className="w-4 h-4 text-brand-secondary/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>{t('disclaimer')}</span>
        </div>
      </div>
    </div>
  )
}
