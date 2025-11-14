'use client'

import React from 'react'

interface ProgressBarProps {
  progress: number // 0-100
  className?: string
  showText?: boolean
  text?: string
  'data-testid'?: string
}

export function ProgressBar({
  progress,
  className = '',
  showText = true,
  text,
  'data-testid': testId = 'progress-bar'
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress))

  return (
    <div className={`space-y-1 ${className}`}>
      <div
        className="h-2 bg-gray-200 rounded overflow-hidden"
        data-testid={testId}
      >
        <div
          className="h-2 bg-brand-primary rounded transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
          data-testid="progress-fill"
        />
      </div>
      {showText && (
        <p className="text-xs text-gray-500" data-testid="progress-text">
          {text || `${clampedProgress}%`}
        </p>
      )}
    </div>
  )
}
