/**
 * Feature Flags Configuration
 *
 * Central configuration for feature flags to enable/disable features
 * across the application without code deployments.
 *
 * NOTE: All legacy feature flags have been removed. The following features
 * are now permanently enabled:
 * - V3 Workflow (4-step generation)
 * - Element Composition System
 * - Outfit Transfer
 */

export const FEATURE_FLAGS = {
  v3CanonicalPromptSinglePass: 'v3CanonicalPromptSinglePass',
} as const

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS

/**
 * Check if a feature is enabled
 * @deprecated All features are now permanently enabled. This function always returns true for backward compatibility.
 */
export function isFeatureEnabled(flag: string): boolean {
  if (flag === 'v3CanonicalPromptSinglePass') {
    const envValue = process.env.V3_CANONICAL_PROMPT_SINGLE_PASS
    if (typeof envValue === 'string') {
      return envValue.trim().toLowerCase() === 'true'
    }
    return process.env.NODE_ENV !== 'production'
  }
  return true
}

/**
 * Get feature flag metadata
 * @deprecated All features are now permanently enabled. This function is kept for backward compatibility.
 */
export function getFeatureFlag(flag: never) {
  return undefined
}
