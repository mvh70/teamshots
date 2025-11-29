'use client'

import React from 'react'
import { useTranslations } from 'next-intl'

interface SelfieSelectionInfoBannerProps {
  selectedCount: number
  className?: string
  showSwipeHint?: boolean
}

export default function SelfieSelectionInfoBanner({ selectedCount, className = '', showSwipeHint = false }: SelfieSelectionInfoBannerProps) {
  const t = useTranslations('selfies.selectionInfo')
  
  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-200/60 rounded-xl p-5 shadow-sm ${className}`.trim()}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">{t('title')}</h3>
          <p className="text-sm text-blue-800 leading-relaxed">
            {selectedCount === 0 
              ? t('noneSelected')
              : selectedCount === 1
              ? t('oneSelected')
              : t('enoughSelected', { count: selectedCount })
            }
            {showSwipeHint && selectedCount >= 2 && (
              <span className="block mt-1 text-blue-700">{t('swipeHint', { default: 'Swipe right when you\'re ready to customize.' })}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

