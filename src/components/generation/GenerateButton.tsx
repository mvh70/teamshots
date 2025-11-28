'use client'

import React from 'react'

interface GenerateButtonProps {
  onClick: () => void
  disabled?: boolean
  isGenerating?: boolean
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
  disabledReason?: string
  integrateInPopover?: boolean
}

export default function GenerateButton({
  onClick,
  disabled = false,
  isGenerating = false,
  children,
  className = '',
  size = 'md',
  disabledReason,
  integrateInPopover = false
}: GenerateButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-4 md:px-4 md:py-2 text-lg md:text-sm',
    lg: 'px-6 py-4 text-lg'
  }

  const isDisabled = disabled || isGenerating
  const isEnabled = !isDisabled
  const showPopover = isDisabled && disabledReason

  const buttonElement = (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full ${sizeClasses[size]} font-semibold md:font-medium rounded-xl transition-all duration-200 ${
        isEnabled
          ? 'bg-gradient-to-r from-brand-primary to-indigo-600 text-white hover:from-brand-primary-hover hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0'
          : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-sm'
      } ${className}`}
    >
      {isGenerating ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Starting generation...
        </span>
      ) : (
        children
      )}
    </button>
  )

  // If integrating in popover and popover should show, render button inside popover
  if (integrateInPopover && showPopover) {
    return (
      <div className="w-full bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/60 rounded-xl shadow-md animate-fade-in overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="flex-1 text-sm font-medium text-amber-900 leading-relaxed">
              {disabledReason}
            </p>
          </div>
        </div>
        <div className="px-5 pb-5">
          {buttonElement}
        </div>
      </div>
    )
  }

  // Default: button with popover below
  return (
    <div className="relative">
      {buttonElement}
      {showPopover && (
        <div className="mt-3 w-full px-5 py-4 bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/60 rounded-xl shadow-md animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="flex-1 text-sm font-medium text-amber-900 leading-relaxed">
              {disabledReason}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

