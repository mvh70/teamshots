'use client'

import React from 'react'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useScrollThreshold } from '@/hooks/useScrollThreshold'
import FlowHeader, { FlowHeaderProps } from './FlowHeader'

interface ScrollAwareHeaderProps {
  /** Optional dashboard/header content shown above the flow header */
  top?: React.ReactNode
  /** Props forwarded to FlowHeader (step indicator etc.) */
  flowHeader: FlowHeaderProps
  /** Scroll distance before top header collapses */
  threshold?: number
  /** Additional classes for the sticky wrapper */
  className?: string
  /** Show the top header on desktop as well (default: mobile only) */
  showTopOnDesktop?: boolean
  /** Force header to be fixed on mobile (overrides sticky behaviour) */
  fixedOnMobile?: boolean
}

/**
 * Handles sticky dual-header behaviour:
 * - When top is provided: Both headers visible initially, top collapses on scroll, flow remains sticky
 * - When top is NOT provided: Flow header scrolls with content (not sticky) to avoid overlaying page headers
 * 
 * Used for generation flow pages to show app header (hamburger + back) above
 * the page-specific flow header (title + step indicator).
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
  // Only track scroll if we have a top header to collapse
  const isScrolled = useScrollThreshold(threshold, showTopHeader)

  // Top header: visible initially, collapses on scroll
  const topClasses = showTopHeader
    ? `transition-all duration-300 overflow-hidden ${isScrolled ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`
    : ''

  // When no top header is provided, don't make the header sticky/fixed
  // This prevents overlaying page-level headers (like InviteDashboardHeader)
  const positionClasses = showTopHeader
    ? (isFixed ? 'fixed top-0 left-0 right-0' : 'sticky top-0')
    : 'relative'

  return (
    <div
      className={`${positionClasses} z-50 ${className}`.trim()}
      style={showTopHeader ? { top: 'calc(env(safe-area-inset-top, 0px))' } : undefined}
    >
      {/* Top header (dashboard/app header) - collapses on scroll */}
      {showTopHeader && (
        <div className={topClasses}>
          {top}
        </div>
      )}
      {/* Flow header (page title + step indicator) - always visible */}
      <FlowHeader {...flowHeader} sticky={false} />
    </div>
  )
}
