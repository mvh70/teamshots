'use client'

import React from 'react'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useScrollThreshold } from '@/hooks/useScrollThreshold'
import FlowHeader, { FlowHeaderProps } from './FlowHeader'

interface ScrollAwareHeaderProps {
  /** Optional dashboard/header content shown before the flow header */
  top?: React.ReactNode
  /** Props forwarded to FlowHeader (step indicator etc.) */
  flowHeader: FlowHeaderProps
  /** Scroll distance before we swap headers */
  threshold?: number
  /** Additional classes for the sticky wrapper */
  className?: string
  /** Show the top header on desktop as well (default: mobile only) */
  showTopOnDesktop?: boolean
  /** Force header to be fixed on mobile (overrides sticky behaviour) */
  fixedOnMobile?: boolean
}

/**
 * Handles sticky dual-header behaviour: a top header that fades out once the
 * user scrolls past `threshold`, and a FlowHeader that fades in (with step
 * indicator support). Used for selfie-selection pages to mirror the
 * customization flow experience.
 */
export default function ScrollAwareHeader({
  top,
  flowHeader,
  threshold = 60,
  className = '',
  showTopOnDesktop = false,
  fixedOnMobile = false
}: ScrollAwareHeaderProps) {
  const isMobile = useMobileViewport()
  const showTopHeader = Boolean(top) && (isMobile || showTopOnDesktop)
  const isFixed = fixedOnMobile && isMobile
  
  // Use shared hook for scroll state
  // Only track scroll if we need to toggle headers (showTopHeader is true)
  const isScrolled = useScrollThreshold(threshold, showTopHeader)

  const topClasses = showTopHeader
    ? `transition-all duration-300 ${isScrolled ? 'opacity-0 pointer-events-none absolute inset-x-0 -translate-y-full' : 'opacity-100 relative translate-y-0'}`
    : ''

  const flowClasses = showTopHeader
    ? `transition-opacity duration-300 ${isScrolled ? 'opacity-100 relative' : 'opacity-0 pointer-events-none absolute inset-x-0'}`
    : 'relative'

  return (
    <div
      className={`${isFixed ? 'fixed top-0 left-0 right-0' : 'sticky top-0'} z-50 ${className}`.trim()}
      style={{ top: 'calc(env(safe-area-inset-top, 0px))' }}
    >
      <div className="relative">
        {showTopHeader && (
          <div className={topClasses}>
            {top}
          </div>
        )}
        <div className={flowClasses}>
          <FlowHeader {...flowHeader} sticky={false} />
        </div>
      </div>
    </div>
  )
}
