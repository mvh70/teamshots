'use client'

import React from 'react'
import { useTranslations } from 'next-intl'

interface SelfieInfoBannerProps {
  variant?: 'default' | 'detailed'
  compact?: boolean
  className?: string
}

export default function SelfieInfoBanner({ variant = 'default', compact = false, className = '' }: SelfieInfoBannerProps) {
  const t = useTranslations('selfies.infoBanner')
  const base = `rounded-md border border-brand-secondary/30 bg-green-50 text-gray-800 px-4 py-3 text-sm ${compact ? 'mb-0' : ''}`
  return (
    <div className={`${base} ${className}`.trim()}>
      <p className="mb-1">{t('selected')}</p>
      {variant === 'detailed' ? (
        <p>{t('recommendationDetailed')}</p>
      ) : (
        <p>{t('recommendation')}</p>
      )}
    </div>
  )
}
