'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Lightbulb } from 'lucide-react'

interface SelfieInfoBannerProps {
  variant?: 'default' | 'detailed'
  compact?: boolean
  className?: string
}

export default function SelfieInfoBanner({ variant = 'default', compact = false, className = '' }: SelfieInfoBannerProps) {
  const t = useTranslations('selfies.infoBanner')
  
  return (
    <div className={`rounded-lg border-2 border-brand-secondary/40 bg-brand-secondary-light shadow-sm ${compact ? 'mb-0' : ''} ${className}`.trim()}>
      <div className="flex gap-3 px-4 py-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <CheckCircle2 className="w-5 h-5 text-brand-secondary" strokeWidth={2.5} />
        </div>
        
        {/* Content */}
        <div className="flex-1 space-y-2">
          {/* Main message with emphasis */}
          <p className="text-sm font-semibold text-brand-secondary-text">
            {t('selected')}
          </p>
          
          {/* Tip section with lighter styling */}
          <div className="flex gap-2 items-start">
            <Lightbulb className="w-4 h-4 text-brand-secondary/70 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-brand-secondary-text-light leading-relaxed">
              {variant === 'detailed' ? t('recommendationDetailed') : t('recommendation')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
