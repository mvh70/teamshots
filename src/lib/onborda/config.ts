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
        const step1 = t('dashboard.onboarding.howItWorks.organizer.step1.title')
        const step2 = t('dashboard.onboarding.howItWorks.organizer.step2.title')
        const step3 = t('dashboard.onboarding.howItWorks.organizer.step3.title')
        const step4 = t('dashboard.onboarding.howItWorks.organizer.step4.title')
        const step4Desc = t('dashboard.onboarding.howItWorks.organizer.step4.description')
        return `${t('dashboard.onboarding.howItWorks.title')}:\n\n1. ${step1}\n2. ${step2}\n3. ${step3}\n4. ${step4}\n\n${step4Desc}.`
      }
      if (segment === 'individual') {
        const step1 = t('dashboard.onboarding.howItWorks.individual.step1.title')
        const step2 = t('dashboard.onboarding.howItWorks.individual.step2.title')
        const step3 = t('dashboard.onboarding.howItWorks.individual.step3.title')
        const step2Desc = t('dashboard.onboarding.howItWorks.individual.step2.description')
        return `${t('dashboard.onboarding.howItWorks.title')}:\n\n1. ${step1}\n2. ${step2}\n3. ${step3}\n\n${step2Desc}.`
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
      description: 'Comprehensive onboarding flow with wow moment and systematic influence principles',
      triggerCondition: (context) => !context.hasGeneratedPhotos && (context._loaded ?? false),
      steps: [
        {
          selector: '#welcome-section',
          title: t('onboarding.tours.mainOnboarding.welcomeTitle'),
          content: getSegmentSpecificContent('welcome-content', context?.onboardingSegment),
          side: 'bottom',
          pointerPadding: 40,
        },
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
      ]
    },
    welcome: {
      name: 'welcome',
      description: 'Initial welcome flow explaining TeamShotsPro for individual users',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#welcome-section',
          title: t('onboarding.tours.welcome.title', { Firstname: '' }),
          content: t('onboarding.tours.welcome.content'),
          side: 'bottom',
          pointerPadding: 40,
        },
        {
          selector: '#sidebar-personal-styles-nav',
          title: t('onboarding.tours.welcome.photoStylesTitle'),
          content: t('onboarding.tours.welcome.photoStylesContent'),
          side: 'right',
          pointerPadding: 16,
          customActions: true,
        },
      ]
    },
    'team-admin-welcome': {
      name: 'team-admin-welcome',
      description: 'Welcome flow for team administrators',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#welcome-section',
          title: t('onboarding.tours.teamAdminWelcome.title', { Firstname: '' }),
          content: t('onboarding.tours.teamAdminWelcome.content'),
          side: 'bottom',
          pointerPadding: 40,
        },
        {
          selector: '#teamName',
          title: t('onboarding.tours.teamAdminWelcome.teamNameTitle'),
          content: t('onboarding.tours.teamAdminWelcome.teamNameContent'),
          side: 'bottom',
          pointerPadding: 16,
        },
      ]
    },
    'first-generation': {
      name: 'first-generation',
      description: 'Guided tour for first photo generation',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#upload-photo',
          title: t('onboarding.tours.generationTour.uploadTitle'),
          content: t('onboarding.tours.generationTour.uploadContent'),
          side: 'bottom',
          pointerPadding: 36,
        },
        {
          selector: '#generation-type-selector',
          title: t('onboarding.tours.generationTour.styleTitle'),
          content: t('onboarding.tours.generationTour.styleContent'),
          side: 'right',
          pointerPadding: 40,
        },
        {
          selector: '#credit-cost-display',
          title: t('onboarding.tours.generationTour.creditsTitle'),
          content: t('onboarding.tours.generationTour.creditsContent'),
          side: 'top',
          pointerPadding: 32,
        },
        {
          selector: '#generate-btn',
          title: t('onboarding.tours.generationTour.generateTitle'),
          content: t('onboarding.tours.generationTour.generateContent'),
          side: 'bottom',
          pointerPadding: 36,
        },
      ]
    },
    'team-setup': {
      name: 'team-setup',
      description: 'Guide for setting up a team',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#team-create-btn',
          title: t('onboarding.tours.teamSetupTour.createTitle'),
          content: t('onboarding.tours.teamSetupTour.createContent'),
          side: 'bottom',
          pointerPadding: 40,
        },
        {
          selector: '#photo-style-setup',
          title: t('onboarding.tours.teamSetupTour.styleTitle'),
          content: t('onboarding.tours.teamSetupTour.styleContent'),
          side: 'right',
          pointerPadding: 40,
        },
        {
          selector: '#invite-members',
          title: t('onboarding.tours.teamSetupTour.inviteTitle'),
          content: t('onboarding.tours.teamSetupTour.inviteContent'),
          side: 'left',
          pointerPadding: 40,
        },
      ]
    },
    'team-photo-style-setup': {
      name: 'team-photo-style-setup',
      description: 'Guide for setting up team photo styles after team creation',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#sidebar-team-styles-nav',
          title: t('onboarding.tours.teamPhotoStyleSetupTour.title'),
          content: t('onboarding.tours.teamPhotoStyleSetupTour.content'),
          side: 'right',
          pointerPadding: 16,
        },
      ]
    },
    'team-photo-styles-page': {
      name: 'team-photo-styles-page',
      description: 'Explain team photo styles page for paid plans',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#team-photo-styles-heading',
          title: t('onboarding.tours.teamPhotoStylesPageTour.headingTitle'),
          content: t('onboarding.tours.teamPhotoStylesPageTour.headingContent'),
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#create-team-style-btn',
          title: t('onboarding.tours.teamPhotoStylesPageTour.createTitle'),
          content: t('onboarding.tours.teamPhotoStylesPageTour.createContent'),
          side: 'left',
          pointerPadding: 16,
        },
      ]
    },
    'team-photo-styles-free': {
      name: 'team-photo-styles-free',
      description: 'Explain team photo styles page for free plans',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#team-photo-styles-heading',
          title: t('onboarding.tours.teamPhotoStylesFreeTour.headingTitle'),
          content: t('onboarding.tours.teamPhotoStylesFreeTour.headingContent'),
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '[data-testid="free-plan-banner"]',
          title: t('onboarding.tours.teamPhotoStylesFreeTour.freeTitle'),
          content: t('onboarding.tours.teamPhotoStylesFreeTour.freeContent'),
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#style-background',
          title: t('onboarding.tours.teamPhotoStylesFreeTour.backgroundTitle'),
          content: t('onboarding.tours.teamPhotoStylesFreeTour.backgroundContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#style-branding',
          title: t('onboarding.tours.teamPhotoStylesFreeTour.brandingTitle'),
          content: t('onboarding.tours.teamPhotoStylesFreeTour.brandingContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#style-shot-type',
          title: t('onboarding.tours.teamPhotoStylesFreeTour.shotTypeTitle'),
          content: t('onboarding.tours.teamPhotoStylesFreeTour.shotTypeContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#style-clothing-type',
          title: t('onboarding.tours.teamPhotoStylesFreeTour.clothingTypeTitle'),
          content: t('onboarding.tours.teamPhotoStylesFreeTour.clothingTypeContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#style-clothing-colors',
          title: t('onboarding.tours.teamPhotoStylesFreeTour.clothingColorsTitle'),
          content: t('onboarding.tours.teamPhotoStylesFreeTour.clothingColorsContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#style-expression',
          title: t('onboarding.tours.teamPhotoStylesFreeTour.expressionTitle'),
          content: t('onboarding.tours.teamPhotoStylesFreeTour.expressionContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#team-photo-styles-heading',
          title: t('onboarding.tours.teamPhotoStylesFreeTour.readyTitle'),
          content: t('onboarding.tours.teamPhotoStylesFreeTour.readyContent'),
          side: 'bottom',
          pointerPadding: 20,
          customActions: true,
        },
      ]
    },
    'personal-photo-styles-page': {
      name: 'personal-photo-styles-page',
      description: 'Explain personal photo styles page for paid plans',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#personal-photo-styles-heading',
          title: t('onboarding.tours.personalPhotoStylesPageTour.headingTitle'),
          content: t('onboarding.tours.personalPhotoStylesPageTour.headingContentIndividual'), // Will be overridden in generateTours based on accountMode
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#create-personal-style-btn',
          title: t('onboarding.tours.personalPhotoStylesPageTour.createTitle'),
          content: t('onboarding.tours.personalPhotoStylesPageTour.createContentIndividual'), // Will be overridden in generateTours based on accountMode
          side: 'left',
          pointerPadding: 16,
        },
      ]
    },
    'personal-photo-styles-free': {
      name: 'personal-photo-styles-free',
      description: 'Explain personal photo styles page for free plans',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#personal-photo-styles-heading',
          title: t('onboarding.tours.personalPhotoStylesFreeTour.headingTitle'),
          content: t('onboarding.tours.personalPhotoStylesFreeTour.headingContentIndividual'), // Will be overridden in generateTours based on accountMode
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '[data-testid="free-plan-banner"]',
          title: t('onboarding.tours.personalPhotoStylesFreeTour.freeTitle'),
          content: t('onboarding.tours.personalPhotoStylesFreeTour.freeContentIndividual'), // Will be overridden in generateTours based on accountMode
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#style-background',
          title: t('onboarding.tours.personalPhotoStylesFreeTour.backgroundTitle'),
          content: t('onboarding.tours.personalPhotoStylesFreeTour.backgroundContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#style-branding',
          title: t('onboarding.tours.personalPhotoStylesFreeTour.brandingTitle'),
          content: t('onboarding.tours.personalPhotoStylesFreeTour.brandingContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#style-shot-type',
          title: t('onboarding.tours.personalPhotoStylesFreeTour.shotTypeTitle'),
          content: t('onboarding.tours.personalPhotoStylesFreeTour.shotTypeContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#style-clothing-type',
          title: t('onboarding.tours.personalPhotoStylesFreeTour.clothingTypeTitle'),
          content: t('onboarding.tours.personalPhotoStylesFreeTour.clothingTypeContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#style-clothing-colors',
          title: t('onboarding.tours.personalPhotoStylesFreeTour.clothingColorsTitle'),
          content: t('onboarding.tours.personalPhotoStylesFreeTour.clothingColorsContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#style-expression',
          title: t('onboarding.tours.personalPhotoStylesFreeTour.expressionTitle'),
          content: t('onboarding.tours.personalPhotoStylesFreeTour.expressionContent'),
          side: 'right',
          pointerPadding: 16,
        },
        {
          selector: '#primary-generate-btn',
          title: t('onboarding.tours.personalPhotoStylesFreeTour.readyTitle'),
          content: t('onboarding.tours.personalPhotoStylesFreeTour.readyContent'),
          side: 'right',
          pointerPadding: 16,
        },
      ]
    },
    'photo-style-creation': {
      name: 'photo-style-creation',
      description: 'Comprehensive guide through creating a new photo style',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
    },
    'test-generation': {
      name: 'test-generation',
      description: 'Encourage testing the service with first photo generation',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#primary-generate-btn',
          title: t('onboarding.tours.testGenerationTour.title'),
          content: t('onboarding.tours.testGenerationTour.content'),
          side: 'right',
          pointerPadding: 16,
        },
      ]
    },
    'invite-team': {
      name: 'invite-team',
      description: 'Guide for inviting team members',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
      steps: [
        {
          selector: '#team-name-header',
          title: t('onboarding.tours.inviteTeamTour.pageTitle', { teamName: context?.teamName || 'your team' }),
          content: t('onboarding.tours.inviteTeamTour.pageContent', { teamName: context?.teamName || 'your team' }),
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#team-invites-table',
          title: t('onboarding.tours.inviteTeamTour.tableTitle'),
          content: t('onboarding.tours.inviteTeamTour.tableContent'),
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#team-active-style, #team-free-plan-banner',
          title: Boolean(context?.isFreePlan)
            ? (t('onboarding.tours.inviteTeamTour.activeStyleTitleFree') || 'Free Package Style')
            : (t('onboarding.tours.inviteTeamTour.activeStyleTitle') || 'Your active photo style'),
          content: Boolean(context?.isFreePlan)
            ? (t('onboarding.tours.inviteTeamTour.activeStyleContentFree') || 'Your team members will use the Free Package Style when generating photos. Upgrade to unlock custom backgrounds, branding, clothing styles, and more customization options.')
            : (t('onboarding.tours.inviteTeamTour.activeStyleContent') || 'This is the photo style your invited team members will use when generating their photos. All their photos will match this style for consistent branding across your team.'),
          side: 'bottom',
          pointerPadding: 20,
        },
        {
          selector: '#invite-team-member-btn',
          title: t('onboarding.tours.inviteTeamTour.title'),
          content: t('onboarding.tours.inviteTeamTour.content'),
          side: 'left',
          pointerPadding: 20,
        },
      ]
    },
    'generation-detail': {
      name: 'generation-detail',
      description: 'Tour explaining how to interact with generated photos',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated - triggered manually from invite dashboard
      steps: [
        {
          selector: '[data-onborda="credits-info"]',
          title: t('onboarding.tours.generationDetailTour.creditsInfoTitle1'),
          content: t('onboarding.tours.generationDetailTour.creditsInfoContent1'),
          side: 'top',
          pointerPadding: 20,
        },
        {
          selector: '[data-onborda="credits-info"]',
          title: t('onboarding.tours.generationDetailTour.creditsInfoTitle2'),
          content: t('onboarding.tours.generationDetailTour.creditsInfoContent2'),
          side: 'top',
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
