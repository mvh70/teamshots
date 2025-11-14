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
  _loaded?: boolean // Internal flag to track if context has been loaded from server
}

// Welcome flow for regular users
export const welcomeTour: TourConfig = {
  name: 'welcome',
  description: 'Initial welcome flow explaining TeamShotsPro for individual users',
  triggerCondition: (context) => !context.isTeamAdmin,
  steps: [
    {
      selector: '#welcome-section',
      title: 'Welcome to TeamShotsPro, {Firstname}!',
      content: "Thanks for choosing TeamShotsPro. You're awesome! 🚀\nReady to transform your selfie into headshots that command attention? You'll look impeccably professional before your coffee goes cold.",
      side: 'bottom',
      pointerPadding: 40,
    },
    {
      selector: '#sidebar-personal-styles-nav',
      title: 'Customize your photo styles',
      content: 'Before generating photos, you can customize your photo styles here. Choose backgrounds, clothing, expressions, and more to create your perfect professional look.',
      side: 'right',
      pointerPadding: 16,
      customActions: true,
    },
  ]
}

// Welcome flow for team admins
export const teamAdminWelcomeTour: TourConfig = {
  name: 'team-admin-welcome',
  description: 'Welcome flow for team administrators',
  triggerCondition: (context) => context.isTeamAdmin && !context.teamId,
  steps: [
    {
      selector: '#welcome-section',
      title: 'Welcome to TeamShotsPro, {Firstname}!',
      content: "Thanks for choosing TeamShotsPro. You're awesome! 🚀\n\nReady to transform your entire team into a cohesive group of polished professionals? Everyone will look consistently excellent before you finish your coffee break.",
      side: 'bottom',
      pointerPadding: 40,
    },
    {
      selector: '#teamName',
      title: 'Add your team name',
      content: 'Enter your team name here to get started. This will be used to identify your team throughout TeamShotsPro.',
      side: 'bottom',
      pointerPadding: 16,
    },
  ]
}

// Guided first generation flow
export const generationTour: TourConfig = {
  name: 'first-generation',
  description: 'Guided tour for first photo generation',
  triggerCondition: undefined,
  steps: [
    {
      selector: '#upload-photo',
      title: 'Upload your photo',
      content: 'Drop your selfie here and witness the transformation. We turn casual snapshots into headshots that make you shine like a LinkedIn legend.',
      side: 'bottom',
      pointerPadding: 36,
    },
    {
      selector: '#generation-type-selector',
      title: 'Choose your style',
      content: 'Personal photos for your professional image, or team photos if you want to coordinate your team\'s visual consistency.',
      side: 'right',
      pointerPadding: 40,
    },
    {
      selector: '#credit-cost-display',
      title: 'Your credits',
      content: 'Each generation costs 10 credits. Trust us, you\'ll want to use them all once you see how impressive you look.',
      side: 'top',
      pointerPadding: 32,
    },
    {
      selector: '#generate-btn',
      title: 'Generate your photos',
      content: 'Click here to begin your transformation. Your professional headshots will be ready before you can say "cheese."',
      side: 'bottom',
      pointerPadding: 36,
    },
  ]
}

// Team setup flow for admins
export const teamSetupTour: TourConfig = {
  name: 'team-setup',
  description: 'Guide for setting up a team',
  triggerCondition: (context) => context.isTeamAdmin && !context.teamId,
  steps: [
    {
      selector: '#team-create-btn',
      title: 'Create your team',
      content: 'Set up your team here and prepare to transform your entire group into a team of polished professionals. This takes seconds, the results last forever.',
      side: 'bottom',
      pointerPadding: 40,
    },
    {
      selector: '#photo-style-setup',
      title: 'Set up photo styles',
      content: 'Define your team\'s signature look here. Ensure everyone shines consistently - no more inconsistent photos in company profiles.',
      side: 'right',
      pointerPadding: 40,
    },
    {
      selector: '#invite-members',
      title: 'Invite your team',
      content: 'Bring your team on board so they can begin their professional transformation. They\'ll thank you when they look this impressive.',
      side: 'left',
      pointerPadding: 40,
    },
  ]
}

