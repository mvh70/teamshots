'use client'

import React from 'react'

interface GenerateButtonProps {
  onClick: () => void
  disabled?: boolean
  isGenerating?: boolean
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function GenerateButton({
  onClick,
  disabled = false,
  isGenerating = false,
  children,
  className = '',
  size = 'md'
}: GenerateButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-4 md:px-4 md:py-2 text-lg md:text-sm',
    lg: 'px-6 py-4 text-lg'
  }

  const isDisabled = disabled || isGenerating
  const isEnabled = !isDisabled

  return (
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
}

