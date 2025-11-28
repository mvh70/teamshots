'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Lightbulb, X } from 'lucide-react'

interface SelfieInfoBannerProps {
  variant?: 'default' | 'detailed'
  compact?: boolean
  className?: string
}

export default function SelfieInfoBanner({ variant = 'default', compact = false, className = '' }: SelfieInfoBannerProps) {
  const t = useTranslations('selfies.infoBanner')
  const [isDismissed, setIsDismissed] = useState(false)
  
  if (isDismissed) return null
  
  return (
    <div className={`rounded-xl border-2 border-brand-secondary/30 bg-gradient-to-br from-brand-secondary-light via-brand-secondary-light/80 to-white shadow-md hover:shadow-lg transition-all duration-300 ${compact ? 'mb-0' : ''} ${className}`.trim()}>
      <div className="flex gap-4 px-5 py-4 relative">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-10 h-10 rounded-full bg-brand-secondary/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-brand-secondary" strokeWidth={2.5} />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 space-y-2.5">
          {/* Main message with emphasis */}
          <h3 className="text-sm font-bold text-brand-secondary-text leading-tight">
            {t('selected')}
          </h3>
          
          {/* Tip section with lighter styling */}
          <div className="flex gap-2.5 items-start">
            <Lightbulb className="w-4 h-4 text-brand-secondary/80 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-brand-secondary-text-light leading-relaxed">
              {variant === 'detailed' ? t('recommendationDetailed') : t('recommendation')}
            </p>
          </div>
        </div>
        
        {/* Dismiss button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-3 right-3 flex-shrink-0 p-1 rounded-md text-brand-secondary/60 hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors duration-200"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