// Team photo style setup flow for admins after team creation
export const teamPhotoStyleSetupTour: TourConfig = {
  name: 'team-photo-style-setup',
  description: 'Guide for setting up team photo styles after team creation',
  triggerCondition: (context) => Boolean(context.isTeamAdmin && context.teamId),
  steps: [
    {
      selector: '#sidebar-team-styles-nav',
      title: 'Set up your team photo styles',
      content: 'Create your team\'s signature look here. Ensure everyone shines consistently - because your brand deserves to look as impressive as your team.',
      side: 'right',
      pointerPadding: 16,
    },
  ]
}

// Team photo styles page explanation tour (paid plan)
export const teamPhotoStylesPageTour: TourConfig = {
  name: 'team-photo-styles-page',
  description: 'Explain team photo styles page for paid plans',
  triggerCondition: (context) => Boolean(context.isTeamAdmin && context.teamId && !context.isFreePlan),
  steps: [
    {
      selector: '#team-photo-styles-heading',
      title: 'Your team photo styles',
      content: 'A team photo style is a preset that ensures all your team members\' photos look consistent and professional. It defines backgrounds, clothing, expressions, and branding so everyone matches your brand identity perfectly. Create and manage your team\'s signature looks here.',
      side: 'bottom',
      pointerPadding: 20,
    },
    {
      selector: '#create-team-style-btn',
      title: 'Create custom styles',
      content: 'Click here to craft custom photo styles that make your team look like the professionals they are. Backgrounds, branding, clothing - you control it all.',
      side: 'left',
      pointerPadding: 16,
    },
  ]
}

// Team photo styles page explanation tour (free plan)
export const teamPhotoStylesFreeTour: TourConfig = {
  name: 'team-photo-styles-free',
  description: 'Explain team photo styles page for free plans',
  triggerCondition: (context) => Boolean(context.isTeamAdmin && context.teamId && context.isFreePlan),
  steps: [
    {
      selector: '#team-photo-styles-heading',
      title: 'Your team photo styles',
      content: 'A team photo style is a preset that ensures all your team members\' photos look consistent and professional. It defines backgrounds, clothing, expressions, and branding so everyone matches your brand identity perfectly. Even on the free plan, everyone gets to shine consistently and professionally.',
      side: 'bottom',
      pointerPadding: 20,
    },
    {
      selector: '[data-testid="free-plan-banner"]',
      title: 'Free plan',
      content: 'Use our professional "Free Package Style" to make your team shine immediately. Upgrade anytime to create custom styles that perfectly match your brand.',
      side: 'bottom',
      pointerPadding: 20,
    },
    {
      selector: '#style-background',
      title: 'Background is set',
      content: 'The background is already configured for your team\'s professional look.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#style-branding',
      title: 'TeamShotsPro logo on clothing',
      content: 'Your team photos will feature the TeamShotsPro logo on clothing for consistent branding.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#style-shot-type',
      title: 'Shot type is 3/4',
      content: 'The shot type is set to 3/4, giving your team a professional, consistent framing.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#style-clothing-type',
      title: 'Clothing type is business casual',
      content: 'The clothing style is set to business casual, ensuring everyone looks professional yet approachable.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#style-clothing-colors',
      title: 'Clothing colors are set',
      content: 'The clothing colors are configured to maintain consistency across all team photos.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#style-expression',
      title: 'Expression is confident',
      content: 'The expression is set to confident, helping your team project professionalism and assurance.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#team-photo-styles-heading',
      title: 'Ready to generate or invite',
      content: 'Now you are ready to generate your own image for testing, or invite team members.',
      side: 'bottom',
      pointerPadding: 20,
      customActions: true,
    },
  ]
}

