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
      console.log('OnboardingLauncher: Starting pending tour', tourToStart, { 
        fromState: !!pendingTour, 
        fromSession: !!sessionPendingTour,
        pathname,
        isOnbordaVisible,
        contextLoaded: context._loaded
      })
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
    } else {
      // Log when no pending tour is found (for debugging)
      if (pathname === '/app/generations/team' || pathname === '/app/generations/personal') {
        console.log('OnboardingLauncher: No pending tour found', {
          pathname,
          pendingTour,
          sessionPendingTour: sessionStorage.getItem('pending-tour'),
          hasGeneratedPhotos: context.hasGeneratedPhotos
        })
      }
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

    // Debug logging for team admin welcome tour
    if (welcomeTourName === 'team-admin-welcome') {
      console.log('OnboardingLauncher: Checking team-admin-welcome tour', {
        pathname,
        welcomeTourName,
        hasSeenWelcome,
        userId: context.userId,
        isOnbordaVisible,
        triggerConditionMet,
        contextLoaded: context._loaded,
        isOnTourPage,
        isTeamAdmin: context.isTeamAdmin,
        teamId: context.teamId,
        hasGeneratedPhotos: context.hasGeneratedPhotos,
        welcomeTourExists: !!welcomeTour,
        welcomeTourSteps: welcomeTour?.steps?.length,
      })
    }

    if (!isOnTourPage && !hasSeenWelcome && context.userId && !isOnbordaVisible && triggerConditionMet && context._loaded) {
      // Wait for DOM to be ready and elements to exist
      const timer = setTimeout(() => {
        // Verify the first step's selector exists before starting
        if (welcomeTour && welcomeTour.steps.length > 0) {
          const firstStepSelector = welcomeTour.steps[0].selector
          const elementExists = document.querySelector(firstStepSelector)
          if (elementExists) {
            console.log('OnboardingLauncher: Starting welcome tour', welcomeTourName, 'with selector', firstStepSelector)
            startOnborda(welcomeTourName)
          } else {
            console.warn('OnboardingLauncher: First step selector not found:', firstStepSelector, 'Retrying in 1s...')
            // Retry after 1 second if element doesn't exist yet
            setTimeout(() => {
              const retryElement = document.querySelector(firstStepSelector)
              if (retryElement) {
                console.log('OnboardingLauncher: Retry successful, starting tour')
                startOnborda(welcomeTourName)
              } else {
                console.error('OnboardingLauncher: Selector still not found after retry:', firstStepSelector)
              }
            }, 1000)
          }
        } else {
          console.warn('OnboardingLauncher: Welcome tour has no steps')
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
      
      console.log('OnboardingLauncher: Checking photo style tour', {
        pathname,
        tourName,
        hasSeenTour,
        isTeamAdmin: context.isTeamAdmin,
        teamId: context.teamId,
        hasGeneratedPhotos: context.hasGeneratedPhotos,
        isFreePlan: context.isFreePlan,
        isOnbordaVisible,
        contextLoaded: context._loaded,
        onbordaCurrentTour,
      })
      
      // If tour hasn't been seen and we're not already showing this tour, start it
      if (!hasSeenTour && onbordaCurrentTour !== tourName) {
        console.log('OnboardingLauncher: Starting photo style tour', tourName)
        // Verify the first step's selector exists
        const photoStyleTour = getTour(tourName, t, context)
        
        setTimeout(() => {
          if (photoStyleTour && photoStyleTour.steps.length > 0) {
            const selector = photoStyleTour.steps[0].selector
            const element = document.querySelector(selector)
            if (element) {
              console.log('OnboardingLauncher: Starting photo style tour with selector', selector)
              startOnborda(tourName)
            } else {
              console.warn('OnboardingLauncher: First step selector not found:', selector, 'Retrying in 1s...')
              // Retry after 1 second if element doesn't exist yet
              setTimeout(() => {
                const retryElement = document.querySelector(selector)
                if (retryElement) {
                  console.log('OnboardingLauncher: Retry successful, starting photo style tour')
                  startOnborda(tourName)
                } else {
                  console.error('OnboardingLauncher: Selector still not found after retry:', selector)
                }
              }, 1000)
            }
          } else {
            console.warn('OnboardingLauncher: Photo style tour has no steps')
          }
        }, 1000)
        return () => {}
      } else {
        console.log('OnboardingLauncher: Not starting photo style tour', {
          hasSeenTour,
          onbordaCurrentTour,
          tourName,
        })
      }
    } else if (pathname === '/app/styles/team') {
      // Log why the tour isn't starting when on the styles page
      console.log('OnboardingLauncher: Photo style tour conditions not met', {
        pathname,
        isTeamAdmin: context.isTeamAdmin,
        teamId: context.teamId,
        hasGeneratedPhotos: context.hasGeneratedPhotos,
        isOnbordaVisible,
        contextLoaded: context._loaded,
      })
    }

    // Page-specific tours on personal styles page
    if (pathname === '/app/styles/personal' && context.isRegularUser && !isOnbordaVisible && context._loaded) {
      const tourName = context.isFreePlan ? 'personal-photo-styles-free' : 'personal-photo-styles-page'
      const hasSeenTour = localStorage.getItem(`onboarding-${tourName}-seen`) === 'true'
      
      console.log('OnboardingLauncher: Checking personal photo style tour', {
        pathname,
        tourName,
        hasSeenTour,
        isRegularUser: context.isRegularUser,
        hasGeneratedPhotos: context.hasGeneratedPhotos,
        isFreePlan: context.isFreePlan,
        isOnbordaVisible,
        contextLoaded: context._loaded,
        onbordaCurrentTour,
      })
      
      // If tour hasn't been seen and we're not already showing this tour, start it
      if (!hasSeenTour && onbordaCurrentTour !== tourName) {
        console.log('OnboardingLauncher: Starting personal photo style tour', tourName)
        // Verify the first step's selector exists
        const photoStyleTour = getTour(tourName, t, context)
        
        setTimeout(() => {
          if (photoStyleTour && photoStyleTour.steps.length > 0) {
            const selector = photoStyleTour.steps[0].selector
            const element = document.querySelector(selector)
            if (element) {
              console.log('OnboardingLauncher: Starting personal photo style tour with selector', selector)
              startOnborda(tourName)
            } else {
              console.warn('OnboardingLauncher: First step selector not found:', selector, 'Retrying in 1s...')
              // Retry after 1 second if element doesn't exist yet
              setTimeout(() => {
                const retryElement = document.querySelector(selector)
                if (retryElement) {
                  console.log('OnboardingLauncher: Retry successful, starting personal photo style tour')
                  startOnborda(tourName)
                } else {
                  console.error('OnboardingLauncher: Selector still not found after retry:', selector)
                }
              }, 1000)
            }
          } else {
            console.warn('OnboardingLauncher: Personal photo style tour has no steps')
          }
        }, 1000)
        return () => {}
      } else {
        console.log('OnboardingLauncher: Not starting personal photo style tour', {
          hasSeenTour,
          onbordaCurrentTour,
          tourName,
        })
      }
    } else if (pathname === '/app/styles/personal') {
      // Log why the tour isn't starting when on the personal styles page
      console.log('OnboardingLauncher: Personal photo style tour conditions not met', {
        pathname,
        isRegularUser: context.isRegularUser,
        hasGeneratedPhotos: context.hasGeneratedPhotos,
        isOnbordaVisible,
        contextLoaded: context._loaded,
      })
    }

    // Page-specific tours on photo style create page (both team and personal)
    if ((pathname === '/app/styles/team/create' || pathname === '/app/styles/personal/create') && 
        ((context.isTeamAdmin && context.teamId) || context.isRegularUser) && 
        !context.isFreePlan && !isOnbordaVisible && context._loaded) {
      const tourName = 'photo-style-creation'
      const hasSeenTour = localStorage.getItem(`onboarding-${tourName}-seen`) === 'true'
      
      console.log('OnboardingLauncher: Checking photo style creation tour', {
        pathname,
        tourName,
        hasSeenTour,
        isTeamAdmin: context.isTeamAdmin,
        teamId: context.teamId,
        isFreePlan: context.isFreePlan,
        isOnbordaVisible,
        contextLoaded: context._loaded,
        onbordaCurrentTour,
      })
      
      if (!hasSeenTour && onbordaCurrentTour !== tourName) {
        console.log('OnboardingLauncher: Starting photo style creation tour', tourName)
        const photoStyleCreationTour = getTour(tourName, t, context)
        
        setTimeout(() => {
          if (photoStyleCreationTour && photoStyleCreationTour.steps.length > 0) {
            const selector = photoStyleCreationTour.steps[0].selector
            const element = document.querySelector(selector)
            if (element) {
              console.log('OnboardingLauncher: Starting photo style creation tour with selector', selector)
              startOnborda(tourName)
            } else {
              console.warn('OnboardingLauncher: First step selector not found:', selector, 'Retrying in 1s...')
              setTimeout(() => {
                const retryElement = document.querySelector(selector)
                if (retryElement) {
                  console.log('OnboardingLauncher: Retry successful, starting photo style creation tour')
                  startOnborda(tourName)
                } else {
                  console.error('OnboardingLauncher: Selector still not found after retry:', selector)
                }
              }, 1000)
            }
          } else {
            console.warn('OnboardingLauncher: Photo style creation tour has no steps')
          }
        }, 1000)
        return () => {}
      } else {
        console.log('OnboardingLauncher: Not starting photo style creation tour', {
          hasSeenTour,
          onbordaCurrentTour,
          tourName,
        })
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
      
      console.log('OnboardingLauncher: Checking invite tour', {
        pathname,
        tourName,
        hasSeenTour,
        sessionPendingTour,
        isTeamAdmin: context.isTeamAdmin,
        teamId: context.teamId,
        isOnbordaVisible,
        onbordaCurrentTour,
        pendingTour,
        contextLoaded: context._loaded,
        firstStepSelector,
        elementExists: !!elementExists,
        triggerConditionMet: !inviteTour?.triggerCondition || inviteTour.triggerCondition(context),
      })
      
      // Start invite tour if:
      // - Tour hasn't been seen yet (automatic start on page load)
      // - OR there's a pending invite tour (from style tour redirect)
      // - Not already showing this tour
      // - First step selector exists (or we'll retry)
      const shouldStartInviteTour = (!hasSeenTour || pendingTour === 'invite-team' || sessionPendingTour === 'invite-team') && onbordaCurrentTour !== tourName
      
      if (shouldStartInviteTour) {
        console.log('OnboardingLauncher: Starting invite tour', { hasSeenTour, pendingTour, sessionPendingTour, elementExists: !!elementExists })
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
              console.log('OnboardingLauncher: Starting invite tour with selector', selector)
              startOnborda(tourName)
            } else {
              console.warn('OnboardingLauncher: First step selector not found:', selector, 'Retrying in 1s...')
              // Retry after 1 second if element doesn't exist yet
              setTimeout(() => {
                const retryElement = document.querySelector(selector)
                if (retryElement) {
                  console.log('OnboardingLauncher: Retry successful, starting invite tour')
                  startOnborda(tourName)
                } else {
                  console.error('OnboardingLauncher: Selector still not found after retry:', selector)
                }
              }, 1000)
            }
          } else {
            console.warn('OnboardingLauncher: Invite tour has no steps')
          }
        }, 1000)
        return () => clearTimeout(timer)
      } else {
        console.log('OnboardingLauncher: Not starting invite tour', {
          shouldStartInviteTour,
          hasSeenTour,
          pendingTour,
          sessionPendingTour,
          onbordaCurrentTour,
        })
      }
    } else if (pathname === '/app/team') {
      // Log why the tour isn't starting when on the team page
      console.log('OnboardingLauncher: Invite tour conditions not met', {
        pathname,
        isTeamAdmin: context.isTeamAdmin,
        teamId: context.teamId,
        isOnbordaVisible,
        contextLoaded: context._loaded,
      })
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
      
      console.log('OnboardingLauncher: Checking generation detail tour', {
        pathname,
        tourName,
        hasSeenTour,
        hasPendingTour,
        hasGeneratedPhotos: context.hasGeneratedPhotos,
        hasGenerationCards,
        isRegularUser: context.isRegularUser,
        isTeamAdmin: context.isTeamAdmin,
        isOnbordaVisible,
        contextLoaded: context._loaded,
        onbordaCurrentTour,
      })
      
      // If tour hasn't been seen and we're not already showing this tour, start it
      // Also start if there's a pending tour or if generation cards are visible
      if ((!hasSeenTour || hasPendingTour) && onbordaCurrentTour !== tourName && (context.hasGeneratedPhotos || hasGenerationCards || hasPendingTour)) {
        console.log('OnboardingLauncher: Starting generation detail tour', tourName, { hasPendingTour, hasGenerationCards })
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
              console.log('OnboardingLauncher: Starting generation detail tour with selector', selector)
              startOnborda(tourName)
            } else {
              console.warn('OnboardingLauncher: First step selector not found:', selector, 'Retrying in 1s...')
              // Retry after 1 second if element doesn't exist yet
              setTimeout(() => {
                const retryElement = document.querySelector(selector)
                if (retryElement) {
                  console.log('OnboardingLauncher: Retry successful, starting generation detail tour')
                  startOnborda(tourName)
                } else {
                  console.error('OnboardingLauncher: Selector still not found after retry:', selector)
                }
              }, 1000)
            }
          } else {
            console.warn('OnboardingLauncher: Generation detail tour has no steps')
          }
        }, 1000)
        return () => {}
      } else {
        console.log('OnboardingLauncher: Not starting generation detail tour', {
          hasSeenTour,
          hasPendingTour,
          hasGenerationCards,
          onbordaCurrentTour,
          tourName,
        })
      }
    } else if (pathname === '/app/generations/team' || pathname === '/app/generations/personal') {
      // Log why the tour isn't starting when on the generations page
      console.log('OnboardingLauncher: Generation detail tour conditions not met', {
        pathname,
        hasGeneratedPhotos: context.hasGeneratedPhotos,
        hasPendingTour: sessionStorage.getItem('pending-tour') === 'generation-detail',
        isRegularUser: context.isRegularUser,
        isTeamAdmin: context.isTeamAdmin,
        isOnbordaVisible,
        contextLoaded: context._loaded,
      })
    }

    return undefined
  }, [context, startOnborda, pathname, pendingTour, clearPendingTour, isOnbordaVisible, onbordaCurrentTour, closeOnborda, t])

  return null
}
