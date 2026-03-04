'use client'

import { FlowHeader } from '@/components/generation/layout'
import InviteDashboardHeader from './InviteDashboardHeader'

interface InviteFlowStickyHeaderProps {
  token: string
  isMobile: boolean
  isScrolled: boolean
  onDashboardBack: () => void
  creditsRemaining: number
  photosAffordable: number
  flowHeader?: {
    kicker?: string
    title: string
    onBack: () => void
  }
}

export default function InviteFlowStickyHeader({
  token,
  isMobile,
  isScrolled,
  onDashboardBack,
  creditsRemaining,
  photosAffordable,
  flowHeader,
}: InviteFlowStickyHeaderProps) {
  return (
    <div className="sticky top-0 z-50" style={{ minHeight: '56px' }}>
      <div
        className={`transition-opacity duration-200 ${
          isMobile && isScrolled ? 'opacity-0 pointer-events-none absolute inset-x-0' : 'opacity-100'
        }`}
      >
        <InviteDashboardHeader
          token={token}
          showBackToDashboard
          onBackClick={onDashboardBack}
          hideTitle
          creditsRemaining={creditsRemaining}
          photosAffordable={photosAffordable}
        />
      </div>

      {isMobile && flowHeader ? (
        <div
          className={`transition-[opacity,max-height] duration-200 overflow-hidden ${
            isScrolled ? 'opacity-100 max-h-32' : 'opacity-0 max-h-0 pointer-events-none'
          }`}
        >
          <FlowHeader
            kicker={flowHeader.kicker}
            title={flowHeader.title}
            showBack
            onBack={flowHeader.onBack}
          />
        </div>
      ) : null}
    </div>
  )
}
