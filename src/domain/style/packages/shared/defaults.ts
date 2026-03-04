/**
 * Shared clothing color fallbacks for cases where user settings are partial.
 * Keep this in sync between client-side customization UI and server payload hydration.
 */
export const DEFAULT_CLOTHING_COLOR_FALLBACKS = {
  topLayer: '#2C3E50',
  baseLayer: '#F8F9FA',
  bottom: '#1A1A2E',
  shoes: '#2D2D2D',
} as const
