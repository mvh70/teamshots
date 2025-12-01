'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { ArrowsRightLeftIcon, SparklesIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import IntroScreenContent, { IntroTip } from './IntroScreenContent'

interface CustomizationIntroContentProps {
  /** 'swipe' for mobile swipe flow, 'button' for desktop with continue button */
  variant: 'swipe' | 'button'
  /** Callback when user clicks Continue (only used when variant='button') */
  onContinue?: () => void
  /** Optional additional class names */
  className?: string
}

export default function CustomizationIntroContent({ 
  variant, 
  onContinue,
  className = ''
}: CustomizationIntroContentProps) {
  const t = useTranslations('customization.photoStyle.mobile.intro')
  const tCommon = useTranslations('customization.photoStyle.mobile')

  // Desktop-specific body text (no swipe instructions)
  const bodyText = variant === 'swipe'
    ? t('body', { default: "You're about to customize how your photos look. Each card tweaks one part of the shoot, so swipe through and make it yours." })
    : t('bodyDesktop', { default: "You're about to customize how your photos look. Each section below controls a different aspect of your professional headshot." })

  // Navigation instruction adapts to variant
  const navigationText = variant === 'swipe'
    ? t('swipe', { default: "Swipe right to move forward, left to review. Prefer buttons? The little chevrons below have your back." })
    : t('scrollDesktop', { default: "Scroll down to see all customization options. Adjust each setting to match your preferences." })

  const tips: IntroTip[] = [
    {
      key: 'navigation',
      icon: <ArrowsRightLeftIcon className="h-5 w-5" />,
      bgColor: 'bg-brand-primary/10',
      textColor: 'text-brand-primary',
      content: { type: 'simple', text: navigationText }
    },
    {
      key: 'editable',
      icon: <SparklesIcon className="h-5 w-5" />,
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      content: { 
        type: 'simple', 
        text: t('editable', { default: "Sparkles badge means you're in charge. Adjust until the vibe matches your story." })
      }
    },
    {
      key: 'locked',
      icon: <LockClosedIcon className="h-5 w-5" />,
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      content: { 
        type: 'simple', 
        text: t('locked', { default: "Lock badge means your team already set it. Peek, but no touching—consistency matters." })
      }
    }
  ]

  return (
    <IntroScreenContent
      variant={variant}
      kicker={t('kicker', { default: 'Before you dive in' })}
      title={t('title', { default: 'A quick pit stop before the glow-up' })}
      body={bodyText}
      tips={tips}
      swipeHintText={tCommon('swipeHint', { default: 'Swipe or tap Next to continue' })}
      continueButtonText="Continue to customize"
      onContinue={onContinue}
      className={className}
    />
  )
}
