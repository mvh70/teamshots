import { Step } from 'onborda'

// Extended step type to support custom actions
export interface ExtendedStep extends Omit<Step, 'icon'> {
  customActions?: boolean
}

// Tour configurations for different onboarding flows
export interface TourConfig {
  steps: ExtendedStep[] // Make icon optional since we don't need it
  name: string
  description: string
  triggerCondition?: (context: OnboardingContext) => boolean
  startingPath?: string // Add this line for the starting path of the tour
}

export interface OnboardingContext {
  userId?: string
  personId?: string
  firstName?: string
  isTeamAdmin: boolean
  isTeamMember: boolean
  isRegularUser: boolean
  teamId?: string
  teamName?: string
  hasUploadedSelfie: boolean
  hasGeneratedPhotos: boolean
  accountMode: 'individual' | 'pro' | 'team_member'
  language: 'en' | 'es'
  isFreePlan: boolean
  onboardingSegment: 'organizer' | 'individual' | 'invited' // New: defines the user segment for onboarding
  completedTours?: string[] // Array of completed tour names from database
  pendingTours?: string[] // Array of pending tour names from database
  _loaded?: boolean // Internal flag to track if context has been loaded from server
}

/*
Cialdini Principles Mapping for Main Onboarding Flow:

1. RECIPROCITY: Give value first, get commitment back
   - Screen 2: Provide before/after transformation demo without asking for anything
   - Screen 2: Share professional photo tips and best practices upfront

2. COMMITMENT & CONSISTENCY: Get small commitments, build on them
   - Screen 4: First action (upload selfie) builds on understanding and excitement from previous screens

3. SOCIAL PROOF: Show what others are doing
   - Screen 1: "Join thousands of professionals who've already elevated their presence"
   - Screen 4: "Over 4,000 professional photos generated this week"

4. AUTHORITY: Demonstrate credibility and expertise
   - Screen 1: Segment-specific positioning (HR teams, founders, professionals)
   - Screen 2: "Teams using consistent professional photos see 40% higher engagement" (with credible source implication)
   - Screen 3: Clear, simple process demonstrates expertise

5. LIKING: Build rapport and connection
   - Screen 1: Warm, welcoming tone with segment-specific messaging
   - Screen 3: Simple, friendly explanation: "That's it! No photo shoots, no scheduling, no hassle."

6. SCARCITY: Limited availability creates desire
   - Screen 4: "Over 4,000 professional photos generated this week" (implied popularity/demand)

7. UNITY: Shared identity and belonging
   - Screen 1: Segment-specific messaging reinforces belonging (HR teams, professionals, team members)
   - Screen 2: "Perfect for LinkedIn, portfolios, and professional networking" (shared professional goals)
   - Reinforces belonging to professional community
*/

