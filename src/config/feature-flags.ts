/**
 * Feature Flags Configuration
 *
 * Central configuration for feature flags to enable/disable features
 * across the application without code deployments.
 */

export const FEATURE_FLAGS = {
  /**
   * Outfit Transfer Feature
   * Controls whether users can access the outfit1 package and upload outfit images
   */
  outfitTransfer: {
    enabled: process.env.NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER === 'true',
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
