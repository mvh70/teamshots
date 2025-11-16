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

// Welcome flow for regular users
export const welcomeTour: TourConfig = {
  name: 'welcome',
  description: 'Initial welcome flow explaining TeamShotsPro for individual users',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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
// DISABLED: Now using auto-opening invite modal instead of tour
export const inviteTeamTour: TourConfig = {
  name: 'invite-team',
  description: 'Guide for inviting team members',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated - using modal instead
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  triggerCondition: (_context) => false, // Deactivated
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

/*
IMPLEMENTATION PLAN WITH MOBILE OPTIMIZATION:

## Mobile-First Design Principles:
- Touch targets: Minimum 44px height/width for interactive elements
- Thumb zone: Place primary actions in bottom 1/3 of screen
- One-handed use: Critical elements within 120px from bottom
- Swipe gestures: Horizontal swipes for galleries, vertical for scrolling
- Readable text: 16px minimum font size, 1.5x line height
- Progressive disclosure: Show essential info first, details on demand
- Landscape consideration: Test and optimize for both orientations

## Components to Update:
1. `src/components/onboarding/OnboardingLauncher.tsx`
   - Update to trigger 'main-onboarding' tour instead of old welcome tours
   - Add logic to check if user has seen main-onboarding
   - MOBILE: Ensure tour positioning works on small screens

2. `src/components/onboarding/OnbordaCard.tsx`
   - Already supports customActions, should work with new tour
   - May need updates for segment-specific button text/behavior
   - MOBILE: Optimize card width (max 360px), ensure buttons are touch-friendly

## New UI Components Needed (Mobile-Optimized):
1. **Before/After Slider** (`src/components/onboarding/BeforeAfterSlider.tsx`)
   - Touch-friendly slider with large drag handles
   - Swipe gestures for smooth interaction
   - Optimized image loading for mobile networks
   - MOBILE: Full-width on mobile, centered on desktop

2. **Role Selection Cards** (`src/components/onboarding/RoleSelection.tsx`)
   - Large touch targets (minimum 44px)
   - Clear visual hierarchy with icons
   - MOBILE: Single column stack, swipe between options
   - Should set user segment in context/state

3. **Outcome Selection** (`src/components/onboarding/OutcomeSelection.tsx`)
   - Card-based layout optimized for touch
   - Radio button alternatives with clear selection states
   - MOBILE: Vertical stack with ample spacing
   - Should commit user to specific goal

4. **Progress Indicator** (`src/components/onboarding/OnboardingProgress.tsx`)
   - Shows "Step X of 5" with visual progress bar
   - MOBILE: Compact design, positioned at top of tour card
   - Clear visual feedback for step completion

5. **Welcome Gallery** (`src/components/onboarding/WelcomeGallery.tsx`)
   - Touch/swipe navigation between images
   - Lazy loading for performance
   - MOBILE: Full-width carousel, touch indicators
   - Auto-rotating with pause on touch

## Selectors to Add:
- `#welcome-section` - Main dashboard welcome area (responsive layout)
- `#role-selection` - Role selection component (touch-optimized)
- `#wow-moment` - Before/after demo component (mobile-friendly)
- `#outcome-selection` - Outcome selection component (stacked for mobile)
- `#first-action` - Upload area or team creation area (large touch targets)

## Pages to Update:
1. **Dashboard/Home Page** (`src/app/[locale]/page.tsx`)
   - Add role selection component with mobile-first layout
   - Add outcome selection component with responsive cards
   - Add before/after demo component with touch interactions
   - Add progress indicator integrated into mobile layout
   - Add welcome gallery with swipe navigation
   - MOBILE: Single column layout, prioritize vertical scrolling

## Tour Positioning (Mobile-Optimized):
- Use `side: 'bottom'` for mobile to avoid keyboard interference
- Larger `pointerPadding` on mobile (40px) for better visibility
- Responsive card sizing: `w-[360px] sm:w-[420px]` for OnbordaCard

## API Updates Needed:
1. **Context API** (`src/app/api/onboarding/context/route.ts`)
   - May need to return onboardingSegment in response
   - Consider device type detection for mobile-specific behaviors

## Database/Schema Updates:
- Consider adding onboarding_segment to user profiles if needed for persistence
- Potentially track mobile vs desktop completion rates

## Mobile Optimization Implementation Status:
✅ **Completed:**
- OnbordaCard: Added `mx-4 sm:mx-0` for mobile margins, `min-h-[44px]` for touch targets
- BeforeAfterSlider: Created touch-friendly component with swipe gestures and mobile-specific UI
- RoleSelection: Built mobile-first component with large touch targets and responsive layout
- Translation keys: Added EN/ES support for role selection component

## Mobile-Specific Testing Requirements:
- Test all 3 segments (organizer, individual, invited) on mobile
- Test tour flow on various screen sizes (320px to 414px width)
- Test touch interactions: swipes, taps, long presses
- Test before/after slider with finger dragging
- Test role/outcome selection with touch targets
- Test in both portrait and landscape orientations
- Test with slow network conditions (image loading)
- Test keyboard avoidance on mobile browsers
- Test with system font scaling enabled
- Verify accessibility: screen reader support, high contrast mode
*/

// Main onboarding flow: 3-screen sequence applying Cialdini principles
// Note: This is a template. The actual tour with segment-specific content is created in createTranslatedTours
export const mainOnboardingTour: TourConfig = {
  name: 'main-onboarding',
  description: 'Comprehensive onboarding flow with wow moment and systematic influence principles',
  triggerCondition: (context) => !context.hasGeneratedPhotos && (context._loaded ?? false),
  steps: [
    {
      selector: '#welcome-section',
      title: 'Professional photos in 60 seconds',
      content: 'Welcome to TeamShotsPro! Transform your casual selfie into polished professional headshots in under 60 seconds.\n\nJoin thousands of professionals who\'ve upgraded their LinkedIn, portfolios, and personal brand.',
      side: 'bottom',
      pointerPadding: 40,
    },
    {
      selector: '#how-it-works',
      title: 'How it works',
      content: 'How it works:\n\n1. Upload your selfie\n2. Choose your style preferences\n3. Get professional photos in under 60 seconds\n\nThat\'s it! No photo shoots, no scheduling, no hassle.',
      side: 'bottom',
      pointerPadding: 40,
    },
    {
      selector: '#first-action',
      title: 'Ready to get started?',
      content: 'Ready to transform your photo?\n\nUpload your selfie now and get professional headshots in under 60 seconds. Over 4,000 professional photos generated this week.',
      side: 'bottom',
      pointerPadding: 40,
      customActions: true,
    },
  ]
}

// Tour configurations registry
export const tourConfigs: Record<string, TourConfig> = {
  'main-onboarding': mainOnboardingTour,
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
  triggerCondition: (_context) => false, // Deactivated
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