// Personal photo styles page explanation tour (paid plan)
export const personalPhotoStylesPageTour: TourConfig = {
  name: 'personal-photo-styles-page',
  description: 'Explain personal photo styles page for paid plans',
  triggerCondition: (context) => Boolean(context.isRegularUser && !context.hasGeneratedPhotos && !context.isFreePlan),
  steps: [
    {
      selector: '#personal-photo-styles-heading',
      title: 'Your personal photo styles',
      content: 'A personal photo style is a preset that ensures all your photos look consistent and professional. It defines backgrounds, clothing, expressions, and branding so you can create a cohesive professional image. Create and manage your signature looks here.',
      side: 'bottom',
      pointerPadding: 20,
    },
    {
      selector: '#create-personal-style-btn',
      title: 'Create custom styles',
      content: 'Click here to craft custom photo styles that make you look like the professional you are. Backgrounds, branding, clothing - you control it all.',
      side: 'left',
      pointerPadding: 16,
    },
  ]
}

// Personal photo styles page explanation tour (free plan)
export const personalPhotoStylesFreeTour: TourConfig = {
  name: 'personal-photo-styles-free',
  description: 'Explain personal photo styles page for free plans',
  triggerCondition: (context) => Boolean(context.isRegularUser && !context.hasGeneratedPhotos && context.isFreePlan),
  steps: [
    {
      selector: '#personal-photo-styles-heading',
      title: 'Your personal photo styles',
      content: 'A personal photo style is a preset that ensures all your photos look consistent and professional. It defines backgrounds, clothing, expressions, and branding so you can create a cohesive professional image. Even on the free plan, you get to shine consistently and professionally.',
      side: 'bottom',
      pointerPadding: 20,
    },
    {
      selector: '[data-testid="free-plan-banner"]',
      title: 'Free plan',
      content: 'Use our professional "Free Package Style" to make yourself shine immediately. Upgrade anytime to create custom styles that perfectly match your brand.',
      side: 'bottom',
      pointerPadding: 20,
    },
    {
      selector: '#style-background',
      title: 'Background is set',
      content: 'The background is already configured for your professional look.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#style-branding',
      title: 'TeamShotsPro logo on clothing',
      content: 'Your photos will feature the TeamShotsPro logo on clothing for consistent branding.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#style-shot-type',
      title: 'Shot type is 3/4',
      content: 'The shot type is set to 3/4, giving you a professional, consistent framing.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#style-clothing-type',
      title: 'Clothing type is business casual',
      content: 'The clothing style is set to business casual, ensuring you look professional yet approachable.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#style-clothing-colors',
      title: 'Customize clothing colors',
      content: 'Here\'s where you shine: You can pick your own wardrobe colors while keeping everything consistent. Mix it up!',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#style-expression',
      title: 'Expression is confident',
      content: 'The expression is set to confident, helping you project professionalism and assurance.',
      side: 'right',
      pointerPadding: 16,
    },
    {
      selector: '#primary-generate-btn',
      title: 'Ready to generate',
      content: 'Click here to start generating your first photo.',
      side: 'right',
      pointerPadding: 16,
    },
  ]
}

