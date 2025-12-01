'use client'

import React from 'react'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import FlowHeader from './FlowHeader'
import FlowFooter, { SwipeHint } from './FlowFooter'

interface FlowLayoutProps {
  children: React.ReactNode
  
  /** Header configuration (omit to hide header) */
  header?: {
    title: string
    kicker?: string
    subtitle?: string
    step?: { current: number; total: number }
    showBack?: boolean
    onBack?: () => void
    rightContent?: React.ReactNode
  }
  
  /** Footer configuration (omit to hide footer) */
  footer?: {
    variant: 'actions' | 'swipe-hint' | 'navigation' | 'custom'
    content: React.ReactNode
  } | {
    variant: 'swipe-hint'
    text: string
    direction?: 'left' | 'right'
  }
  
  /** Additional padding at bottom for fixed footer (default: auto-calculated) */
  bottomPadding?: 'none' | 'sm' | 'md' | 'lg' | 'auto'
  
  /** Container max-width constraint */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full'
  
  /** Background color */
  background?: 'white' | 'gray'
  
  /** Additional CSS classes for the main container */
  className?: string
  
  /** Additional CSS classes for the content area */
  contentClassName?: string
}

const maxWidthClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full'
}

const bottomPaddingClasses: Record<string, string> = {
  none: '',
  sm: 'pb-20',
  md: 'pb-28',
  lg: 'pb-40',
  auto: '' // Will be set dynamically
}

/**
 * Main layout component for the generation flow.
 * 
 * Provides:
 * - Consistent header with optional step indicator
 * - Sticky mobile footer for actions
 * - Responsive viewport handling
 * - Safe area insets
 * - Consistent spacing and max-width constraints
 * 
 * Usage:
 * ```tsx
 * <FlowLayout
 *   header={{ title: 'Select Selfies', step: { current: 1, total: 3 } }}
 *   footer={{ variant: 'actions', content: <ContinueButton /> }}
 * >
 *   <SelfieGrid />
 * </FlowLayout>
 * ```
 */
export default function FlowLayout({
  children,
  header,
  footer,
  bottomPadding = 'auto',
  maxWidth = '7xl',
  background = 'gray',
  className = '',
  contentClassName = ''
}: FlowLayoutProps) {
  const isMobile = useMobileViewport()
  
  // Auto-calculate bottom padding based on footer presence on mobile
  const effectiveBottomPadding = bottomPadding === 'auto'
    ? (footer && isMobile ? 'lg' : 'none')
    : bottomPadding

  // Determine footer content
  const footerContent = footer && (
    'content' in footer 
      ? footer.content 
      : <SwipeHint text={footer.text} direction={footer.direction} />
  )

  return (
    <div className={`min-h-screen ${background === 'gray' ? 'bg-gray-50' : 'bg-white'} ${className}`}>
      {/* Header - use fixed on mobile (works with AppShell), sticky on desktop */}
      {header && (
        <div 
          className={`${isMobile ? 'fixed' : 'sticky'} top-0 left-0 right-0 z-50`}
          style={isMobile ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 } : { position: 'sticky', top: 0, zIndex: 50 }}
        >
          <FlowHeader
            title={header.title}
            kicker={header.kicker}
            subtitle={header.subtitle}
            step={header.step}
            showBack={header.showBack}
            onBack={header.onBack}
            rightContent={header.rightContent}
            sticky={false}
          />
        </div>
      )}
      
      {/* Spacer for fixed header on mobile - accounts for header height */}
      {header && isMobile && <div className="h-16" />}

      {/* Main content area */}
      <div className={`${maxWidthClasses[maxWidth]} mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${bottomPaddingClasses[effectiveBottomPadding]} ${contentClassName}`}>
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <FlowFooter variant={footer.variant}>
          {footerContent}
        </FlowFooter>
      )}
    </div>
  )
}

// Re-export sub-components for direct usage
export { FlowHeader, FlowFooter, SwipeHint }
export { default as ScrollAwareHeader } from './ScrollAwareHeader'
export { default as StickyFlowPage } from './StickyFlowPage'
export { default as StepIndicator } from './StepIndicator'

