'use client'

import React, { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import IntroScreenContent, { IntroTip } from './IntroScreenContent'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { preloadFaceDetectionModel } from '@/lib/face-detection'

interface SelfieTipsContentProps {
  /** 'swipe' for mobile swipe flow, 'button' for desktop with continue button */
  variant: 'swipe' | 'button'
  /** Callback when user clicks Continue (only used when variant='button') */
  onContinue?: () => void
  /** Callback when user chooses to skip future displays */
  onSkip?: () => void
  /** Hide the bottom continue button and skip link (when using dock navigation instead) */
  hideBottomActions?: boolean
  /** Optional additional class names */
  className?: string
}

export default function SelfieTipsContent({
  variant,
  onContinue,
  onSkip,
  hideBottomActions = false,
  className = ''
}: SelfieTipsContentProps) {
  const t = useTranslations('customization.photoStyle.mobile.selfieTips')
  const tCommon = useTranslations('customization.photoStyle.mobile')
  const tQr = useTranslations('generate.selfie.qrTip')
  const isMobile = useMobileViewport()

  // Preload face detection model in the background while user reads tips
  useEffect(() => {
    console.log('[SelfieTipsContent] Preloading face detection model...')
    preloadFaceDetectionModel()
  }, [])

  // Build sub-points for quality tip - condensed on mobile
  const qualitySubPoints = t.raw('quality.subPoints') as string[]
  const qualityDescription = (
    <div className="space-y-2 md:space-y-3">
      <p className="text-sm md:text-lg text-gray-600 leading-relaxed">
        {t('quality.desc')}
      </p>
      <ul className="space-y-1.5 md:space-y-2 ml-1">
        {qualitySubPoints.slice(0, isMobile ? 3 : qualitySubPoints.length).map((point, index) => (
          <li key={index} className="flex items-start gap-2 text-sm md:text-lg text-gray-600 leading-relaxed">
            <span className="text-indigo-600 font-bold flex-shrink-0 leading-relaxed">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  const tips: IntroTip[] = [
    {
      key: 'quality',
      icon: (
        <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      bgColor: 'bg-indigo-100',
      textColor: 'text-indigo-700',
      content: {
        type: 'titled' as const,
        title: t('quality.title'),
        description: qualityDescription
      }
    }
  ]

  if (!isMobile) {
    tips.push({
      key: 'mobileQuality',
      icon: (
        <svg className="h-6 w-6 md:h-7 md:w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="6" height="6" />
          <rect x="15" y="3" width="6" height="6" />
          <rect x="3" y="15" width="6" height="6" />
          <path d="M15 15h2v2h-2z" />
          <path d="M19 15h2v2h-2z" />
          <path d="M17 17h2v2h-2z" />
          <path d="M15 19h2v2h-2z" />
          <path d="M19 19h2v2h-2z" />
        </svg>
      ),
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      content: {
        type: 'titled',
        title: t('mobileQuality.title'),
        description: t('mobileQuality.desc')
      }
    })
  }

  tips.push({
    key: 'minimum',
    icon: (
      <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    content: {
      type: 'titled',
      title: t('minimum.title'),
      description: t('minimum.desc')
    }
  })

  tips.push({
    key: 'expression',
    icon: (
      <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    content: {
      type: 'titled',
      title: t('expression.title'),
      description: t('expression.desc')
    }
  })

  return (
    <div className={className}>
      <IntroScreenContent
        variant={variant}
        kicker=""
        title={t('title', { default: 'First, take or upload your selfies' })}
        body={t('body', { default: "Great photos start with great selfies. Here's how to nail them." })}
        tips={tips}
        images={{
          good: {
            src: '/images/good_selfies_1.png',
            alt: 'Examples of good selfies for AI photo generation',
            width: 300,
            height: 300,
            priority: true
          },
          bad: {
            src: '/images/bad_selfies_1.png',
            alt: 'Examples of bad selfies for AI photo generation',
            width: 300,
            height: 300,
            priority: true
          }
        }}
        swipeHintText={tCommon('swipeHint', { default: 'Swipe or tap Next to continue' })}
        continueButtonText={t('continueButton', { default: 'Continue to selfie upload' })}
        onContinue={onContinue}
        onSkip={onSkip}
        skipText={t('skip', { default: "Don't show again" })}
        hideBottomActions={hideBottomActions}
      />
    </div>
  )
}
