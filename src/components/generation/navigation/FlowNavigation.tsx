'use client'

import React from 'react'
import { ChevronLeftIcon, ChevronRightIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'

type NavigationVariant = 'dots' | 'chevrons' | 'both' | 'dots-only'

interface FlowNavigationProps {
  /** Display variant */
  variant: NavigationVariant
  /** Current step index (0-indexed) */
  current: number
  /** Total number of steps */
  total: number
  /** Called when previous is clicked */
  onPrev: () => void
  /** Called when next is clicked */
  onNext: () => void
  /** Called when a specific dot is clicked (optional) */
  onDotClick?: (index: number) => void
  /** Whether previous navigation is allowed (default: current > 0) */
  canGoPrev?: boolean
  /** Whether next navigation is allowed (default: current < total - 1) */
  canGoNext?: boolean
  /** Optional hint text below navigation */
  hintText?: string
  /** Additional CSS classes for container */
  className?: string
  /** Size of navigation elements */
  size?: 'sm' | 'md'
  /** Step coloring configuration (optional) */
  stepColors?: {
    /** Indices of locked/preset steps (shown as grey) */
    lockedSteps?: number[]
    /** Indices of visited/done editable steps (shown as green) */
    visitedEditableSteps?: number[]
  }
}

/**
 * Unified navigation controls for the generation flow.
 * Combines dot indicators and chevron buttons in a consistent pattern.
 * 
 * Variants:
 * - 'dots': Only dot indicators (clickable)
 * - 'chevrons': Only prev/next buttons
 * - 'both': Chevrons with dots between them (recommended for mobile)
 * - 'dots-only': Dots without click handlers (view-only indicator)
 */
export default function FlowNavigation({
  variant,
  current,
  total,
  onPrev,
  onNext,
  onDotClick,
  canGoPrev,
  canGoNext,
  hintText,
  className = '',
  size = 'md',
  stepColors
}: FlowNavigationProps) {
  const t = useTranslations('generation.flow')
  
  const isPrevDisabled = canGoPrev !== undefined ? !canGoPrev : current === 0
  const isNextDisabled = canGoNext !== undefined ? !canGoNext : current >= total - 1

  const buttonSize = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const dotSizeSmall = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
  const dotSizeLarge = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'
  const dotGap = size === 'sm' ? 'gap-1.5' : 'gap-2'

  const showChevrons = variant === 'chevrons' || variant === 'both'
  const showDots = variant === 'dots' || variant === 'both' || variant === 'dots-only'
  const dotsClickable = variant !== 'dots-only' && onDotClick !== undefined
  const showPrevButton = showChevrons && !isPrevDisabled
  const showNextButton = showChevrons && !isNextDisabled

  // Pre-compute sets for efficient lookup
  const lockedSet = new Set(stepColors?.lockedSteps ?? [])
  const visitedSet = new Set(stepColors?.visitedEditableSteps ?? [])

  // Get dot color and size based on step type and state
  const getDotStyles = (idx: number) => {
    const isCurrent = idx === current
    const isLocked = lockedSet.has(idx)
    const isVisited = visitedSet.has(idx)

    // Size: current step is larger
    const sizeClass = isCurrent ? dotSizeLarge : dotSizeSmall

    // Color logic (only applies if stepColors is provided)
    if (stepColors) {
      if (isLocked) {
        // Locked/preset steps are grey
        return { color: 'bg-gray-300', size: sizeClass }
      }
      if (isVisited) {
        // Visited/done editable steps are green
        return { color: 'bg-green-500', size: sizeClass }
      }
      // Not visited editable steps are blue
      return { color: 'bg-brand-primary', size: sizeClass }
    }

    // Default behavior (no stepColors): current is blue, others are grey
    return { 
      color: isCurrent ? 'bg-brand-primary' : 'bg-gray-300', 
      size: dotSizeSmall 
    }
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="flex items-center gap-4">
        {/* Previous button - only show when enabled */}
        {showPrevButton && (
          <button
            type="button"
            onClick={onPrev}
            className={`
              flex items-center justify-center rounded-full 
              border border-gray-300 bg-white text-gray-700 shadow-sm 
              hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors
              ${buttonSize}
            `}
            aria-label={t('back', { default: 'Previous' })}
          >
            <ChevronLeftIcon className={iconSize} />
          </button>
        )}

        {/* Dot indicators */}
        {showDots && (
          <div className={`flex items-center ${dotGap}`}>
            {Array.from({ length: total }).map((_, idx) => {
              const { color, size: dotSize } = getDotStyles(idx)
              const isLocked = lockedSet.has(idx)
              
              // For locked steps, show a lock icon instead of a dot (darker when current)
              if (isLocked) {
                const isCurrent = idx === current
                const lockSize = size === 'sm' 
                  ? (isCurrent ? 'h-3.5 w-3.5' : 'h-3 w-3')
                  : (isCurrent ? 'h-4 w-4' : 'h-3.5 w-3.5')
                const lockColor = isCurrent ? 'text-gray-600' : 'text-gray-400'
                return (
                  <span
                    key={`nav-lock-${idx}`}
                    className="flex items-center justify-center"
                    aria-label={t('stepIndicator', { 
                      current: idx + 1, 
                      total,
                      default: `Preset step ${idx + 1}` 
                    })}
                  >
                    <LockClosedIcon className={`${lockSize} ${lockColor} transition-all duration-300`} />
                  </span>
                )
              }
              
              return (
                <button
                  key={`nav-dot-${idx}`}
                  type="button"
                  aria-label={t('stepIndicator', { 
                    current: idx + 1, 
                    total,
                    default: `Go to step ${idx + 1}` 
                  })}
                  onClick={() => dotsClickable && onDotClick?.(idx)}
                  disabled={!dotsClickable}
                  className={`
                    rounded-full transition-all duration-300
                    ${dotsClickable ? 'cursor-pointer' : 'cursor-default'}
                    ${color}
                    ${dotSize}
                  `}
                />
              )
            })}
          </div>
        )}

        {/* Next button */}
        {showNextButton && (
          <button
            type="button"
            onClick={onNext}
            className={`
              flex items-center justify-center rounded-full 
              bg-brand-primary text-white shadow-sm 
              hover:brightness-110 transition
              ${buttonSize}
            `}
            aria-label={t('continue', { default: 'Next' })}
          >
            <ChevronRightIcon className={iconSize} />
          </button>
        )}
      </div>

      {/* Hint text */}
      {hintText && (
        <p className="text-xs text-center text-gray-500">
          {hintText}
        </p>
      )}
    </div>
  )
}

