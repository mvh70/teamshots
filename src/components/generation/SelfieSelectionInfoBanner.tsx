'use client'

import React from 'react'
import { useTranslations } from 'next-intl'

interface SelfieSelectionInfoBannerProps {
  selectedCount: number
  className?: string
}

export default function SelfieSelectionInfoBanner({ selectedCount, className = '' }: SelfieSelectionInfoBannerProps) {
  const t = useTranslations('selfies.selectionInfo')
  
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`.trim()}>
      <div className="flex items-start">
        <svg className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <div>
          <h3 className="text-sm font-medium text-blue-900">{t('title')}</h3>
          <p className="mt-1 text-sm text-blue-800">
            {selectedCount === 0 
              ? t('noneSelected')
              : selectedCount === 1
              ? t('oneSelected')
              : t('enoughSelected', { count: selectedCount })
            }
          </p>
        </div>
      </div>
    </div>
  )
}

