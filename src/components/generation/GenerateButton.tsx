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
      className={`w-full ${sizeClasses[size]} font-semibold md:font-medium rounded-2xl md:rounded-md transition-colors shadow-md hover:shadow-lg ${
        isEnabled
          ? 'bg-brand-primary text-white hover:bg-brand-primary-hover'
          : 'bg-brand-primary/30 text-white/70 cursor-not-allowed'
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
      <div className="w-full bg-amber-50 border border-amber-200 rounded-xl shadow-sm animate-fade-in overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="flex-1 text-sm text-amber-900 leading-relaxed">
              {disabledReason}
            </p>
          </div>
        </div>
        <div className="px-4 pb-4">
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
        <div className="mt-2 w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="flex-1 text-sm text-amber-900 leading-relaxed">
              {disabledReason}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

