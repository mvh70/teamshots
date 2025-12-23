import type { CardComponentProps } from 'onborda/dist/types'
import { useOnborda } from 'onborda'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import type { ExtendedStep } from '@/lib/onborda/config'

export function OnbordaCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { isOnbordaVisible, closeOnborda, currentTour: onbordaCurrentTour } = useOnborda()
  const { completeTour, skipTour } = useOnbordaTours()
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations('app')
  const { context: onboardingContext } = useOnboardingState()
  const extendedStep = step as ExtendedStep | undefined
  const isCompletingRef = useRef(false)

  // Get firstName from session for interpolation
  const firstName = session?.user?.person?.firstName || session?.user?.name?.split(' ')[0] || undefined

  // Interpolate firstName in title if present, otherwise remove placeholder
  const displayTitle = useMemo(() => {
    if (!step?.title) return step?.title
    let title = step.title
    
    // If firstName is available, replace the placeholder (which may have been replaced with empty string by next-intl)
    if (firstName) {
      // Handle case where placeholder still exists
      title = title.replace('{Firstname}', firstName).replace('{firstname}', firstName)
      // Handle case where next-intl replaced it with empty string, leaving ", !"
      title = title.replace(', !', `, ${firstName}!`)
    } else {
      // Remove placeholder - handle both cases: when placeholder exists and when it's already been replaced with empty string
      title = title.replace(', {Firstname}', '').replace(', {firstname}', '')
      // Also handle case where next-intl already replaced it, leaving ", !"
      title = title.replace(', !', '!')
    }
    
    return title
  }, [step?.title, firstName])

  const numberOfSteps = totalSteps ?? 0
  const isFirst = currentStep === 0
  const isLast = numberOfSteps > 0 ? currentStep === numberOfSteps - 1 : false

  // Detect when tour is closed and complete it
  const previousTourRef = useRef<string | null>(null)
  useEffect(() => {
    // Track when tour becomes visible to capture the tour name
    if (isOnbordaVisible && onbordaCurrentTour) {
      previousTourRef.current = onbordaCurrentTour
    }
    
    // When tour becomes invisible, complete it if we haven't already
    if (!isOnbordaVisible && previousTourRef.current && !isCompletingRef.current) {
      const tourToComplete = previousTourRef.current
      
      // Only complete if we haven't already completed this tour (check database)
      const completedTours = onboardingContext.completedTours || []
      const hasCompleted = completedTours.includes(tourToComplete)
      
      if (!hasCompleted) {
        // Mark as completing to prevent duplicate calls
        isCompletingRef.current = true
        
        // Complete the tour
        completeTour(tourToComplete)
          .then(() => {
            // Clear the ref after successful completion
            previousTourRef.current = null
          })
          .catch((error) => {
            console.error('[OnbordaCard] Error completing tour:', error)
            // Reset completing flag on error so we can retry
            isCompletingRef.current = false
            // Try to complete it again after a short delay in case of transient errors
            setTimeout(() => {
              isCompletingRef.current = true
              completeTour(tourToComplete)
                .then(() => {
                  previousTourRef.current = null
                })
                .catch((retryError) => {
                  console.error('[OnbordaCard] Retry also failed:', retryError)
                  isCompletingRef.current = false
                })
            }, 1000)
          })
      } else {
        previousTourRef.current = null
      }
    }
    
    // Reset the ref when tour becomes visible again (new tour starting)
    if (isOnbordaVisible) {
      isCompletingRef.current = false
    }
  }, [isOnbordaVisible, onbordaCurrentTour, completeTour, onboardingContext.completedTours, onboardingContext.personId])

  const handleNext = async () => {
    if (isLast) {
      if (onbordaCurrentTour) {
        // Mark that we're completing to prevent useEffect from running
        isCompletingRef.current = true
        // Mark tour as completed in database (not localStorage)
        completeTour(onbordaCurrentTour)
          .catch((error) => {
            console.error('[OnbordaCard] Error completing tour via handleNext:', error)
          })
      }
      // Close the tour and ensure it stays closed
      closeOnborda()
      // Force close again after a brief delay to ensure it stays closed
      setTimeout(() => {
        if (isOnbordaVisible) {
          closeOnborda()
        }
      }, 100)
      return
    }

    nextStep()
  }

  const handleGoToPhotoStyles = async () => {
    if (onbordaCurrentTour) {
      // Mark that we're completing to prevent useEffect from running
      isCompletingRef.current = true
      // Mark tour as completed in database (not localStorage)
      // Fire and forget - don't await to avoid blocking UI
      completeTour(onbordaCurrentTour).catch(() => {})
    }
    closeOnborda()
    router.push('/app/styles/personal')
  }

  const handleBack = () => {
    if (isFirst) {
      handleSkip()
      return
    }

    prevStep()
  }

  const handleSkip = () => {
    if (onbordaCurrentTour) {
      skipTour(onbordaCurrentTour)
    }
    closeOnborda()
  }

  const handleContinue = async () => {
    if (onbordaCurrentTour) {
      // Mark that we're completing to prevent useEffect from running
      isCompletingRef.current = true
      // Mark tour as completed in database (not localStorage)
      completeTour(onbordaCurrentTour)
        .catch((error) => {
          console.error('[OnbordaCard] Error completing tour via handleContinue:', error)
        })
    }
    closeOnborda()

    // Determine redirect destination based on user segment
    const isOrganizer = onboardingContext.onboardingSegment === 'organizer'
    console.log('OnbordaCard: Completing tour', {
      isOrganizer,
      onboardingSegment: onboardingContext.onboardingSegment,
      isFreePlan: onboardingContext.isFreePlan,
      userId: onboardingContext.userId
    })

    if (isOrganizer) {
      // Team admins should stay on dashboard after onboarding completion
      // Users can navigate to photo styles when ready
      // No redirect needed - stay on current page (dashboard)
      console.log('OnbordaCard: Team admin completed onboarding, staying on dashboard')
    } else {
      // Individuals go to generate
      console.log('OnbordaCard: Individual completed onboarding, redirecting to generate')
      router.push('/app/generate/start')
    }
  }


  const hasCustomActions = extendedStep?.customActions && isLast

  // Color the icons in content to match button colors
  const displayContent = useMemo(() => {
    if (!step?.content) return null
    const content = typeof step.content === 'string' ? step.content : String(step.content)
    // Download (↓): brand-primary (indigo)
    // Regenerate (↻): brand-secondary (green)
    // Delete (🗑️): red-600
    return content
      .replace(/↓/g, '<span style="color: #6366F1;">↓</span>')
      .replace(/↻/g, '<span style="color: #10B981;">↻</span>')
      .replace(/🗑️/g, '<span style="color: #DC2626;">🗑️</span>')
      .replace(/\n/g, '<br />')
  }, [step?.content])

  return (
    <div
      className="w-[360px] sm:w-[420px] mx-4 sm:mx-0 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 p-5 space-y-4 text-gray-900"
      data-onborda-tour={onbordaCurrentTour}
      data-onborda-step={currentStep}
    >
      {/* Step indicators */}
      <div className="flex justify-center gap-2 mb-3">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentStep
                ? 'bg-brand-primary'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span>
          Step {currentStep + 1}
          {numberOfSteps ? ` of ${numberOfSteps}` : ''}
        </span>
        <span className="flex items-center gap-1 text-brand-primary">{arrow}</span>
      </div>

      {displayTitle ? <h3 className="text-lg font-semibold text-gray-900">{displayTitle}</h3> : null}
      {displayContent && (
        <p 
          className="text-sm text-gray-600 leading-relaxed whitespace-pre-line"
          dangerouslySetInnerHTML={{ __html: displayContent }}
        />
      )}

      {hasCustomActions ? (
        <div className="flex items-center gap-3 pt-2">
          {!isFirst && (
            <button
              type="button"
              onClick={handleBack}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          )}
          {onbordaCurrentTour === 'welcome' ? (
            <button
              type="button"
              onClick={handleGoToPhotoStyles}
              className="flex-1 inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-3 min-h-[44px] text-sm font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              {t('onboarding.tours.welcome.goToPhotoStylesButton')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              className="flex-1 inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-3 min-h-[44px] text-sm font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              Continue
            </button>
          )}
        </div>
      ) : (
        <div className={`flex items-center pt-2 ${isFirst ? 'justify-center' : 'justify-between'}`}>
          {!isFirst && (
            <button
              type="button"
              onClick={handleBack}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center rounded-lg bg-brand-primary px-4 py-3 min-h-[44px] text-sm font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}
