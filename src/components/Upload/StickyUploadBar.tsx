'use client'

import { ReactNode } from 'react'

interface StickyUploadBarProps {
  children: ReactNode
  className?: string
}

/**
 * A sticky bottom bar for upload buttons on mobile.
 * Renders fixed at the bottom of the viewport with safe area insets.
 * 
 * Used by both SelfieUploadFlow and standalone upload pages.
 */
export default function StickyUploadBar({ children, className = '' }: StickyUploadBarProps) {
  return (
    <div 
      data-testid="sticky-upload-bar" 
      className={`fixed inset-x-0 bottom-0 z-50 bg-white pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-gray-100/50 backdrop-blur-xl bg-white/95 ${className}`}
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="[&>div]:!p-0">
        {children}
      </div>
    </div>
  )
}
