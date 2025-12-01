'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import CustomizationIntroContent from '@/components/generation/CustomizationIntroContent'
import { FlowHeader } from '@/components/generation/layout'
import { FlowNavigation, SwipeableContainer } from '@/components/generation/navigation'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { buildSelfieStepIndicator, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'

/**
 * Customization intro page for invited users.
 * 
 * Flow: /invite-dashboard/[token]/selfies → /invite-dashboard/[token]/customization-intro → /invite-dashboard/[token]
 * 
 * This page explains the customization options before users see them.
 * On mobile: Full-screen with swipe left to continue, sticky header transitions from dashboard header to content header when scrolled
 * On desktop: Card layout with continue button
 */
export default function InviteCustomizationIntroPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const t = useTranslations('customization.photoStyle.mobile')
  const tIntro = useTranslations('customization.photoStyle.mobile.intro')
  const isMobile = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  const { markSeenCustomizationIntro, setPendingGeneration, markInFlow, hydrated, customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META } = useGenerationFlowState()
  
  // Track scroll state for header transition (mobile only)
  const [isScrolled, setIsScrolled] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Build step indicator for customization intro (after selfie selection, so selfie is complete)
  const selfieStepIndicator = buildSelfieStepIndicator(customizationStepsMeta, {
    selfieComplete: true,
    isDesktop: !isMobile
  })
  const stepperTotalDots = selfieStepIndicator.totalWithLocked ?? selfieStepIndicator.total
  // Info pages are not part of the steps, so use -1 to not highlight any step as current
  // But show selfie step as visited (green) since it's complete
  const navCurrentIndex = -1
  const navigationStepColors = selfieStepIndicator.lockedSteps || selfieStepIndicator.visitedEditableSteps
    ? {
        lockedSteps: selfieStepIndicator.lockedSteps,
        visitedEditableSteps: selfieStepIndicator.visitedEditableSteps
      }
    : undefined

  // Invited users always see the customization intro (unlike logged-in users who see it once per session)

  const handleContinue = () => {
    // Mark customization intro as seen first
    markSeenCustomizationIntro()
    // Clear pendingGeneration flag since we've completed selfie selection and are moving to customization
    setPendingGeneration(false)
    // Mark as in flow (sets fromGeneration and openStartFlow) so dashboard knows we're continuing
    // Don't pass { pending: true } since we've already cleared pendingGeneration
    markInFlow()
    // Navigate back to the main invite dashboard
    // The dashboard will derive the step from hasSeenCustomizationIntro flag and openStartFlow
    router.push(`/invite-dashboard/${token}`)
  }

  const handleBack = () => {
    router.push(`/invite-dashboard/${token}/selfies`)
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
              showBackToDashboard
              onBackClick={handleBack}
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
                kicker={tIntro('kicker', { default: 'Before you dive in' })}
                title={tIntro('title', { default: 'A quick pit stop before the glow-up' })}
                showBack
                onBack={handleBack}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto w-full">
          <div className="py-8 md:py-12">
            <CustomizationIntroContent 
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
              canGoPrev={true}
              stepColors={navigationStepColors}
            />
          </div>
        </div>
      </div>
    </SwipeableContainer>
  )
}

