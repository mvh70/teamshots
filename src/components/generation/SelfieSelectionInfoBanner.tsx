'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { useMobileViewport } from '@/hooks/useMobileViewport'

interface SelfieSelectionInfoBannerProps {
  selectedCount: number
  className?: string
  showSwipeHint?: boolean
}

export default function SelfieSelectionInfoBanner({ selectedCount, className = '', showSwipeHint = false }: SelfieSelectionInfoBannerProps) {
  const t = useTranslations('selfies.selectionInfo')
  const hint = useTranslations('selfies.selectionHint')
  const isMobile = useMobileViewport()

  const remaining = Math.max(0, 2 - selectedCount)
  const showSwipe = showSwipeHint && selectedCount >= 2
  
  // Different hint text for mobile (swipe) vs desktop (click)
  const readyHintText = isMobile 
    ? t('swipeHint', { default: 'Swipe right when you\'re ready to customize.' })
    : t('clickHint', { default: 'Click Continue when you\'re ready to customize.' })

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50/80 to-purple-50/40 border border-blue-200/60 rounded-2xl p-5 sm:p-6 shadow-lg shadow-blue-100/40 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-blue-200/50 hover:border-blue-300/60 focus-within:ring-2 focus-within:ring-blue-500/20 ${className}`.trim()}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgb(59 130 246) 1px, transparent 0)',
            backgroundSize: '28px 28px'
          }}
        />
      </div>

      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

      <div className="relative flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/40 ring-2 ring-blue-100/60">
          <svg className="h-5 w-5 text-white drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-blue-600">{t('title')}</p>
            <p className="mt-1 text-sm text-blue-900/80">
              {remaining > 0
                ? hint('text', { default: 'Select at least 2 selfies for best results.' })
                : readyHintText}
            </p>
          </div>
          {showSwipe && (
            <div className="inline-flex items-center gap-2 text-blue-700 font-semibold text-sm">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {readyHintText}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

