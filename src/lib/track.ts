import { posthog } from '@/lib/posthog'

/**
 * Track a custom event in PostHog and GTM (for GA4)
 * Use this for funnel analysis and understanding user behavior
 */
export const track = (event: string, properties?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return

  // PostHog
  if (posthog.__loaded) {
    posthog.capture(event, properties)
  }

  // GTM dataLayer for GA4
  if (window.dataLayer) {
    window.dataLayer.push({
      event,
      ...properties,
    })
  }
}

// ============================================
// FUNNEL EVENTS - Core user journey tracking
// ============================================

// Signup funnel
export const trackSignupStarted = (method: 'email' | 'magic_link' = 'email') => {
  track('signup_started', { method })
}

export const trackSignupCompleted = (userId: string, method: 'email' | 'magic_link' = 'email') => {
  track('signup_completed', { user_id: userId, method })
}

export const trackLoginCompleted = (userId: string, method: 'email' | 'magic_link' | 'otp' = 'email') => {
  track('login_completed', { user_id: userId, method })
}

// Generation funnel
export const trackGenerationStarted = (properties?: {
  selfie_count?: number
  style_preset?: string
  is_team_generation?: boolean
}) => {
  track('generation_started', properties)
}

export const trackGenerationCompleted = (properties?: {
  generation_id?: string
  photo_count?: number
  duration_seconds?: number
  is_team_generation?: boolean
}) => {
  track('generation_completed', properties)
}

export const trackGenerationFailed = (properties?: {
  generation_id?: string
  error_type?: string
  error_message?: string
}) => {
  track('generation_failed', properties)
}

// Selfie funnel
export const trackSelfieUploaded = (properties?: {
  selfie_count?: number
  file_size_kb?: number
  is_replacement?: boolean
}) => {
  track('selfie_uploaded', properties)
}

export const trackSelfieDeleted = () => {
  track('selfie_deleted')
}

// Customization tracking
export const trackCustomizationChanged = (properties: {
  category: string
  old_value?: string
  new_value?: string
}) => {
  track('customization_changed', properties)
}

export const trackStylePresetSelected = (preset: string) => {
  track('style_preset_selected', { preset })
}

// Photo actions
export const trackPhotoDownloaded = (properties?: {
  generation_id?: string
  photo_index?: number
  format?: string
}) => {
  track('photo_downloaded', properties)
}

export const trackPhotoShared = (properties?: {
  generation_id?: string
  share_method?: string
}) => {
  track('photo_shared', properties)
}

export const trackRegenerateClicked = (properties?: {
  generation_id?: string
  reason?: string
}) => {
  track('regenerate_clicked', properties)
}

// Team funnel
export const trackTeamCreated = (properties?: {
  team_id?: string
  team_size?: number
}) => {
  track('team_created', properties)
}

export const trackTeamMemberInvited = (properties?: {
  team_id?: string
  invite_method?: 'email' | 'link'
}) => {
  track('team_member_invited', properties)
}

export const trackInviteLinkViewed = (properties?: {
  team_name?: string
  inviter_name?: string
}) => {
  track('invite_link_viewed', properties)
}

export const trackTeamInviteAccepted = (properties?: {
  team_id?: string
  team_name?: string
}) => {
  track('team_invite_accepted', properties)
}

export const trackInvitedMemberGenerationStarted = (properties?: {
  team_name?: string
  selfie_count?: number
}) => {
  track('invited_member_generation_started', properties)
}

// Payment funnel
export const trackCheckoutStarted = (properties?: {
  plan_tier?: string
  plan_period?: string
  seat_count?: number
  amount?: number
}) => {
  track('checkout_started', properties)
}

export const trackPaymentCompleted = (properties?: {
  transaction_id?: string
  plan_tier?: string
  plan_period?: string
  seat_count?: number
  amount?: number
  currency?: string
}) => {
  track('payment_completed', properties)
}

export const trackPaymentFailed = (properties?: {
  error_type?: string
  plan_tier?: string
}) => {
  track('payment_failed', properties)
}

// Onboarding/UX tracking
export const trackIntroSkipped = (intro_type: 'selfie_tips' | 'customization_intro') => {
  track('intro_skipped', { intro_type })
}

export const trackOnboardingStepCompleted = (step: string, step_number: number) => {
  track('onboarding_step_completed', { step, step_number })
}

// Engagement tracking
export const trackFeatureUsed = (feature: string, properties?: Record<string, unknown>) => {
  track('feature_used', { feature, ...properties })
}

export const trackErrorDisplayed = (properties: {
  error_type: string
  error_message?: string
  page?: string
}) => {
  track('error_displayed', properties)
}
