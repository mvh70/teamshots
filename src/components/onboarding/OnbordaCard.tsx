import type { CardComponentProps } from 'onborda/dist/types'
import { useOnborda } from 'onborda'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { useEffect, useMemo } from 'react'
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
  const { completeTour, skipTour, startTour } = useOnbordaTours()
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations('app')
  const extendedStep = step as ExtendedStep | undefined

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
  useEffect(() => {
    if (!isOnbordaVisible && onbordaCurrentTour) {
      // Only complete if we haven't already completed this tour
      const hasCompleted = localStorage.getItem(`onboarding-${onbordaCurrentTour}-seen`) === 'true'
      if (!hasCompleted) {
        // Fire and forget - don't await to avoid blocking UI
        completeTour(onbordaCurrentTour).catch(console.error)
      }
    }
  }, [isOnbordaVisible, onbordaCurrentTour, completeTour])

  const handleNext = async () => {
    if (isLast) {
      if (onbordaCurrentTour) {
        // Fire and forget - don't await to avoid blocking UI
        completeTour(onbordaCurrentTour).catch(console.error)
      }
      closeOnborda()
      return
    }

    nextStep()
  }

  const handleGoToPhotoStyles = async () => {
    if (onbordaCurrentTour) {
      // Fire and forget - don't await to avoid blocking UI
      completeTour(onbordaCurrentTour).catch(console.error)
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

  const handleTest = async () => {
    if (onbordaCurrentTour) {
      // Fire and forget - don't await to avoid blocking UI
      completeTour(onbordaCurrentTour).catch(console.error)
    }
    closeOnborda()
    router.push('/app/generate/start')
  }

  const handleInvite = async () => {
    console.log('OnbordaCard: handleInvite called', { onbordaCurrentTour })
    if (onbordaCurrentTour) {
      // Fire and forget - don't await to avoid blocking UI
      completeTour(onbordaCurrentTour).catch(console.error)
    }
    closeOnborda()
    // Set pending tour for invite team tour using both state and sessionStorage
    // sessionStorage ensures it persists across navigation
    // Also clear the "seen" flag so the tour can start even if previously seen
    console.log('OnbordaCard: Setting pending tour to invite-team')
    localStorage.removeItem('onboarding-invite-team-seen')
    sessionStorage.setItem('pending-tour', 'invite-team')
    startTour('invite-team')
    // Navigate immediately - sessionStorage will be checked on the new page
    router.push('/app/team')
  }

  const hasCustomActions = extendedStep?.customActions && isLast

  // Debug logging for invite tour step 3
  useEffect(() => {
    if (onbordaCurrentTour === 'invite-team' && currentStep === 2) {
      console.log('OnbordaCard: Step 3 content check', {
        title: step?.title,
        content: step?.content,
        contentType: typeof step?.content,
        contentLength: typeof step?.content === 'string' ? step.content.length : 'N/A',
        fullStep: step,
      })
    }
  }, [onbordaCurrentTour, currentStep, step])

  return (
    <div className="w-[360px] sm:w-[420px] rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 p-5 space-y-4 text-gray-900">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span>
          Step {currentStep + 1}
          {numberOfSteps ? ` of ${numberOfSteps}` : ''}
        </span>
        <span className="flex items-center gap-1 text-brand-primary">{arrow}</span>
      </div>

      {displayTitle ? <h3 className="text-lg font-semibold text-gray-900">{displayTitle}</h3> : null}
      {step?.content && (
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
          {typeof step.content === 'string' ? step.content : String(step.content)}
        </p>
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
              className="flex-1 inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              {t('onboarding.tours.welcome.goToPhotoStylesButton')}
            </button>
          ) : (
            <div className="flex-1 flex gap-3">
              <button
                type="button"
                onClick={handleTest}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              >
                Test
              </button>
              <button
                type="button"
                onClick={handleInvite}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-brand-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-secondary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
              >
                Invite
              </button>
            </div>
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
            className="inline-flex items-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}
