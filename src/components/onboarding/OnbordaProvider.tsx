'use client'

import { ReactNode, useRef, useEffect, useState } from 'react'
import { OnbordaProvider as OnbordaProviderLib, Onborda } from 'onborda'
import { createTranslatedTours, OnboardingContext } from '@/lib/onborda/config'
import { OnbordaCard } from '@/components/onboarding/OnbordaCard'
import { useTranslations } from 'next-intl'
import { useOnboardingState } from '@/lib/onborda/hooks'

interface OnbordaProviderProps {
  children: ReactNode
}

// Helper function to generate tours with translations and firstName interpolation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateTours(t: (key: string, values?: Record<string, any>) => string, context?: OnboardingContext) {
  const translatedTours = createTranslatedTours(t, context)
  return Object.values(translatedTours).map(tour => ({
    tour: tour.name,
    steps: tour.steps.map((step, stepIndex) => {
      // Interpolate firstName in title if present, otherwise remove placeholder
      let title = step.title
      if (title) {
        const firstName = context?.firstName
        if (firstName) {
          title = title.replace('{Firstname}', firstName)
          title = title.replace('{firstname}', firstName)
        } else {
          // Remove placeholder if firstName is not available
          title = title.replace(', {Firstname}', '')
          title = title.replace(', {firstname}', '')
        }
      }

      // Handle conditional content based on accountMode for personal photo styles tours
      let content = step.content
      if (tour.name === 'personal-photo-styles-free' || tour.name === 'personal-photo-styles-page') {
        const accountMode = context?.accountMode || 'individual'
        if (stepIndex === 0 && tour.name === 'personal-photo-styles-free') {
          // First step - heading content
          content = accountMode === 'pro'
            ? t('onboarding.tours.personalPhotoStylesFreeTour.headingContentPro')
            : t('onboarding.tours.personalPhotoStylesFreeTour.headingContentIndividual')
        } else if (stepIndex === 1 && tour.name === 'personal-photo-styles-free') {
          // Second step - free banner content
          content = accountMode === 'pro'
            ? t('onboarding.tours.personalPhotoStylesFreeTour.freeContentPro')
            : t('onboarding.tours.personalPhotoStylesFreeTour.freeContentIndividual')
        } else if (stepIndex === 0 && tour.name === 'personal-photo-styles-page') {
          // First step - heading content for paid plan
          content = accountMode === 'pro'
            ? t('onboarding.tours.personalPhotoStylesPageTour.headingContentPro')
            : t('onboarding.tours.personalPhotoStylesPageTour.headingContentIndividual')
        } else if (stepIndex === 1 && tour.name === 'personal-photo-styles-page') {
          // Second step - create button content for paid plan
          content = accountMode === 'pro'
            ? t('onboarding.tours.personalPhotoStylesPageTour.createContentPro')
            : t('onboarding.tours.personalPhotoStylesPageTour.createContentIndividual')
        }
      }

      return {
        ...step,
        title: title || step.title,
        content: content || step.content,
        icon: null,
      }
    }),
  }))
}

export function OnbordaProvider({ children }: OnbordaProviderProps) {
  const t = useTranslations('app')
  const { context } = useOnboardingState()
  const [tours, setTours] = useState<ReturnType<typeof generateTours> | null>(null)
  
  // Track context values to detect changes
  const contextRef = useRef<{ teamName?: string; firstName?: string; isFreePlan?: boolean }>({})
  
  // Generate tours when context is loaded, using ref to prevent unnecessary regenerations
  const toursRef = useRef<ReturnType<typeof generateTours> | null>(null)
  useEffect(() => {
    const teamNameChanged = context.teamName !== contextRef.current.teamName
    const firstNameChanged = context.firstName !== contextRef.current.firstName
    const isFreePlanChanged = context.isFreePlan !== contextRef.current.isFreePlan
    
    // Regenerate tours if context is loaded and relevant values changed
    if (context._loaded && (teamNameChanged || firstNameChanged || isFreePlanChanged || !toursRef.current)) {
      contextRef.current = { teamName: context.teamName, firstName: context.firstName, isFreePlan: context.isFreePlan }
      toursRef.current = generateTours(t, context)
      setTours(toursRef.current)
    } else if (!toursRef.current) {
      // Generate initial tours with current context (will use fallbacks if values not available)
      toursRef.current = generateTours(t, context)
      setTours(toursRef.current)
    }
  }, [context._loaded, context.teamName, context.firstName, context.isFreePlan, context, t])
  
  // Use tours from ref if state is not ready yet
  const finalTours = tours || toursRef.current || generateTours(t, context)

  return (
    <OnbordaProviderLib>
      <Onborda steps={finalTours} cardComponent={OnbordaCard}>
        {children}
      </Onborda>
    </OnbordaProviderLib>
  )
}
