export type PlanTier = 'individual' | 'pro'
export type PlanPeriod = 'free' | 'small' | 'large'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'unpaid' | null

/**
 * Simplified tier type for UI purposes (routing, styling)
 * Computed from tier+period combination
 */
export type UIPlanTier = 'free' | 'individual' | 'proSmall' | 'proLarge'

/**
 * Check if a user is on a free plan based on their period
 * @param period - The subscription period
 * @returns true if the user is on a free plan
 */
export function isFreePlan(period: PlanPeriod | string | null | undefined): boolean {
  // Legacy periods (tryOnce/try_once) are treated as free for backward compatibility
  return period === 'free' || period === 'tryOnce' || period === 'try_once' || !period
}

/**
 * Map tier+period to pricing config key
 * @param tier - Plan tier (individual or pro)
 * @param period - Plan period (free, small, or large)
 * @returns Pricing config key or null
 */
export function getPricingConfigKey(
  tier: PlanTier | string | null,
  period: PlanPeriod | string | null | undefined
): 'individual' | 'proSmall' | 'proLarge' | null {
  // Handle free plans
  if (isFreePlan(period)) {
    return null
  }

  // Map tier+period combinations to pricing config keys
  if (tier === 'individual' && period === 'small') {
    return 'individual'
  }
  if (tier === 'pro' && period === 'small') {
    return 'proSmall'
  }
  if (tier === 'pro' && period === 'large') {
    return 'proLarge'
  }

  // Backward compatibility: handle legacy period values
  if (period === 'individual') return 'individual'
  if (period === 'proSmall') return 'proSmall'
  if (period === 'proLarge') return 'proLarge'

  // Backward compatibility: handle legacy tier values
  if (tier === 'proSmall') return 'proSmall'
  if (tier === 'proLarge') return 'proLarge'

  return null
}

/**
 * Normalize domain tier and period to simplified UI tier
 * @param tier - Domain tier (individual or pro)
 * @param period - Plan period (free, small, or large)
 * @returns Simplified UI tier
 */
export function normalizePlanTierForUI(
  tier: PlanTier | string | null,
  period: PlanPeriod | string | null | undefined
): UIPlanTier {
  // Check period first - free users are always 'free' regardless of tier
  if (isFreePlan(period)) {
    return 'free'
  }

  // Map tier+period to UI tier
  const configKey = getPricingConfigKey(tier, period)
  if (configKey === 'individual') return 'individual'
  if (configKey === 'proSmall') return 'proSmall'
  if (configKey === 'proLarge') return 'proLarge'

  // Backward compatibility: handle legacy values
  if (period === 'individual') return 'individual'
  if (period === 'proSmall') return 'proSmall'
  if (period === 'proLarge') return 'proLarge'
  if (tier === 'pro') return 'proSmall'
  if (tier === 'proSmall') return 'proSmall'
  if (tier === 'proLarge') return 'proLarge'
  if (tier === 'individual') return 'individual'

  // Default to free if tier is unknown
  return 'free'
}

/**
 * Format tier name for display
 * @param tier - Plan tier
 * @param period - Plan period (optional, for more specific naming)
 * @returns Formatted tier name
 */
export function formatTierName(tier: PlanTier, period?: PlanPeriod | null): string {
  if (isFreePlan(period)) {
    if (tier === 'pro') return 'Pro Free'
    return 'Individual Free'
  }

  if (tier === 'individual' && period === 'small') return 'Individual'
  if (tier === 'pro' && period === 'small') return 'Pro Small'
  if (tier === 'pro' && period === 'large') return 'Pro Large'

  // Backward compatibility
  if (tier === 'individual') return 'Individual'
  if (tier === 'pro') return 'Pro'
  return 'Free'
}

/**
 * Get tier features (credits and regenerations) for a tier+period combination
 * @param tier - Plan tier
 * @param period - Plan period
 * @returns Object with credits and regenerations
 */
export async function getTierFeatures(tier: PlanTier, period: PlanPeriod | null | undefined) {
  const { PRICING_CONFIG } = await import('@/config/pricing') as {
    PRICING_CONFIG: {
      individual: { credits: number }
      proSmall: { credits: number }
      proLarge: { credits: number }
      regenerations: { individual: number; proSmall: number; proLarge: number; tryItForFree: number }
      freeTrial: { individual: number; pro: number }
    }
  }

  // Handle free plans
  if (isFreePlan(period)) {
    if (tier === 'pro') {
      return {
        credits: PRICING_CONFIG.freeTrial.pro,
        regenerations: PRICING_CONFIG.regenerations.tryItForFree,
      }
    }
    return {
      credits: PRICING_CONFIG.freeTrial.individual,
      regenerations: PRICING_CONFIG.regenerations.tryItForFree,
    }
  }

  // Map tier+period to pricing config
  const configKey = getPricingConfigKey(tier, period)
  if (configKey === 'individual') {
    return {
      credits: PRICING_CONFIG.individual.credits,
      regenerations: PRICING_CONFIG.regenerations.individual,
    }
  }
  if (configKey === 'proSmall') {
    return {
      credits: PRICING_CONFIG.proSmall.credits,
      regenerations: PRICING_CONFIG.regenerations.proSmall,
    }
  }
  if (configKey === 'proLarge') {
    return {
      credits: PRICING_CONFIG.proLarge.credits,
      regenerations: PRICING_CONFIG.regenerations.proLarge,
    }
  }

  // Backward compatibility: handle legacy tier values
  if (tier === 'individual') {
    return {
      credits: PRICING_CONFIG.individual.credits,
      regenerations: PRICING_CONFIG.regenerations.individual,
    }
  }

  // Default to individual for unknown tiers
  return {
    credits: PRICING_CONFIG.individual.credits,
    regenerations: PRICING_CONFIG.regenerations.individual,
  }
}

export function hasActiveSubscription(status: SubscriptionStatus | null): boolean {
  return status === 'active'
}


