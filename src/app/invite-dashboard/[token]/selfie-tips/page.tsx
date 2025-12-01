'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import SelfieTipsContent from '@/components/generation/SelfieTipsContent'
import { FlowHeader } from '@/components/generation/layout'
import { FlowNavigation, SwipeableContainer } from '@/components/generation/navigation'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { buildSelfieStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'

/**
 * Selfie tips intro page for invited users.
 * 
 * Flow: /invite-dashboard/[token] → /invite-dashboard/[token]/selfie-tips → /invite-dashboard/[token]/selfies
 * 
 * This page is shown before selfie selection to help users take better selfies.
 * On mobile: Full-screen with swipe left to continue, sticky header transitions from dashboard header to content header when scrolled
 * On desktop: Card layout with continue button
 */
export default function InviteSelfieTipsPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const t = useTranslations('inviteDashboard.mobile.selfieTips')
  const tContent = useTranslations('customization.photoStyle.mobile.selfieTips')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const { markSeenSelfieTips, hydrated, customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META } = useGenerationFlowState()
  
  // Track scroll state for header transition (mobile only)
  const [isScrolled, setIsScrolled] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Build step indicator for selfie tips (before selfie selection, so step 0)
  const selfieStepIndicator = buildSelfieStepIndicator(customizationStepsMeta, {
    selfieComplete: false,
    isDesktop: !isMobile
  })
  const stepperTotalDots = selfieStepIndicator.totalWithLocked ?? selfieStepIndicator.total
  // Info pages are not part of the steps, so use -1 to not highlight any step as current
  const navCurrentIndex = -1
  const navigationStepColors = selfieStepIndicator.lockedSteps || selfieStepIndicator.visitedEditableSteps
    ? {
        lockedSteps: selfieStepIndicator.lockedSteps,
        visitedEditableSteps: selfieStepIndicator.visitedEditableSteps
      }
    : undefined

  // Invited users always see the selfie tips (unlike logged-in users who see them once per session)

  const handleContinue = () => {
    markSeenSelfieTips()
    router.push(`/invite-dashboard/${token}/selfies`)
  }

  const handleBack = () => {
    router.push(`/invite-dashboard/${token}`)
  }

  // Monitor scroll position to toggle header (mobile only)
  useEffect(() => {
    if (!isMobile) return
    
    const handleScroll = () => {
      // Transition at 60px scroll (about when content title leaves viewport)
      setIsScrolled(window.scrollY > 60)
    }
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isMobile])

  // Don't render while hydrating
  if (!hydrated) {
    return null
  }

  return (
    <SwipeableContainer
      onSwipeLeft={isSwipeEnabled ? handleContinue : undefined}
      onSwipeRight={isSwipeEnabled ? handleBack : undefined}
      enabled={isSwipeEnabled}
    >
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Sticky header container - transitions between dashboard header and content header */}
        <div className="sticky top-0 z-50">
          {/* Dashboard header - visible when at top */}
          <div 
            className={`transition-opacity duration-200 ${
              isMobile && isScrolled ? 'opacity-0 pointer-events-none absolute inset-x-0' : 'opacity-100'
            }`}
          >
            <InviteDashboardHeader
              title=""
              token={token}
              showBackToDashboard={false}
            />
          </div>
          
          {/* Content header - visible when scrolled (mobile only) */}
          {isMobile && (
            <div 
              className={`transition-opacity duration-200 ${
                isScrolled ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-x-0'
              }`}
            >
              <FlowHeader
                kicker={tContent('kicker', { default: 'Get the best results' })}
                title={tContent('title', { default: 'Selfie tips for amazing photos' })}
                showBack={false}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto w-full">
          <div className="py-8 md:py-12">
            <SelfieTipsContent 
              variant="swipe"
            />
          </div>
          
          {/* Step navigation */}
          <div className="pb-8 md:pb-12">
            <FlowNavigation
              variant="both"
              size="sm"
              current={navCurrentIndex}
              total={Math.max(1, stepperTotalDots)}
              onPrev={handleBack}
              onNext={handleContinue}
              canGoPrev={false}
              stepColors={navigationStepColors}
            />
          </div>
        </div>
      </div>
    </SwipeableContainer>
  )
}

