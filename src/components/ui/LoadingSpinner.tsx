'use client'

import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  'data-testid'?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8'
}

export function LoadingSpinner({
  size = 'md',
  className = '',
  'data-testid': testId = 'loading-spinner'
}: LoadingSpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-brand-primary ${sizeClasses[size]} ${className}`}
      data-testid={testId}
    />
  )
}

// Specialized loading spinners for common use cases
export function SmallLoadingSpinner(props: Omit<LoadingSpinnerProps, 'size'>) {
  return <LoadingSpinner size="sm" {...props} />
}

export function LargeLoadingSpinner(props: Omit<LoadingSpinnerProps, 'size'>) {
  return <LoadingSpinner size="lg" {...props} />
}
