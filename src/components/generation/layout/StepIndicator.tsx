'use client'

import React from 'react'
import { LockClosedIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'

interface StepIndicatorProps {
  /** Current step number (1-indexed) */
  current: number
  /** Total number of steps */
  total: number
  /** Optional custom label format */
  label?: string
  /** Additional CSS classes */
  className?: string
  /** Optional array of step indices (0-indexed) that are locked/pre-set (shown as grey dots) */
  lockedSteps?: number[]
  /** Total number of all steps including locked ones (for showing all dots) */
  totalWithLocked?: number
  /** Current position in all steps (0-indexed) - used to highlight current step */
  currentAllStepsIndex?: number
  /** Array of step indices (0-indexed) that are visited editable steps (shown as green - done) */
  visitedEditableSteps?: number[]
}

/**
 * Displays "Step X of Y" indicator.
 * Used in the generation flow to show progress through customization steps.
 * 
 * When `lockedSteps` and `totalWithLocked` are provided, shows grey dots for locked steps
 * and only counts editable steps in the "X of Y" label.
 */
export default function StepIndicator({
  current,
  total,
  label,
  className = '',
  lockedSteps = [],
  totalWithLocked,
  currentAllStepsIndex,
  visitedEditableSteps = []
}: StepIndicatorProps) {
  const t = useTranslations('generation.flow')

  const displayLabel = label ?? t('stepIndicator', {
    current,
    total,
    default: `Step ${current} of ${total}`
  })

  // If we have locked steps info, show all dots (editable + locked)
  // Otherwise, just show the editable steps
  const dotsToShow = totalWithLocked ?? total
  const lockedSet = React.useMemo(() => new Set(lockedSteps), [lockedSteps])

  const visitedSet = new Set(visitedEditableSteps)

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        {displayLabel}
      </span>
      <div className="flex items-center gap-1">
        {Array.from({ length: dotsToShow }).map((_, idx) => {
          const isLocked = lockedSet.has(idx)
          const isCurrentStep = currentAllStepsIndex !== undefined && idx === currentAllStepsIndex
          const isVisited = visitedSet.has(idx)
          
          // For locked/pre-set steps - show lock icon (darker when current)
          if (isLocked) {
            return (
              <span
                key={idx}
                className="flex items-center justify-center"
                aria-label={`Preset step ${idx + 1}`}
              >
                <LockClosedIcon className={`transition-all duration-300 ${
                  isCurrentStep 
                    ? 'h-2.5 w-2.5 text-gray-600' 
                    : 'h-2 w-2 text-gray-400'
                }`} />
              </span>
            )
          }
          
          // For editable steps
          // Logic:
          // - Not visited: blue (larger when current)
          // - Visited: green (larger when current)
          const size = isCurrentStep ? 'w-2 h-2' : 'w-1.5 h-1.5'
          const color = isVisited ? 'bg-brand-secondary' : 'bg-brand-primary'
          
          return (
            <div
              key={idx}
              className={`rounded-full ${color} ${size} transition-all duration-300`}
            />
          )
        })}
      </div>
    </div>
  )
}

