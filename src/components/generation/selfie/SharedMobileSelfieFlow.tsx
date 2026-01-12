'use client'

import React, { useEffect, useState } from 'react'

interface StatusBadgeContent {
  readyContent: React.ReactNode
  selectingContent: React.ReactNode
}

interface SharedMobileSelfieFlowProps {
  /** Informational banner that fades out on scroll (e.g., selection tips) */
  infoBanner?: React.ReactNode
  /** Main selfie grid content */
  grid: React.ReactNode
  /** Optional navigation controls rendered below the grid */
  navigation?: React.ReactNode
  /** Section rendered near the bottom (e.g., upload controls) */
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
 * and pinned upload controls so the UX matches between contexts.
 */
export default function SharedMobileSelfieFlow({
  infoBanner,
  grid,
  navigation,
  uploadSection,
  statusBadge,
  successBanner,
  selfieTypeOverlay,
  canContinue,
  className = ''
}: SharedMobileSelfieFlowProps) {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const shouldReserveBottomSpace = Boolean(statusBadge || uploadSection)

  return (
    <div className={`md:hidden bg-white ${shouldReserveBottomSpace ? 'pb-48' : ''} ${className}`}>
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

      {navigation && (
        <div className="px-4 pb-6">
          {navigation}
        </div>
      )}

      {statusBadge && (
        <div className="fixed bottom-[90px] left-0 right-0 z-50 flex justify-center pointer-events-none">
          <span
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold shadow-xl backdrop-blur-sm ${
              canContinue
                ? 'bg-green-500 text-white'
                : 'bg-white/95 text-gray-700 border border-gray-200'
            }`}
          >
            {canContinue ? statusBadge.readyContent : statusBadge.selectingContent}
          </span>
        </div>
      )}

      {uploadSection && (
        <div className="px-4 pb-6">
          {uploadSection}
        </div>
      )}
    </div>
  )
}




