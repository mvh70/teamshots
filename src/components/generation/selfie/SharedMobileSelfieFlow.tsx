'use client'

import React, { useEffect, useRef, useState } from 'react'
import { MOBILE_STICKY_FOOTER_SURFACE } from '@/components/generation/navigation/mobileFooterStyles'

interface StatusBadgeContent {
  readyContent: React.ReactNode
  selectingContent: React.ReactNode
}

interface SharedMobileSelfieFlowProps {
  /** Informational banner that fades out on scroll (e.g., selection tips) */
  infoBanner?: React.ReactNode
  /** Main selfie grid content */
  grid: React.ReactNode
  /** Optional navigation controls rendered in the sticky footer (progress dots) */
  navigation?: React.ReactNode
  /** Optional labeled navigation buttons rendered above progress dots */
  navButtons?: React.ReactNode
  /** Section rendered in the sticky footer (e.g., upload controls) */
  uploadSection?: React.ReactNode
  /** Floating status pill content */
  statusBadge?: StatusBadgeContent
  /** Optional banner shown above the flow (e.g., upload success) */
  successBanner?: React.ReactNode
  /** Overlay showing selfie type capture progress (front/side/full body) */
  selfieTypeOverlay?: React.ReactNode
  /** Whether the user can continue to the next step */
  canContinue: boolean
  /** Additional wrapper classes */
  className?: string
}

/**
 * Shared mobile layout for selfie selection across logged-in and invited flows.
 * Handles scroll-aware banner fading, consistent spacing, floating status pill,
 * and sticky footer with navigation and upload controls.
 */
export default function SharedMobileSelfieFlow({
  infoBanner,
  grid,
  navigation,
  navButtons,
  uploadSection,
  statusBadge,
  successBanner,
  selfieTypeOverlay,
  canContinue,
  className = ''
}: SharedMobileSelfieFlowProps) {
  const [scrollY, setScrollY] = useState(0)
  const [footerHeight, setFooterHeight] = useState(224)
  const footerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const hasFooter = Boolean(navigation || navButtons || uploadSection)

  useEffect(() => {
    if (!hasFooter || !footerRef.current) return

    const footerElement = footerRef.current
    const updateFooterHeight = () => {
      setFooterHeight(footerElement.offsetHeight || 224)
    }

    updateFooterHeight()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateFooterHeight)
      observer.observe(footerElement)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateFooterHeight)
    return () => window.removeEventListener('resize', updateFooterHeight)
  }, [hasFooter, navigation, navButtons, uploadSection])

  return (
    <div className={`md:hidden bg-white ${className}`}>
      {successBanner && (
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          {successBanner}
        </div>
      )}

      {selfieTypeOverlay && (
        <div className="px-4 py-3 flex justify-center">
          {selfieTypeOverlay}
        </div>
      )}

      {infoBanner && (
        <div
          className="px-4 pt-0 transition-opacity duration-300"
          style={{
            opacity: Math.max(0, 1 - scrollY / 100),
            transform: `translateY(${Math.min(scrollY * 0.5, 20)}px)`
          }}
        >
          {infoBanner}
        </div>
      )}

      <div className="px-4 pt-6 pb-4">
        {grid}
      </div>

      {/* Space for sticky footer */}
      {hasFooter && <div style={{ height: `${footerHeight}px` }} />}

      {/* Status badge - floats above sticky footer */}
      {statusBadge && (
        <div
          className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
          style={{ bottom: `calc(${footerHeight}px + env(safe-area-inset-bottom, 0px) + 0.5rem)` }}
        >
          <span
            data-testid={canContinue ? 'mobile-ready-to-customize-badge' : 'mobile-select-more-selfies-badge'}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold shadow-xl backdrop-blur-sm ${
              canContinue
                ? 'bg-brand-primary text-white'
                : 'bg-white/95 text-gray-700 border border-gray-200'
            }`}
          >
            {canContinue ? statusBadge.readyContent : statusBadge.selectingContent}
          </span>
        </div>
      )}

      {/* Sticky footer with navigation and upload controls */}
      {hasFooter && (
        <div
          ref={footerRef}
          className={`fixed bottom-0 left-0 right-0 z-50 ${MOBILE_STICKY_FOOTER_SURFACE}`}
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* Labeled navigation buttons row */}
          {navButtons && (
            <div className="px-4 pt-4 pb-2">
              {navButtons}
            </div>
          )}
          {/* Progress dots row */}
          {navigation && (
            <div className="px-4 pb-2">
              {navigation}
            </div>
          )}
          {/* Upload buttons */}
          {uploadSection && (
            <div className="px-4">
              {uploadSection}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
