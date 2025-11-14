'use client'

import React from 'react'
import { XCircleIcon } from '@heroicons/react/24/outline'

interface ErrorDisplayProps {
  title?: string
  message: string
  variant?: 'inline' | 'banner' | 'card'
  size?: 'sm' | 'md' | 'lg'
  onDismiss?: () => void
  className?: string
  'data-testid'?: string
}

export function ErrorDisplay({
  title,
  message,
  variant = 'banner',
  size = 'md',
  onDismiss,
  className = '',
  'data-testid': testId = 'error-display'
}: ErrorDisplayProps) {
  const sizeClasses = {
    sm: 'p-3 text-sm',
    md: 'p-4 text-sm',
    lg: 'p-6 text-base'
  }

  const baseClasses = 'rounded-md border'

  const variantClasses = {
    inline: 'text-red-600',
    banner: `${baseClasses} bg-red-50 border-red-200 ${sizeClasses[size]}`,
    card: `${baseClasses} bg-white border-red-200 shadow-sm ${sizeClasses[size]}`
  }

  const content = (
    <div className="flex items-start gap-3">
      {variant !== 'inline' && (
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
      )}
      <div className="flex-1">
        {title && (
          <h3 className="font-medium text-red-800 mb-1">{title}</h3>
        )}
        <p className={variant === 'inline' ? 'text-red-600' : 'text-red-700'}>
          {message}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 ml-2 text-red-400 hover:text-red-600"
        >
          <span className="sr-only">Dismiss</span>
          <XCircleIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  )

  return (
    <div
      className={`${variantClasses[variant]} ${className}`}
      data-testid={testId}
    >
      {content}
    </div>
  )
}

// Specialized error components for common use cases
export function ErrorBanner({ message, onDismiss, ...props }: Omit<ErrorDisplayProps, 'variant'>) {
  return <ErrorDisplay variant="banner" message={message} onDismiss={onDismiss} {...props} />
}

export function ErrorCard({ message, onDismiss, ...props }: Omit<ErrorDisplayProps, 'variant'>) {
  return <ErrorDisplay variant="card" message={message} onDismiss={onDismiss} {...props} />
}

export function InlineError({ message, ...props }: Omit<ErrorDisplayProps, 'variant' | 'onDismiss'>) {
  return <ErrorDisplay variant="inline" message={message} {...props} />
}
