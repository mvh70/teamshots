'use client'

import React from 'react'

type FooterVariant = 'actions' | 'swipe-hint' | 'navigation' | 'custom'

interface FlowFooterProps {
  /** Footer variant determines the layout style */
  variant: FooterVariant
  /** Content to render inside the footer */
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
  /** Whether footer is visible (useful for conditional rendering) */
  visible?: boolean
}

/**
 * Sticky mobile footer for the generation flow.
 * Provides consistent positioning, shadow, and safe-area handling.
 * 
 * Variants:
 * - 'actions': Primary action buttons (Generate, Continue)
 * - 'swipe-hint': Swipe instruction text with animated arrows
 * - 'navigation': Prev/Next chevrons with dots
 * - 'custom': Any custom content
 * 
 * On desktop (md+): Hidden by default, use `className="md:block"` to show
 */
export default function FlowFooter({
  variant,
  children,
  className = '',
  visible = true
}: FlowFooterProps) {
  if (!visible) return null

  // Base styles for all variants
  const baseStyles = `
    md:hidden
    fixed bottom-0 left-0 right-0 z-50
    bg-white
    shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]
  `

  // Variant-specific padding
  const variantStyles: Record<FooterVariant, string> = {
    actions: 'pt-4 pb-4 px-4',
    'swipe-hint': 'pt-3 pb-3 px-4',
    navigation: 'pt-4 pb-4 px-4',
    custom: 'pt-4 pb-4 px-4'
  }

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        transform: 'translateZ(0)' // GPU acceleration for smooth scroll
      }}
    >
      {children}
    </div>
  )
}

/**
 * Swipe hint content for FlowFooter.
 * Displays animated arrows with customizable text.
 */
interface SwipeHintProps {
  text: string
  direction?: 'left' | 'right'
  className?: string
}

export function SwipeHint({ 
  text, 
  direction = 'left',
  className = '' 
}: SwipeHintProps) {
  const isLeft = direction === 'left'
  
  return (
    <div className={`flex items-center justify-center gap-3 py-2 px-4 bg-brand-primary/10 rounded-xl ${className}`}>
      {!isLeft && (
        <AnimatedArrows direction="left" />
      )}
      <span className="text-sm font-medium text-brand-primary">
        {text}
      </span>
      {isLeft && (
        <AnimatedArrows direction="right" />
      )}
    </div>
  )
}

function AnimatedArrows({ direction }: { direction: 'left' | 'right' }) {
  const isRight = direction === 'right'
  const rotation = isRight ? '' : 'rotate-180'
  
  return (
    <div 
      className={`flex items-center ${rotation}`}
      style={{ animation: 'slideRight 1.2s ease-in-out infinite' }}
    >
      <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
      <svg className="w-5 h-5 -ml-3 text-brand-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}

