"use client"

import React from 'react'
import { useTranslations } from 'next-intl'

interface SelfieSelectionBannerProps {
  className?: string
}

export default function SelfieSelectionBanner({ className = '' }: SelfieSelectionBannerProps) {
  const t = useTranslations('selfies.selectionHint')
  return (
    <div className={`rounded-md border border-brand-secondary/30 bg-green-50 text-gray-800 px-4 py-3 text-sm ${className}`.trim()}>
      <p>{t('text')}</p>
    </div>
  )
}
