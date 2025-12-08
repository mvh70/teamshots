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
  hiddenScreens?: string[] // Screens the user has opted to skip (stored in Person.onboardingState)
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
export function createTranslatedTours(t: (key: string, values?: Record<string, any>) => string): Record<string, TourConfig> {
  return {
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
  const translatedTours = createTranslatedTours(t)
  return Object.values(translatedTours).filter(
    (tour) => !tour.triggerCondition || tour.triggerCondition(context)
  )
}

// Helper to get tour by name with translations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTour(name: string, t: (key: string, values?: Record<string, any>) => string, context?: OnboardingContext): TourConfig | undefined {
  const translatedTours = createTranslatedTours(t)
  const tour = translatedTours[name]

  if (tour?.triggerCondition) {
    if (!context) return undefined
    return tour.triggerCondition(context) ? tour : undefined
  }

  return tour
}
