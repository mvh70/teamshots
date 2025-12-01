'use client'

import React, { useCallback, useRef } from 'react'

interface SwipeableContainerProps {
  /** Content to render inside the swipeable area */
  children: React.ReactNode
  /** Called when user swipes left (typically means "next") */
  onSwipeLeft?: () => void
  /** Called when user swipes right (typically means "previous") */
  onSwipeRight?: () => void
  /** Minimum swipe distance in pixels to trigger action (default: 40) */
  threshold?: number
  /** Enable/disable swipe detection (default: true) */
  enabled?: boolean
  /** Additional CSS classes */
  className?: string
  /** Touch action CSS property (default: 'pan-y' to allow vertical scroll) */
  touchAction?: 'pan-y' | 'pan-x' | 'none' | 'auto'
}

/**
 * A wrapper component that detects horizontal swipe gestures.
 * 
 * Usage:
 * ```tsx
 * <SwipeableContainer
 *   onSwipeLeft={() => goToNext()}
 *   onSwipeRight={() => goToPrevious()}
 * >
 *   <YourContent />
 * </SwipeableContainer>
 * ```
 * 
 * Notes:
 * - By default, allows vertical scrolling (touchAction: 'pan-y')
 * - Swipe threshold prevents accidental triggers
 * - Can be disabled conditionally via `enabled` prop
 */
export default function SwipeableContainer({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 40,
  enabled = true,
  className = '',
  touchAction = 'pan-y'
}: SwipeableContainerProps) {
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)

  const resetSwipe = useCallback(() => {
    touchStartXRef.current = null
    touchStartYRef.current = null
  }, [])

  const startTracking = useCallback((x?: number | null, y?: number | null) => {
    if (!enabled || typeof x !== 'number') {
      resetSwipe()
      return
    }
    touchStartXRef.current = x
    touchStartYRef.current = typeof y === 'number' ? y : null
  }, [enabled, resetSwipe])

  const finishTracking = useCallback((x?: number | null, y?: number | null) => {
    if (!enabled || touchStartXRef.current === null || typeof x !== 'number') {
      resetSwipe()
      return
    }

    const deltaX = x - touchStartXRef.current
    const deltaY = touchStartYRef.current !== null && typeof y === 'number'
      ? y - touchStartYRef.current
      : 0

    resetSwipe()

    if (Math.abs(deltaX) < Math.abs(deltaY)) {
      return
    }

    if (Math.abs(deltaX) < threshold) {
      return
    }

    if (deltaX < 0) {
      onSwipeLeft?.()
    } else {
      onSwipeRight?.()
    }
  }, [enabled, threshold, onSwipeLeft, onSwipeRight, resetSwipe])

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!enabled) return
    const touch = event.touches[0]
    startTracking(touch?.clientX ?? null, touch?.clientY ?? null)
  }, [enabled, startTracking])

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!enabled) return
    const touch = event.changedTouches[0]
    finishTracking(touch?.clientX ?? null, touch?.clientY ?? null)
  }, [enabled, finishTracking])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    startTracking(event.clientX, event.clientY)
  }, [enabled, startTracking])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    finishTracking(event.clientX, event.clientY)
  }, [enabled, finishTracking])

  const handlePointerCancel = useCallback(() => {
    resetSwipe()
  }, [resetSwipe])

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{ touchAction }}
    >
      {children}
    </div>
  )
}

