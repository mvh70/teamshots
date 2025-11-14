import { OnboardingContext } from './config'

// Extend window interface for PostHog
declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void
    }
  }
}

// Analytics events for onboarding
export const ONBOARDING_EVENTS = {
  TOUR_STARTED: 'onboarding_tour_started',
  TOUR_COMPLETED: 'onboarding_tour_completed',
  TOUR_SKIPPED: 'onboarding_tour_skipped',
  STEP_VIEWED: 'onboarding_step_viewed',
  STEP_INTERACTED: 'onboarding_step_interacted',
} as const

export interface OnboardingEventData {
  tourName: string
  stepIndex?: number
  totalSteps?: number
  userId?: string
  context?: Partial<OnboardingContext>
  timestamp: string
}

// Simple analytics wrapper for onboarding events
// This integrates with the existing PostHog setup
export function trackOnboardingEvent(
  eventName: keyof typeof ONBOARDING_EVENTS,
  data: OnboardingEventData
) {
  // Check if we're in browser environment
  if (typeof window === 'undefined') return

  try {
    // Use PostHog if available (existing analytics setup)
    if (window.posthog) {
      window.posthog.capture(ONBOARDING_EVENTS[eventName], {
        ...data,
        onboarding_version: '1.0.0', // Track implementation version
        library: 'onborda',
      })
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Onboarding Analytics] ${eventName}:`, data)
    }
  } catch (error) {
    console.warn('Failed to track onboarding event:', error)
  }
}

// Helper functions for common onboarding events
export function trackTourStarted(tourName: string, context: OnboardingContext) {
  trackOnboardingEvent('TOUR_STARTED', {
    tourName,
    context: {
      accountMode: context.accountMode,
      hasGeneratedPhotos: context.hasGeneratedPhotos,
      isTeamAdmin: context.isTeamAdmin,
    },
    userId: context.userId,
    timestamp: new Date().toISOString(),
  })
}

export function trackTourCompleted(tourName: string, context: OnboardingContext) {
  trackOnboardingEvent('TOUR_COMPLETED', {
    tourName,
    context: {
      accountMode: context.accountMode,
      hasGeneratedPhotos: context.hasGeneratedPhotos,
      isTeamAdmin: context.isTeamAdmin,
    },
    userId: context.userId,
    timestamp: new Date().toISOString(),
  })
}

export function trackTourSkipped(tourName: string, context: OnboardingContext) {
  trackOnboardingEvent('TOUR_SKIPPED', {
    tourName,
    context: {
      accountMode: context.accountMode,
      hasGeneratedPhotos: context.hasGeneratedPhotos,
      isTeamAdmin: context.isTeamAdmin,
    },
    userId: context.userId,
    timestamp: new Date().toISOString(),
  })
}

export function trackStepViewed(
  tourName: string,
  stepIndex: number,
  totalSteps: number,
  context: OnboardingContext
) {
  trackOnboardingEvent('STEP_VIEWED', {
    tourName,
    stepIndex,
    totalSteps,
    context: {
      accountMode: context.accountMode,
      hasGeneratedPhotos: context.hasGeneratedPhotos,
    },
    userId: context.userId,
    timestamp: new Date().toISOString(),
  })
}

// Privacy and security notes:
// - Onborda is a client-side only library with no server-side data collection
// - All analytics events are sent through existing PostHog integration
// - No additional third-party tracking is introduced
// - User consent for analytics should be handled through existing consent flow
// - No sensitive user data is included in onboarding analytics events