// Photo style creation helper tour
export const photoStyleCreationTour: TourConfig = {
  name: 'photo-style-creation',
  description: 'Comprehensive guide through creating a new photo style',
  triggerCondition: (context) => Boolean((context.isTeamAdmin && context.teamId) || context.isRegularUser) && !context.isFreePlan,
  steps: [
    {
      selector: '#style-name-input',
      title: 'Name your style',
      content: 'Give your style a name that clearly represents your team - something your colleagues will instantly recognize and appreciate.',
      side: 'bottom',
      pointerPadding: 20,
    },
    {
      selector: '#composition-settings-section',
      title: 'Composition settings',
      content: 'Here you define the composition of the photo, like background, branding, and type of photo. These settings control the overall look and feel of your team photos.',
      side: 'bottom',
      pointerPadding: 20,
    },
    {
      selector: '#background-toggle',
      title: 'User choice or predefined',
      content: 'Each component can be fixed for each user, or be decided by the user. Toggle between "Predefined" (locked for all users) and "User Choice" (users can customize).',
      side: 'bottom',
      pointerPadding: 20,
    },
    {
      selector: '#background-settings',
      title: 'Background',
      content: 'You can customize the background - choose from solid colors, custom images, or AI-enhanced backgrounds to create the perfect backdrop for your team.',
      side: 'right',
      pointerPadding: 20,
    },
    {
      selector: '#branding-settings',
      title: 'Branding',
      content: 'You can add a logo in different places in the photo - in the background, on the clothing, or on an element in the photo like a banner. Make your brand unmistakable.',
      side: 'left',
      pointerPadding: 20,
    },
    {
      selector: '#shotType-settings',
      title: 'Shot type',
      content: 'Here you define the type of photo - choose between close-up (headshot), 3/4 view, or full length. This determines how much of the subject is visible.',
      side: 'left',
      pointerPadding: 20,
    },
    {
      selector: '#user-style-settings-section',
      title: 'User style settings',
      content: 'Here you define how the subject in the photo comes out - clothing style, colors, facial expression, and lighting preferences.',
      side: 'bottom',
      pointerPadding: 20,
    },
    {
      selector: '#clothing-settings',
      title: 'Clothing',
      content: 'Define the clothing style for your team photos - business formal, business casual, or casual. Set the standard that makes everyone look professional.',
      side: 'right',
      pointerPadding: 20,
    },
    {
      selector: '#clothingColors-settings',
      title: 'Clothing colors',
      content: 'You can either describe the colors (e.g., "blue", "navy"), or pick specific colors using the color picker. Each team member can customize their colors if you set it to "User Choice".',
      side: 'left',
      pointerPadding: 20,
    },
    {
      selector: '#expression-settings',
      title: 'Facial expression',
      content: 'Set the facial expression for your team photos - confident, neutral, friendly, or professional. Help your team project the right energy.',
      side: 'left',
      pointerPadding: 20,
    },
    {
      selector: '#autosave-indicator',
      title: 'Automatic saving',
      content: 'Each change is saved automatically, so no need to click a button to save. Watch for the "Saved" indicator to confirm your changes are stored.',
      side: 'bottom',
      pointerPadding: 20,
    },
  ]
}

// Test generation tour for after photo style setup
export const testGenerationTour: TourConfig = {
  name: 'test-generation',
  description: 'Encourage testing the service with first photo generation',
  triggerCondition: (context) => Boolean(context.isTeamAdmin && context.teamId),
  steps: [
    {
      selector: '#primary-generate-btn',
      title: 'Generate your first photo',
      content: 'You\'re all set up and ready to shine. Test the process here before introducing it to your team - you\'ll want to see this transformation first.',
      side: 'right',
      pointerPadding: 16,
    },
  ]
}

// Invite team members tour
export const inviteTeamTour: TourConfig = {
  name: 'invite-team',
  description: 'Guide for inviting team members',
  triggerCondition: (context) => Boolean(context.isTeamAdmin && context.teamId),
  steps: [
    {
      selector: '#team-free-plan-banner, #team-active-style',
      title: 'Your team photo style',
      content: 'This is the photo style your team members will use. On the free plan, everyone uses the Free Package Style. Paid plans can customize their own style.',
      side: 'right',
      pointerPadding: 20,
    },
    {
      selector: '#invite-team-member-btn',
      title: 'Invite your team',
      content: 'Send invites to your team members. They\'ll receive an email and can generate their own professional photos with their selfies without registering.',
      side: 'bottom',
      pointerPadding: 20,
    },
  ]
}

