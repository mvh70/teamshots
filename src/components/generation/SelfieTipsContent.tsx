'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import IntroScreenContent, { IntroTip } from './IntroScreenContent'
import { useMobileViewport } from '@/hooks/useMobileViewport'

interface SelfieTipsContentProps {
  /** 'swipe' for mobile swipe flow, 'button' for desktop with continue button */
  variant: 'swipe' | 'button'
  /** Callback when user clicks Continue (only used when variant='button') */
  onContinue?: () => void
  /** Callback when user chooses to skip future displays */
  onSkip?: () => void
  /** Optional additional class names */
  className?: string
}

export default function SelfieTipsContent({ 
  variant, 
  onContinue,
  onSkip,
  className = ''
}: SelfieTipsContentProps) {
  const t = useTranslations('customization.photoStyle.mobile.selfieTips')
  const tCommon = useTranslations('customization.photoStyle.mobile')
  const tQr = useTranslations('generate.selfie.qrTip')
  const isMobile = useMobileViewport()

  const tips: IntroTip[] = [
    {
      key: 'angles',
      icon: (
        <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      content: {
        type: 'titled',
        title: t('angles.title'),
        description: t('angles.desc')
      }
    },
    {
      key: 'lighting',
      icon: (
        <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      content: {
        type: 'titled',
        title: t('lighting.title'),
        description: t('lighting.desc')
      }
    },
    {
      key: 'distance',
      icon: (
        <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      ),
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      content: {
        type: 'titled',
        title: t('distance.title'),
        description: t('distance.desc')
      }
    },
    {
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
    }
  ]

  if (!isMobile) {
    tips.unshift({
      key: 'qr',
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
        title: tQr('title', { default: 'Upload from your phone' }),
        description: tQr('description', { default: 'Scan this QR code with your phone to upload selfies directly from your camera roll.' })
      }
    })
  }

  return (
    <IntroScreenContent
      variant={variant}
      kicker={t('kicker', { default: 'Get the best results' })}
      title={t('title', { default: 'Selfie tips for amazing photos' })}
      body={t('body', { default: "Great photos start with great selfies. Here's how to nail them." })}
      tips={tips}
      image={{
        src: '/images/good_bad_selfie_2.jpeg',
        alt: 'Examples of good and bad selfies for AI photo generation',
        width: 600,
        height: 320,
        priority: true
      }}
      swipeHintText={tCommon('swipeHint', { default: 'Swipe or tap Next to continue' })}
      continueButtonText="Continue"
      onContinue={onContinue}
      onSkip={onSkip}
      skipText={t('skip', { default: "Don't show again" })}
      className={className}
    />
  )
}
