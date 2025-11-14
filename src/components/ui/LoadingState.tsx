'use client'

import React from 'react'

interface LoadingStateProps {
  className?: string
  'data-testid'?: string
  children?: React.ReactNode
}

export function LoadingState({
  className = '',
  'data-testid': testId = 'loading-state',
  children
}: LoadingStateProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      data-testid={testId}
    >
      {children}
    </div>
  )
}

// Common loading state patterns
export function LoadingCard({ className = '', ...props }: LoadingStateProps) {
  return (
    <LoadingState className={`p-4 ${className}`} {...props}>
      <div className="space-y-3">
        <LoadingState className="h-4 w-3/4" />
        <LoadingState className="h-4 w-1/2" />
        <LoadingState className="h-4 w-2/3" />
      </div>
    </LoadingState>
  )
}

export function LoadingGrid({
  cols = 3,
  rows = 2,
  className = '',
  ...props
}: LoadingStateProps & { cols?: number; rows?: number }) {
  const items = Array.from({ length: cols * rows }, (_, i) => i)

  // Tailwind requires full class names, not dynamic ones
  const gridColsClass = cols === 2 ? 'grid-cols-2' :
                        cols === 3 ? 'grid-cols-3' :
                        cols === 4 ? 'grid-cols-4' :
                        cols === 5 ? 'grid-cols-5' :
                        'grid-cols-3'

  return (
    <div className={`grid ${gridColsClass} gap-4 ${className}`}>
      {items.map((item) => (
        <LoadingCard key={item} className="h-32" {...props} />
      ))}
    </div>
  )
}
