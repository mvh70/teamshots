'use client'

import React from 'react'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import StepIndicator from './StepIndicator'

export interface FlowHeaderProps {
  /** Main title displayed in the header */
  title: string
  /** Optional kicker text above the title (small uppercase branded text) */
  kicker?: string
  /** Optional subtitle/description below the title */
  subtitle?: string
  /** Step indicator configuration (omit to hide) */
  step?: {
    current: number
    total: number
    lockedSteps?: number[]
    totalWithLocked?: number
    currentAllStepsIndex?: number // 0-indexed position in all steps (for highlighting current locked step)
    visitedEditableSteps?: number[] // 0-indexed positions in all steps of visited editable steps (for green dots)
  }
  /** Show back button */
  showBack?: boolean
  /** Back button click handler */
  onBack?: () => void
  /** Back button label for accessibility */
  backLabel?: string
  /** Whether to make header sticky on scroll (mobile default: true) */
  sticky?: boolean
  /** Additional CSS classes for the container */
  className?: string
  /** Additional content to render on the right side */
  rightContent?: React.ReactNode
  /** Force full-width styling even when non-sticky (used to match customization headers) */
  fullBleed?: boolean
}

/**
 * Flow header component with optional step indicator and back button.
 * 
 * On mobile: Sticky on scroll with blur backdrop
 * On desktop: Standard header in document flow
 * 
 * Note: Info pages (selfie tips, customization intro) should NOT show the step indicator.
 */
export default function FlowHeader({
  title,
  kicker,
  subtitle,
  step,
  showBack = false,
  onBack,
  backLabel = 'Back',
  sticky = true,
  className = '',
  rightContent
}: FlowHeaderProps) {
  // If there's no meaningful content, don't render the header at all
  // This prevents rendering an empty header bar on desktop when content is shown elsewhere
  const hasContent = title || kicker || subtitle || step || showBack || rightContent
  if (!hasContent) {
    return null
  }

  const positionClasses = sticky ? 'md:static sticky top-0 z-40' : ''

  return (
    <div
      className={`
        ${positionClasses}
        bg-white/95 backdrop-blur-md border-b border-gray-200
        px-4 sm:px-6 py-3.5 shadow-sm
        transition-shadow duration-300
        ${className}
      `}
      style={{
        ...(sticky ? {
          top: 'calc(env(safe-area-inset-top, 0px))',
          willChange: 'transform'
        } : {}),
        width: '100%',
        maxWidth: '100vw'
      }}
      role="banner"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left side: Back button + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {showBack && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex-shrink-0 -ml-1 p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-all duration-200"
              aria-label={backLabel}
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            {kicker && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-1 animate-in fade-in slide-in-from-top-1 duration-300">
                {kicker}
              </p>
            )}
            <h1 className={`font-bold text-gray-900 truncate transition-all duration-300 ${kicker ? 'text-base leading-tight' : 'text-lg'}`}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-gray-600 mt-1 transition-opacity duration-300 font-medium break-words">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right side: Step indicator or custom content */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {step && (
            <StepIndicator 
              current={step.current} 
              total={step.total}
              lockedSteps={step.lockedSteps}
              totalWithLocked={step.totalWithLocked}
              currentAllStepsIndex={step.currentAllStepsIndex}
              visitedEditableSteps={step.visitedEditableSteps}
            />
          )}
          {rightContent}
        </div>
      </div>
    </div>
  )
}

