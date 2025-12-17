/**
 * Feature Flags Configuration
 *
 * Central configuration for feature flags to enable/disable features
 * across the application without code deployments.
 *
 * NOTE: We use runtime checks for server-side and build-time for client-side.
 * This allows toggling features without rebuilds on the server.
 */

// Helper to check if we're on the server
const isServer = typeof window === 'undefined'

/**
 * Get outfit transfer feature flag (runtime on server, build-time on client)
 */
function getOutfitTransferEnabled(): boolean {
  if (isServer) {
    // Server-side: Check both NEXT_PUBLIC and regular env var (runtime)
    return process.env.FEATURE_OUTFIT_TRANSFER === 'true' ||
           process.env.NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER === 'true'
  }
  // Client-side: Build-time check
  return process.env.NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER === 'true'
}

export const FEATURE_FLAGS = {
  /**
   * Outfit Transfer Feature
   * Controls whether users can access the outfit1 package and upload outfit images
   */
  outfitTransfer: {
    get enabled() {
      return getOutfitTransferEnabled()
    },
    description: 'Enable outfit transfer feature for generating headshots with custom clothing',
  },

  /**
   * V3 Workflow
   * Controls whether to use the new V3 4-step workflow
   */
  v3Workflow: {
    enabled: process.env.NEXT_PUBLIC_FEATURE_V3_WORKFLOW !== 'false', // Enabled by default
    description: 'Enable V3 4-step generation workflow',
  },

  /**
   * Element Composition System
   * Controls whether to use the new element-level prompt composition system
   * When enabled, prompts are built by composing contributions from independent elements
   * instead of monolithic package-level prompt building
   */
  elementComposition: {
    enabled: process.env.FEATURE_ELEMENT_COMPOSITION === 'true', // Disabled by default
    description: 'Enable element-level prompt composition system for modular, phase-aware prompt building',
  },
} as const

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[flag].enabled
}

/**
 * Get feature flag metadata
 */
export function getFeatureFlag(flag: FeatureFlagKey) {
  return FEATURE_FLAGS[flag]
}
