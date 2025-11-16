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
        organizer: 'Welcome to TeamShotsPro! Transform your team\'s casual selfies into polished professional headshots in under 60 seconds.\n\nJoin thousands of HR teams and founders who\'ve elevated their company\'s professional presence.',
        individual: 'Welcome to TeamShotsPro! Transform your casual selfie into polished professional headshots in under 60 seconds.\n\nJoin thousands of professionals who\'ve upgraded their LinkedIn, portfolios, and personal brand.',
        invited: 'Welcome to TeamShotsPro! Your team is creating consistent professional photos, and you\'re part of it.\n\nUpload your selfie to match your team\'s professional style and get your headshots in under 60 seconds.'
      },
      'transformation-content': {
        organizer: 'See the transformation: Watch as we turn everyday selfies into professional headshots that command attention.\n\nTeams using our service see 40% higher engagement on company profiles. Here\'s a pro tip: Use natural lighting and frame from the chest up for best results.',
        individual: 'See the transformation: Watch as we turn your casual selfie into a professional headshot that stands out.\n\nPerfect for LinkedIn, portfolios, and professional networking. Here\'s a pro tip: Use natural lighting and frame from the chest up for best results.',
        invited: 'See the transformation: Watch as we turn your selfie into a professional headshot that matches your team\'s style.\n\nYour photos will be consistent with your team while showcasing your unique professional presence.'
      },
      'how-it-works-content': {
        organizer: 'How it works:\n\n1. Set your team\'s brand style\n2. Invite your team members\n3. Team members upload selfies and customize (e.g., wardrobe colors)\n4. Wait for the magic to happen\n\nYour entire team gets consistent, professional photos that match your brand.',
        individual: 'How it works:\n\n1. Upload your selfie\n2. Set your style\n3. Let the magic happen\n\nChoose backgrounds, clothing, expressions, and branding.',
        invited: 'How it works:\n\n1. Upload your selfie\n2. Customize your photo (e.g., wardrobe colors)\n3. Wait for the magic to happen\n\nProfessional headshots ready in under 60 seconds.'
      },
      'first-action-content': {
        organizer: 'Ready to set your brand style?\n\nStart by setting your on-brand photo style. Define backgrounds, clothing, expressions, and branding that match your company.',
        'organizer-free': 'Ready to test it out?\n\nOn the free plan, your team\'s photo style is locked in. Send an invite to yourself to test it out and see how it works!',
        individual: 'Ready to begin your transformation?\n\nLet\'s start by uploading your first selfie. Fully customize your photo style to match your brand. Get your professional photos in under 60 seconds.',
        'individual-free': 'Ready to begin your transformation?\n\nLet\'s start by uploading your first selfie. The free plan includes a fixed professional style to test the service. Get your professional photos in under 60 seconds.',
        invited: 'Ready to join your team?\n\nUpload your selfie now and get professional headshots that match your team\'s style. Over 4,000 professional photos generated this week.'
      }
    }

    // Handle organizer with free plan check
    if (step === 'first-action-content' && segment === 'organizer' && context?.isFreePlan) {
      return segmentContent[step]?.['organizer-free'] || segmentContent[step]?.organizer || ''
    }

    // Handle individual with free plan check
    if (step === 'first-action-content' && segment === 'individual' && context?.isFreePlan) {
      return segmentContent[step]?.['individual-free'] || segmentContent[step]?.individual || ''
    }

    return (segmentContent[step] as Record<string, string>)?.[segment] || segmentContent[step]?.individual || ''
  }

  return {
    'main-onboarding': {
      name: 'main-onboarding',
      description: 'Comprehensive onboarding flow with wow moment and systematic influence principles',
      triggerCondition: (context) => !context.hasGeneratedPhotos && (context._loaded ?? false),
      steps: [
        {
          selector: '#welcome-section',
          title: 'Professional photos in 60 seconds',
          content: getSegmentSpecificContent('welcome-content', context?.onboardingSegment),
          side: 'bottom',
          pointerPadding: 40,
        },
        {
          selector: '#how-it-works',
          title: 'How it works',
          content: getSegmentSpecificContent('how-it-works-content', context?.onboardingSegment),
          side: 'bottom',
          pointerPadding: 40,
        },
        {
          selector: '#first-action',
          title: 'Ready to get started?',
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
          title: 'Not thrilled with your photo?',
          content: 'No worries. You get free do-overs with every generation. Check here to see how many tries you have left.',
          side: 'top',
          pointerPadding: 20,
        },
        {
          selector: '[data-onborda="credits-info"]',
          title: 'Your photo, your way',
          content: 'Love it? Download it ↓. Want another shot? Regenerate it ↻. Changed your mind? Delete it 🗑️. You\'re in control.',
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
