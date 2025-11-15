'use client'

import { useEffect } from 'react'
import { useOnborda } from 'onborda'
import { useOnboardingState, useOnbordaTours, getTour } from '@/lib/onborda/hooks'
import { usePathname } from '@/i18n/routing'
import { useTranslations } from 'next-intl'

export function OnboardingLauncher() {
  const { context } = useOnboardingState()
  const { startOnborda, isOnbordaVisible, currentTour: onbordaCurrentTour, closeOnborda } = useOnborda()
  const { pendingTour, clearPendingTour } = useOnbordaTours()
  const pathname = usePathname()
  const t = useTranslations('app')

  useEffect(() => {
    // Check for pending tours that need to be started FIRST
    // This takes priority over any other tour logic
    // Also check sessionStorage for tours set before navigation
    const sessionPendingTour = sessionStorage.getItem('pending-tour')
    const tourToStart = pendingTour || sessionPendingTour
    
    if (tourToStart) {
      // If this is a pending tour from sessionStorage, clear the "seen" flag
      // to ensure it starts even if previously seen
      if (sessionPendingTour === 'invite-team' || sessionPendingTour === 'team-admin-welcome' || 
          sessionPendingTour === 'team-photo-styles-free' || sessionPendingTour === 'team-photo-styles-page' ||
          sessionPendingTour === 'generation-detail') {
        localStorage.removeItem(`onboarding-${sessionPendingTour}-seen`)
      }
      if (sessionPendingTour) {
        sessionStorage.removeItem('pending-tour')
      }
      startOnborda(tourToStart)
      if (pendingTour) {
        clearPendingTour()
      }
      return () => {}
    }

    const welcomeTourName = context.isTeamAdmin ? 'team-admin-welcome' : 'welcome'
    const hasSeenWelcome = localStorage.getItem(`onboarding-${welcomeTourName}-seen`) === 'true'

    // Don't start welcome tour if we're on a page that has its own tour
    // or if we have a pending tour (which will be processed above)
    // Exception: Allow team-admin-welcome tour to start on /app/team page
    const isOnTourPage = pathname === '/app/styles/team' || 
                         pathname === '/app/generations/team' || 
                         pathname === '/app/generations/personal' ||
                         (pathname === '/app/team' && welcomeTourName !== 'team-admin-welcome')

    // Check if the welcome tour trigger condition is met
    const welcomeTour = getTour(welcomeTourName, t, context)
    const triggerConditionMet = !welcomeTour?.triggerCondition || welcomeTour.triggerCondition(context)

    if (!isOnTourPage && !hasSeenWelcome && context.userId && !isOnbordaVisible && triggerConditionMet && context._loaded) {
      // Wait for DOM to be ready and elements to exist
      const timer = setTimeout(() => {
        // Verify the first step's selector exists before starting
        if (welcomeTour && welcomeTour.steps.length > 0) {
          const firstStepSelector = welcomeTour.steps[0].selector
          const elementExists = document.querySelector(firstStepSelector)
          if (elementExists) {
            startOnborda(welcomeTourName)
          } else {
            // Retry after 1 second if element doesn't exist yet
            setTimeout(() => {
              const retryElement = document.querySelector(firstStepSelector)
              if (retryElement) {
                startOnborda(welcomeTourName)
              }
            }, 1000)
          }
        }
      }, 1000) // Increased delay to ensure DOM is ready
      return () => clearTimeout(timer)
    }

    if (!context.userId) {
      return undefined
    }

    // Team setup tour removed - users should fill in team details first,
    // then get redirected to photo styles where the tour starts

    // Team photo style setup tour is now triggered by redirect after team creation

    // Page-specific tours on team styles page
    if (pathname === '/app/styles/team' && context.isTeamAdmin && context.teamId && !isOnbordaVisible && context._loaded) {
      const tourName = context.isFreePlan ? 'team-photo-styles-free' : 'team-photo-styles-page'
      const hasSeenTour = localStorage.getItem(`onboarding-${tourName}-seen`) === 'true'
      
      // If tour hasn't been seen and we're not already showing this tour, start it
      if (!hasSeenTour && onbordaCurrentTour !== tourName) {
        // Verify the first step's selector exists
        const photoStyleTour = getTour(tourName, t, context)
        
        setTimeout(() => {
          if (photoStyleTour && photoStyleTour.steps.length > 0) {
            const selector = photoStyleTour.steps[0].selector
            const element = document.querySelector(selector)
            if (element) {
              startOnborda(tourName)
            } else {
              // Retry after 1 second if element doesn't exist yet
              setTimeout(() => {
                const retryElement = document.querySelector(selector)
                if (retryElement) {
                  startOnborda(tourName)
                }
              }, 1000)
            }
          }
        }, 1000)
        return () => {}
      }
    }

    // Page-specific tours on personal styles page
    if (pathname === '/app/styles/personal' && context.isRegularUser && !isOnbordaVisible && context._loaded) {
      const tourName = context.isFreePlan ? 'personal-photo-styles-free' : 'personal-photo-styles-page'
      const hasSeenTour = localStorage.getItem(`onboarding-${tourName}-seen`) === 'true'
      
      // If tour hasn't been seen and we're not already showing this tour, start it
      if (!hasSeenTour && onbordaCurrentTour !== tourName) {
        // Verify the first step's selector exists
        const photoStyleTour = getTour(tourName, t, context)
        
        setTimeout(() => {
          if (photoStyleTour && photoStyleTour.steps.length > 0) {
            const selector = photoStyleTour.steps[0].selector
            const element = document.querySelector(selector)
            if (element) {
              startOnborda(tourName)
            } else {
              // Retry after 1 second if element doesn't exist yet
              setTimeout(() => {
                const retryElement = document.querySelector(selector)
                if (retryElement) {
                  startOnborda(tourName)
                }
              }, 1000)
            }
          }
        }, 1000)
        return () => {}
      }
    }

    // Page-specific tours on photo style create page (both team and personal)
    if ((pathname === '/app/styles/team/create' || pathname === '/app/styles/personal/create') && 
        ((context.isTeamAdmin && context.teamId) || context.isRegularUser) && 
        !context.isFreePlan && !isOnbordaVisible && context._loaded) {
      const tourName = 'photo-style-creation'
      const hasSeenTour = localStorage.getItem(`onboarding-${tourName}-seen`) === 'true'
      
      if (!hasSeenTour && onbordaCurrentTour !== tourName) {
        const photoStyleCreationTour = getTour(tourName, t, context)
        
        setTimeout(() => {
          if (photoStyleCreationTour && photoStyleCreationTour.steps.length > 0) {
            const selector = photoStyleCreationTour.steps[0].selector
            const element = document.querySelector(selector)
            if (element) {
              startOnborda(tourName)
            } else {
              setTimeout(() => {
                const retryElement = document.querySelector(selector)
                if (retryElement) {
                  startOnborda(tourName)
                }
              }, 1000)
            }
          }
        }, 1000)
        return () => {}
      }
    }

    // Page-specific tours on team page (invite tour)
    // Start invite tour automatically when:
    // 1. User has a team (teamId exists)
    // 2. Tour hasn't been seen yet
    // 3. User is on the team page
    // 4. No other tour is currently visible
    if (pathname === '/app/team' && context.isTeamAdmin && context.teamId && !isOnbordaVisible && context._loaded) {
      const tourName = 'invite-team'
      const hasSeenTour = localStorage.getItem(`onboarding-${tourName}-seen`) === 'true'
      const sessionPendingTour = sessionStorage.getItem('pending-tour')
      
      // Verify the first step's selector exists
      const inviteTour = getTour(tourName, t, context)
      const firstStepSelector = inviteTour?.steps[0]?.selector
      const elementExists = firstStepSelector ? document.querySelector(firstStepSelector) : null
      
      // Start invite tour if:
      // - Tour hasn't been seen yet (automatic start on page load)
      // - OR there's a pending invite tour (from style tour redirect)
      // - Not already showing this tour
      // - First step selector exists (or we'll retry)
      const shouldStartInviteTour = (!hasSeenTour || pendingTour === 'invite-team' || sessionPendingTour === 'invite-team') && onbordaCurrentTour !== tourName
      
      if (shouldStartInviteTour) {
        // Clear seen flag and sessionStorage if they exist (in case it was set incorrectly)
        if (hasSeenTour) {
          localStorage.removeItem(`onboarding-${tourName}-seen`)
        }
        if (sessionPendingTour === 'invite-team') {
          sessionStorage.removeItem('pending-tour')
        }
        
        // Wait for DOM to be ready and verify selector exists
        const timer = setTimeout(() => {
          if (inviteTour && inviteTour.steps.length > 0) {
            const selector = inviteTour.steps[0].selector
            const element = document.querySelector(selector)
            if (element) {
              startOnborda(tourName)
            } else {
              // Retry after 1 second if element doesn't exist yet
              setTimeout(() => {
                const retryElement = document.querySelector(selector)
                if (retryElement) {
                  startOnborda(tourName)
                }
              }, 1000)
            }
          }
        }, 1000)
        return () => clearTimeout(timer)
      }
    }

    // Test generation tours are now handled by the pendingTour system

    // Generation detail tour - trigger on generations pages after first generation
    // Also check if there's a pending tour or if generation cards are visible on the page
    if ((pathname === '/app/generations/personal' || pathname === '/app/generations/team') && 
        (context.hasGeneratedPhotos || sessionStorage.getItem('pending-tour') === 'generation-detail') && 
        (context.isRegularUser || context.isTeamAdmin) && 
        !isOnbordaVisible && 
        context._loaded) {
      const tourName = 'generation-detail'
      const hasSeenTour = localStorage.getItem(`onboarding-${tourName}-seen`) === 'true'
      const hasPendingTour = sessionStorage.getItem('pending-tour') === 'generation-detail'
      
      // Check if there are generation cards visible on the page (fallback if context is stale)
      const hasGenerationCards = document.querySelector('[data-onborda="generated-photo"]') !== null
      
      // If tour hasn't been seen and we're not already showing this tour, start it
      // Also start if there's a pending tour or if generation cards are visible
      if ((!hasSeenTour || hasPendingTour) && onbordaCurrentTour !== tourName && (context.hasGeneratedPhotos || hasGenerationCards || hasPendingTour)) {
        // Clear pending tour if it exists
        if (hasPendingTour) {
          sessionStorage.removeItem('pending-tour')
          localStorage.removeItem(`onboarding-${tourName}-seen`)
        }
        
        const generationDetailTour = getTour(tourName, t, context)
        
        setTimeout(() => {
          if (generationDetailTour && generationDetailTour.steps.length > 0) {
            const selector = generationDetailTour.steps[0].selector
            const element = document.querySelector(selector)
            if (element) {
              startOnborda(tourName)
            } else {
              // Retry after 1 second if element doesn't exist yet
              setTimeout(() => {
                const retryElement = document.querySelector(selector)
                if (retryElement) {
                  startOnborda(tourName)
                }
              }, 1000)
            }
          }
        }, 1000)
        return () => {}
      }
    }

    return undefined
  }, [context, startOnborda, pathname, pendingTour, clearPendingTour, isOnbordaVisible, onbordaCurrentTour, closeOnborda, t])

  return null
}