// Generation detail tour - shows how to interact with generated photos
export const generationDetailTour: TourConfig = {
  name: 'generation-detail',
  description: 'Tour explaining how to interact with generated photos',
  triggerCondition: (context) => Boolean(context.hasGeneratedPhotos && (context.isRegularUser || context.isTeamAdmin)),
  steps: [
    {
      selector: '[data-onborda="generated-photo"]',
      title: 'Your generated photo',
      content: 'This is your generated professional headshot. You can see the transformation from your original selfie to this polished result.',
      side: 'right',
      pointerPadding: 20,
    },
    {
      selector: '[data-onborda="credits-info"]',
      title: 'Manage your generation',
      content: 'Download your photo in high resolution, regenerate for free using the same settings, or delete if you no longer need it. This also shows the generation cost (10 credits) and how many free regenerations you have left.',
      side: 'top',
      pointerPadding: 20,
    },
  ]
}

// Tour configurations registry
export const tourConfigs: Record<string, TourConfig> = {
  welcome: welcomeTour,
  'team-admin-welcome': teamAdminWelcomeTour,
  'first-generation': generationTour,
  'team-setup': teamSetupTour,
  'team-photo-style-setup': teamPhotoStyleSetupTour,
  'team-photo-styles-page': teamPhotoStylesPageTour,
  'team-photo-styles-free': teamPhotoStylesFreeTour,
  'personal-photo-styles-page': personalPhotoStylesPageTour,
  'personal-photo-styles-free': personalPhotoStylesFreeTour,
  'photo-style-creation': photoStyleCreationTour,
  'test-generation': testGenerationTour,
  'invite-team': inviteTeamTour,
  'generation-detail': generationDetailTour,
}


// Function to create tours with translations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTranslatedTours(t: (key: string, values?: Record<string, any>) => string, context?: OnboardingContext): Record<string, TourConfig> {
  return {
    welcome: {
      name: 'welcome',
      description: 'Initial welcome flow explaining TeamShotsPro for individual users',
      triggerCondition: (context) => !context.isTeamAdmin,
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
      triggerCondition: (context) => context.isTeamAdmin && !context.teamId,
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
      triggerCondition: undefined,
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
      triggerCondition: (context) => context.isTeamAdmin && !context.teamId,
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
      triggerCondition: (context) => Boolean(context.isTeamAdmin && context.teamId),
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
      triggerCondition: (context) => Boolean(context.isTeamAdmin && context.teamId && !context.isFreePlan),
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
      triggerCondition: (context) => Boolean(context.isTeamAdmin && context.teamId && context.isFreePlan),
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
      triggerCondition: (context) => Boolean(context.isRegularUser && !context.isFreePlan),
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
      triggerCondition: (context) => Boolean(context.isRegularUser && context.isFreePlan),
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
      triggerCondition: (context) => Boolean((context.isTeamAdmin && context.teamId) || context.isRegularUser) && !context.isFreePlan,
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
      triggerCondition: (context) => Boolean(context.isTeamAdmin && context.teamId),
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
      triggerCondition: (context) => Boolean(context.isTeamAdmin && context.teamId),
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
      triggerCondition: (context) => Boolean(context.hasGeneratedPhotos && (context.isRegularUser || context.isTeamAdmin)),
      steps: [
        {
          selector: '[data-onborda="generated-photo"]',
          title: t('onboarding.tours.generationDetailTour.photoTitle'),
          content: t('onboarding.tours.generationDetailTour.photoContent'),
          side: 'right',
          pointerPadding: 20,
        },
        {
          selector: '[data-onborda="credits-info"]',
          title: t('onboarding.tours.generationDetailTour.manageTitle', { default: 'Manage your generation' }),
          content: t('onboarding.tours.generationDetailTour.manageContent', { 
            default: 'Download your photo in high resolution, regenerate for free using the same settings, or delete if you no longer need it. This also shows the generation cost (10 credits) and how many free regenerations you have left.' 
          }),
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
