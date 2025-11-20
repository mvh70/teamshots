'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ToastType = 'info' | 'success' | 'error'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onDismiss?: () => void
  anchorRef?: React.RefObject<HTMLElement | null> // New prop for relative positioning
}

export function Toast({ message, type = 'info', duration = 6000, onDismiss, anchorRef }: ToastProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const toastRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (anchorRef?.current && toastRef.current) {
      const anchorRect = anchorRef.current.getBoundingClientRect()
      const toastRect = toastRef.current.getBoundingClientRect()
      
      // Position toast at the bottom-center inside the anchor
      const top = anchorRect.bottom - toastRect.height - 16 // 16px from the bottom
      const left = anchorRect.left + (anchorRect.width / 2) - (toastRect.width / 2)

      setPosition({ top, left })
    }
  }, [anchorRef])

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

  const baseClasses = 'flex w-full items-center gap-3 rounded-md shadow-lg px-4 py-3 text-sm'
  const typeClass =
    type === 'error'
      ? 'bg-red-600 text-white'
      : type === 'success'
        ? 'bg-brand-secondary text-white'
        : 'bg-gray-900 text-white'
  const ariaLive = type === 'error' ? 'assertive' : 'polite'

  // Ensure message is a string and log for debugging
  const displayMessage = message || ''
  
  useEffect(() => {
    if (message) {
      console.log('[Toast] Rendering with message:', message, 'length:', message.length, 'type:', typeof message)
    } else {
      console.warn('[Toast] Rendering with empty or undefined message')
    }
  }, [message])

  if (!displayMessage) {
    console.warn('[Toast] Not rendering - message is empty')
    return null
  }
  
  const positionClass = anchorRef ? 'fixed' : 'fixed top-6 left-1/2 -translate-x-1/2'
  const positionStyle = position ? { top: `${position.top}px`, left: `${position.left}px`, transform: 'none' } : {}

  const toastMarkup = (
    <div
      ref={toastRef}
      className={`${positionClass} z-[9999] w-auto max-w-md`}
      style={positionStyle}
    >
      <div
        className={`${baseClasses} ${typeClass}`}
        role="alert"
        aria-live={ariaLive}
        aria-atomic="true"
      >
        <span className="flex-1 break-words font-medium whitespace-normal">
          {displayMessage}
        </span>
      </div>
    </div>
  )

  if (typeof window === 'object') {
    return createPortal(toastMarkup, document.body)
  }

  return null
}


