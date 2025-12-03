'use client'

import React from 'react'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import FlowFooter, { SwipeHint } from './FlowFooter'
import ScrollAwareHeader from './ScrollAwareHeader'
import type { FlowHeaderProps } from './FlowHeader'

type FooterConfig =
  | { variant: 'actions' | 'navigation' | 'custom'; content: React.ReactNode }
  | { variant: 'swipe-hint'; text: string; direction?: 'left' | 'right' }

type BottomPadding = 'none' | 'sm' | 'md' | 'lg' | 'auto'
type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full'
type Background = 'white' | 'gray'

const maxWidthClasses: Record<MaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full'
}

const bottomPaddingClasses: Record<Exclude<BottomPadding, 'auto'>, string> = {
  none: '',
  sm: 'pb-20',
  md: 'pb-28',
  lg: 'pb-40'
}

interface StickyFlowPageProps {
  /** Optional dashboard/app header shown above the flow header */
  topHeader?: React.ReactNode
  /** Flow header configuration (title, step indicator, etc.) */
  flowHeader: FlowHeaderProps
  /** Footer configuration passed through to FlowFooter */
  footer?: FooterConfig
  /** Additional bottom padding below the content area */
  bottomPadding?: BottomPadding
  /** Content max-width */
  maxWidth?: MaxWidth
  /** Background color */
  background?: Background
  /** Custom classnames */
  className?: string
  contentClassName?: string
  /** Whether to render the top header on desktop viewports */
  showTopOnDesktop?: boolean
  /** Height of spacer inserted on mobile below the fixed header (default: 120px for dual headers) */
  mobileHeaderSpacerHeight?: number
  /** Fix header to viewport on mobile (overrides sticky behavior) */
  fixedHeaderOnMobile?: boolean
  children: React.ReactNode
}

export default function StickyFlowPage({
  topHeader,
  flowHeader,
  footer,
  bottomPadding = 'auto',
  maxWidth = '7xl',
  background = 'gray',
  className = '',
  contentClassName = '',
  showTopOnDesktop = false,
  mobileHeaderSpacerHeight = 120,
  fixedHeaderOnMobile = false,
  children
}: StickyFlowPageProps) {
  const isMobile = useMobileViewport()

  const effectiveBottomPadding = (() => {
    if (bottomPadding !== 'auto') return bottomPadding
    if (footer && isMobile) return 'lg'
    return 'none'
  })()

  const footerContent = footer && ('content' in footer ? footer.content : <SwipeHint text={footer.text} direction={footer.direction} />)

  return (
    <div className={`min-h-screen ${background === 'gray' ? 'bg-gray-50' : 'bg-white'} ${className}`.trim()}>
      <ScrollAwareHeader
        top={topHeader}
        flowHeader={flowHeader}
        showTopOnDesktop={showTopOnDesktop}
        fixedOnMobile={fixedHeaderOnMobile}
      />
      {isMobile && (
        <div style={{ height: `${mobileHeaderSpacerHeight}px` }} />
      )}

      <div className={`${maxWidthClasses[maxWidth]} mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${effectiveBottomPadding === 'none' ? '' : bottomPaddingClasses[effectiveBottomPadding]} ${contentClassName}`.trim()}>
        {children}
      </div>

      {footer && (
        <FlowFooter variant={footer.variant}>
          {footerContent}
        </FlowFooter>
      )}
    </div>
  )
}
