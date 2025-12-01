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
  const isMobile = useMobileViewport()

  // Desktop-specific body text (no swipe instructions)
  const bodyText = variant === 'swipe'
    ? t('body', { default: "You're about to customize how your photos look. Each card controls one part of the shoot. Swipe through and adjust to match your preferences." })
    : t('bodyDesktop', { default: "You're about to customize how your photos look. Each section below controls a different aspect of your professional headshot." })

  // Navigation instruction (mobile only)
  const navigationText = t('swipe', { default: "Swipe right to move forward, left to go back. You can also use the navigation buttons below." })

  const tips: IntroTip[] = [
    // Show navigation tip only on mobile
    ...(isMobile ? [{
      key: 'navigation',
      icon: <ArrowsRightLeftIcon className="h-6 w-6 md:h-7 md:w-7" />,
      bgColor: 'bg-brand-primary/10',
      textColor: 'text-brand-primary',
      content: { type: 'simple', text: navigationText }
    }] : []),
    {
      key: 'editable',
      icon: <SparklesIcon className="h-6 w-6 md:h-7 md:w-7" />,
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      content: { 
        type: 'simple', 
        text: t('editable', { default: "Sparkles badge means you can edit this setting. Adjust until it matches your preferences." })
      }
    },
    {
      key: 'locked',
      icon: <LockClosedIcon className="h-6 w-6 md:h-7 md:w-7" />,
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      content: { 
        type: 'simple', 
        text: t('locked', { default: "Lock badge means your team admin set this. You can view it but not change it to maintain consistency." })
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
