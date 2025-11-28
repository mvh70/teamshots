'use client'

import React from 'react'

interface LoadingStateProps {
  className?: string
  'data-testid'?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

export function LoadingState({
  className = '',
  'data-testid': testId = 'loading-state',
  children
}: LoadingStateProps) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 rounded-lg ${className}`}
      data-testid={testId}
      style={{
        backgroundSize: '200% 100%',
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }}
    >
      {children}
    </div>
  )
}

// Common loading state patterns
export function LoadingCard({ className = '', ...props }: LoadingStateProps) {
  return (
    <div className={`rounded-xl overflow-hidden shadow-sm border border-gray-200/50 ${className}`} {...props}>
      <LoadingState className="p-5">
        <div className="space-y-3">
          <LoadingState className="h-4 w-3/4 rounded-md" />
          <LoadingState className="h-4 w-1/2 rounded-md" />
          <LoadingState className="h-4 w-2/3 rounded-md" />
        </div>
      </LoadingState>
    </div>
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
    <div className={`grid ${gridColsClass} gap-5 ${className}`}>
      {items.map((item, index) => (
        <div key={item} className="aspect-square">
          <LoadingCard className="h-full rounded-xl" style={{ animationDelay: `${index * 100}ms` }} {...props} />
        </div>
      ))}
    </div>
  )
}