// Function to create tours with translations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTranslatedTours(t: (key: string, values?: Record<string, any>) => string, context?: OnboardingContext): Record<string, TourConfig> {
  // Segment-specific content helpers
  type ContentStep = 'welcome-content' | 'transformation-content' | 'how-it-works-content' | 'first-action-content'
  type SegmentType = 'organizer' | 'individual' | 'invited'

  const getSegmentSpecificContent = (step: ContentStep, segment: SegmentType | undefined = 'individual') => {
    const segmentContent = {
      'welcome-content': {
        // Translations are used instead - see translation keys below
        // organizer/individual/invited handled via translation keys
      },
      'transformation-content': {
        // Translations are used instead - see translation keys below
        // organizer/individual/invited handled via translation keys
      },
      'how-it-works-content': {
        // Translations are used instead - see translation keys below
        // organizer/individual/invited handled via translation keys
      },
      'first-action-content': {
        // Translations are used instead - see translation keys below
        // organizer/organizer-free/individual/individual-free/invited handled via translation keys
      }
    }

    // Handle welcome-content with translations
    if (step === 'welcome-content') {
      if (segment === 'organizer') {
        return t('dashboard.onboarding.welcomeContent.organizer')
      }
      if (segment === 'individual') {
        return t('dashboard.onboarding.welcomeContent.individual')
      }
      if (segment === 'invited') {
        return t('dashboard.onboarding.welcomeContent.invited')
      }
    }

    // Handle transformation-content with translations
    if (step === 'transformation-content') {
      if (segment === 'organizer') {
        return t('dashboard.onboarding.transformationContent.organizer')
      }
      if (segment === 'individual') {
        return t('dashboard.onboarding.transformationContent.individual')
      }
      if (segment === 'invited') {
        return t('dashboard.onboarding.transformationContent.invited')
      }
    }

    // Handle organizer with free plan check - use translations
    if (step === 'first-action-content' && segment === 'organizer' && context?.isFreePlan) {
      return t('dashboard.onboarding.firstAction.organizer.free.description')
    }

    // Handle organizer paid plan - use translations
    if (step === 'first-action-content' && segment === 'organizer') {
      return t('dashboard.onboarding.firstAction.organizer.paid.description')
    }

    // Handle individual with free plan check - use translations
    if (step === 'first-action-content' && segment === 'individual' && context?.isFreePlan) {
      return t('dashboard.onboarding.firstAction.individual.free.description')
    }

    // Handle individual paid plan - use translations
    if (step === 'first-action-content' && segment === 'individual') {
      return t('dashboard.onboarding.firstAction.individual.paid.description')
    }

    // Handle invited first-action-content - use translations
    if (step === 'first-action-content' && segment === 'invited') {
      return t('dashboard.onboarding.firstAction.invited.description')
    }

    // Handle how-it-works-content with translations
    if (step === 'how-it-works-content') {
      if (segment === 'organizer') {
        if (context?.isFreePlan) {
          const step1 = t('dashboard.onboarding.howItWorks.organizer.free.step1.title')
          const step1Desc = t('dashboard.onboarding.howItWorks.organizer.free.step1.description')
          const step2 = t('dashboard.onboarding.howItWorks.organizer.free.step2.title')
          const step2Desc = t('dashboard.onboarding.howItWorks.organizer.free.step2.description')
          return `${t('dashboard.onboarding.howItWorks.title')}:\n\n1. ${step1}\n${step1Desc}\n\n2. ${step2}\n${step2Desc}`
        } else {
          const step1 = t('dashboard.onboarding.howItWorks.organizer.step1.title')
          const step2 = t('dashboard.onboarding.howItWorks.organizer.step2.title')
          const step4 = t('dashboard.onboarding.howItWorks.organizer.step4.title')
          const step4Desc = t('dashboard.onboarding.howItWorks.organizer.step4.description')
          return `${t('dashboard.onboarding.howItWorks.title')}:\n\n1. ${step1}\n2. ${step2}\n3. ${step4}\n\n${step4Desc}.`
        }
      }
      if (segment === 'individual') {
        const step1 = t('dashboard.onboarding.howItWorks.individual.step1.title')
        const step3 = t('dashboard.onboarding.howItWorks.individual.step3.title')
        const step3Desc = context?.isFreePlan 
          ? t('dashboard.onboarding.howItWorks.individual.step3.descriptionFree')
          : t('dashboard.onboarding.howItWorks.individual.step3.descriptionPaid')
        return `${t('dashboard.onboarding.howItWorks.title')}:\n\n1. ${step1}\n2. ${step3}\n\n${step3Desc}.`
      }
      if (segment === 'invited') {
        const step1 = t('dashboard.onboarding.howItWorks.invited.step1.title')
        const step2 = t('dashboard.onboarding.howItWorks.invited.step2.title')
        const step3 = t('dashboard.onboarding.howItWorks.invited.step3.title')
        const step3Desc = t('dashboard.onboarding.howItWorks.invited.step3.description')
        return `${t('dashboard.onboarding.howItWorks.title')}:\n\n1. ${step1}\n2. ${step2}\n3. ${step3}\n\n${step3Desc}.`
      }
    }

    // Fallback for other cases (e.g., invited segment)
    const stepContent = segmentContent[step] as Record<string, string> | undefined
    if (stepContent && segment && stepContent[segment]) {
      return stepContent[segment]
    }
    // Final fallback
    if (stepContent && 'individual' in stepContent) {
      return stepContent.individual
    }
    return ''
  }

  // Helper to get first action title with translations
  const getFirstActionTitle = (segment: SegmentType | undefined = 'individual') => {
    if (segment === 'organizer' && context?.isFreePlan) {
      return t('dashboard.onboarding.firstAction.organizer.free.title')
    }
    if (segment === 'organizer') {
      return t('dashboard.onboarding.firstAction.organizer.paid.title')
    }
    if (segment === 'individual' && context?.isFreePlan) {
      return t('dashboard.onboarding.firstAction.individual.free.title')
    }
    if (segment === 'individual') {
      return t('dashboard.onboarding.firstAction.individual.paid.title')
    }
    return 'Ready to get started?'
  }

  return {
    'main-onboarding': {
      name: 'main-onboarding',
      description: 'Main onboarding tour for team admins after team creation or individual users on first dashboard visit',
      triggerCondition: (context) => !context.hasGeneratedPhotos && (context._loaded ?? false),
      steps: [
        {
          selector: '#how-it-works',
          title: t('dashboard.onboarding.howItWorks.title'),
          content: getSegmentSpecificContent('how-it-works-content', context?.onboardingSegment),
          side: 'bottom',
          pointerPadding: 40,
        },
        {
          selector: '#first-action',
          title: getFirstActionTitle(context?.onboardingSegment),
          content: getSegmentSpecificContent('first-action-content', context?.onboardingSegment),
          side: 'bottom',
          pointerPadding: 40,
          customActions: true,
        },
      ],
      startingPath: '/app/dashboard'
    },
    'generation-detail': {
      name: 'generation-detail',
      description: 'Tour after first photo generation explaining how to interact with generated photos',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      triggerCondition: (_context) => false, // Triggered manually from invite dashboard
      startingPath: '/app/generations', // Allow on both /team and /personal pages
      steps: [
        {
          selector: '[data-onborda="regenerations-info"]',
          title: t('onboarding.tours.generationDetailTour.creditsInfoTitle1'),
          content: t('onboarding.tours.generationDetailTour.creditsInfoContent1'),
          side: 'top',
          pointerPadding: 20,
        },
        {
          selector: '[data-onborda="photos-info"]',
          title: t('onboarding.tours.generationDetailTour.creditsInfoTitle2'),
          content: t('onboarding.tours.generationDetailTour.creditsInfoContent2'),
          side: 'top',
          pointerPadding: 20,
        },
        {
          selector: '[data-onborda="feedback-rating"]',
          title: t('onboarding.tours.generationDetailTour.feedbackTitle'),
          content: t('onboarding.tours.generationDetailTour.feedbackContent'),
          side: 'top',
          pointerPadding: 20,
        },
      ]
    },
    'photo-style-creation': {
      name: 'photo-style-creation',
      description: 'Comprehensive guide through creating a new photo style',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      triggerCondition: (_context) => false, // Currently deactivated
      steps: [
        {
          selector: '#style-name-input',
          title: t('onboarding.tours.photoStyleCreationTour.nameTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.nameContent'),
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#composition-settings-section',
          title: t('onboarding.tours.photoStyleCreationTour.compositionTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.compositionContent'),
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#background-toggle',
          title: t('onboarding.tours.photoStyleCreationTour.userChoiceTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.userChoiceContent'),
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#background-settings',
          title: t('onboarding.tours.photoStyleCreationTour.backgroundTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.backgroundContent'),
          side: 'right',
          pointerPadding: 20,
        },
        {
          selector: '#branding-settings',
          title: t('onboarding.tours.photoStyleCreationTour.brandingTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.brandingContent'),
          side: 'left',
          pointerPadding: 20,
        },
        {
          selector: '#shotType-settings',
          title: t('onboarding.tours.photoStyleCreationTour.shotTypeTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.shotTypeContent'),
          side: 'left',
          pointerPadding: 20,
        },
        {
          selector: '#user-style-settings-section',
          title: t('onboarding.tours.photoStyleCreationTour.userStyleTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.userStyleContent'),
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#clothing-settings',
          title: t('onboarding.tours.photoStyleCreationTour.clothingTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.clothingContent'),
          side: 'right',
          pointerPadding: 20,
        },
        {
          selector: '#clothingColors-settings',
          title: t('onboarding.tours.photoStyleCreationTour.clothingColorsTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.clothingColorsContent'),
          side: 'left',
          pointerPadding: 20,
        },
        {
          selector: '#expression-settings',
          title: t('onboarding.tours.photoStyleCreationTour.expressionTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.expressionContent'),
          side: 'left',
          pointerPadding: 20,
        },
        {
          selector: '#autosave-indicator',
          title: t('onboarding.tours.photoStyleCreationTour.autosaveTitle'),
          content: t('onboarding.tours.photoStyleCreationTour.autosaveContent'),
          side: 'bottom',
          pointerPadding: 20,
        },
      ]
    }
  }
}

// Helper to get applicable tours for a context with translations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getApplicableTours(context: OnboardingContext, t: (key: string, values?: Record<string, any>) => string): TourConfig[] {
  const translatedTours = createTranslatedTours(t, context)
  return Object.values(translatedTours).filter(
    (tour) => !tour.triggerCondition || tour.triggerCondition(context)
  )
}

// Helper to get tour by name with translations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTour(name: string, t: (key: string, values?: Record<string, any>) => string, context?: OnboardingContext): TourConfig | undefined {
  const translatedTours = createTranslatedTours(t, context)
  return translatedTours[name]
}
