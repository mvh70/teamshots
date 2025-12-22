'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { ArrowsRightLeftIcon, SparklesIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import IntroScreenContent, { IntroTip } from './IntroScreenContent'
import { useMobileViewport } from '@/hooks/useMobileViewport'

interface CustomizationIntroContentProps {
  /** 'swipe' for mobile swipe flow, 'button' for desktop with continue button */
  variant: 'swipe' | 'button'
  /** Callback when user clicks Continue (only used when variant='button') */
  onContinue?: () => void
  /** Callback when user chooses to skip future displays */
  onSkip?: () => void
  /** Optional additional class names */
  className?: string
}

export default function CustomizationIntroContent({ 
  variant, 
  onContinue,
  onSkip,
  className = ''
}: CustomizationIntroContentProps) {
  const t = useTranslations('customization.photoStyle.mobile.intro')
  const tCommon = useTranslations('customization.photoStyle.mobile')
  const isMobile = useMobileViewport()

  // Desktop-specific body text (no swipe instructions)
  const bodyText = variant === 'swipe'
    ? t('body', { default: "You can change how your photo looks, the background, the pose, the expression, etc. On the next page, you can customize each one of them, except the ones set by your team admin" })
    : t('bodyDesktop', { default: "You can change how your photo looks, the background, the pose, the expression, etc. On the next page, you can customize each one of them, except the ones set by your team admin" })

  // Navigation instruction (mobile only)
  const navigationText = t('swipe', { default: "Swipe right to move forward, left to go back. You can also use the navigation buttons below." })

  const tips: IntroTip[] = [
    // Show navigation tip only on mobile
    ...(isMobile ? [{
      key: 'navigation',
      icon: <ArrowsRightLeftIcon className="h-6 w-6 md:h-7 md:w-7" />,
      bgColor: 'bg-brand-primary/10',
      textColor: 'text-brand-primary',
      content: { type: 'simple' as const, text: navigationText }
    }] : []),
    {
      key: 'editable',
      icon: <SparklesIcon className="h-6 w-6 md:h-7 md:w-7" />,
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      content: { 
        type: 'simple', 
        text: t('editable', { default: "The stars icon means you can edit this setting. Adjust until it matches your preferences." })
      }
    },
    {
      key: 'locked',
      icon: <LockClosedIcon className="h-6 w-6 md:h-7 md:w-7" />,
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      content: { 
        type: 'simple', 
        text: t('locked', { default: "The lock icon means your team admin fixed these. You can view them but not change to maintain consistency." })
      }
    }
  ]

  return (
    <IntroScreenContent
      variant={variant}
      kicker={t('kicker', { default: '' })}
      title={t('title', { default: 'Now, customize your photo' })}
      body={bodyText}
      tips={tips}
      swipeHintText={tCommon('swipeHint', { default: 'Swipe or tap Next to continue' })}
      continueButtonText={t('continueButton', { default: 'Continue to customize' })}
      onContinue={onContinue}
      onSkip={onSkip}
      skipText={t('skip', { default: "Don't show again" })}
      className={className}
    />
  )
}
