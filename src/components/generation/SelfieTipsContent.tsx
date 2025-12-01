'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import IntroScreenContent, { IntroTip } from './IntroScreenContent'

interface SelfieTipsContentProps {
  /** 'swipe' for mobile swipe flow, 'button' for desktop with continue button */
  variant: 'swipe' | 'button'
  /** Callback when user clicks Continue (only used when variant='button') */
  onContinue?: () => void
  /** Optional additional class names */
  className?: string
}

export default function SelfieTipsContent({ 
  variant, 
  onContinue,
  className = ''
}: SelfieTipsContentProps) {
  const t = useTranslations('customization.photoStyle.mobile.selfieTips')
  const tCommon = useTranslations('customization.photoStyle.mobile')

  const tips: IntroTip[] = [
    {
      key: 'angles',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  return (
    <IntroScreenContent
      variant={variant}
      kicker={t('kicker', { default: 'Get the best results' })}
      title={t('title', { default: 'Selfie tips for amazing photos' })}
      body={t('body', { default: "Great photos start with great selfies. Here's how to nail them." })}
      tips={tips}
      image={{
        src: '/samples/good_bad_selfie.jpeg',
        alt: 'Examples of good and bad selfies for AI photo generation',
        width: 600,
        height: 300,
        priority: true
      }}
      swipeHintText={tCommon('swipeHint', { default: 'Swipe or tap Next to continue' })}
      continueButtonText="Continue"
      onContinue={onContinue}
      className={className}
    />
  )
}
