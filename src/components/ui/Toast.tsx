'use client'

import { useEffect } from 'react'

type ToastType = 'info' | 'success' | 'error'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onDismiss?: () => void
}

export function Toast({ message, type = 'info', duration = 6000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!onDismiss || !duration || duration <= 0) {
      return
    }

    const timer = window.setTimeout(() => {
      onDismiss()
    }, duration)

    return () => {
      window.clearTimeout(timer)
    }
  }, [duration, onDismiss])

  const baseClasses = 'flex items-start gap-3 rounded-md shadow-lg px-4 py-3 text-sm text-white'
  const typeClass =
    type === 'error'
      ? 'bg-red-600'
      : type === 'success'
        ? 'bg-brand-secondary'
        : 'bg-gray-900'
  const ariaLive = type === 'error' ? 'assertive' : 'polite'

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div
        className={`${baseClasses} ${typeClass}`}
        role="alert"
        aria-live={ariaLive}
        aria-atomic="true"
      >
        <span className="flex-1">{message}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-2 text-white/80 hover:text-white focus:outline-none"
            aria-label="Close notification"
          >
            <span className="sr-only">Close notification</span>
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <line x1="5" y1="5" x2="15" y2="15" strokeLinecap="round" />
              <line x1="5" y1="15" x2="15" y2="5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}


