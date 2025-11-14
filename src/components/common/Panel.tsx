'use client'

import { ReactNode } from 'react'

interface PanelProps {
  title: string
  subtitle?: string
  onClose?: () => void
  children: ReactNode
  className?: string
}

export default function Panel({ title, subtitle, onClose, children, className = '' }: PanelProps) {
  return (
    <div className={`bg-white rounded-xl md:rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-xl font-semibold text-gray-900 break-words">{title}</h2>
          {subtitle && (
            <p className="text-base sm:text-sm text-gray-600 mt-2 sm:mt-1">{subtitle}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 -mr-2 text-gray-400 hover:text-gray-600 touch-manipulation"
            aria-label="Close"
          >
            <svg className="h-7 w-7 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {children}
    </div>
  )
}


