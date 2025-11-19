export type PlanTier = 'tryOnce' | 'individual' | 'pro' | 'proSmall' | 'proLarge' | null
export type PlanPeriod = 'free' | 'tryOnce' | 'individual' | 'proSmall' | 'proLarge' | null
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'unpaid' | null

/**
 * Simplified tier type for UI purposes (routing, styling)
 * Uses 'free' for free plans
 */
export type UIPlanTier = 'free' | 'tryOnce' | 'individual' | 'proSmall' | 'proLarge'

/**
 * Check if a user is on a free plan based on their period
 * @param period - The subscription period
 * @returns true if the user is on a free plan
 */
export function isFreePlan(period: PlanPeriod | null | undefined): boolean {
  return period === 'free' || !period
}

/**
 * Normalize domain tier and period to simplified UI tier
 * Free users are always 'free' regardless of tier.
 * For transactional pricing, period contains the tier name.
 * @param tier - Domain tier
 * @param period - Plan period (now contains tier for transactional pricing)
 * @returns Simplified UI tier
 */
export function normalizePlanTierForUI(
  tier: PlanTier | string | null,
  period: PlanPeriod | null | undefined
): UIPlanTier {
  // Check period first - free users are always 'free' regardless of tier
  if (isFreePlan(period)) {
    return 'free'
  }
  
  // For transactional pricing, period now contains the tier name
  if (period === 'tryOnce') return 'tryOnce'
  if (period === 'individual') return 'individual'
  if (period === 'proSmall') return 'proSmall'
  if (period === 'proLarge') return 'proLarge'

  // For backward compatibility with old subscription logic
  if (tier === 'pro') return 'proSmall' // Map old 'pro' to 'proSmall'
  if (tier === 'proSmall') return 'proSmall'
  if (tier === 'proLarge') return 'proLarge'
  if (tier === 'individual') return 'individual'
  if (tier === 'try_once') return 'tryOnce'
  
  // Default to free if tier is unknown
  return 'free'
}

export function formatTierName(tier: PlanTier): string {
  if (tier === 'tryOnce') return 'Try Once'
  if (tier === 'individual') return 'Individual'
  if (tier === 'proSmall') return 'Pro Small'
  if (tier === 'proLarge') return 'Pro Large'
  return 'Free'
}

export async function getTierFeatures(tier: PlanTier) {
  const { PRICING_CONFIG } = await import('@/config/pricing') as {
    PRICING_CONFIG: {
      individual: { credits: number }
      proSmall: { credits: number }
      proLarge: { credits: number }
      tryOnce: { credits: number }
      regenerations: { individual: number; proSmall: number; proLarge: number; tryOnce: number }
    }
  }

  if (tier === 'individual') {
    return {
      credits: PRICING_CONFIG.individual.credits,
      regenerations: PRICING_CONFIG.regenerations.individual,
    }
  }
  if (tier === 'proSmall') {
    return {
      credits: PRICING_CONFIG.proSmall.credits,
      regenerations: PRICING_CONFIG.regenerations.proSmall,
    }
  }
  if (tier === 'proLarge') {
    return {
      credits: PRICING_CONFIG.proLarge.credits,
      regenerations: PRICING_CONFIG.regenerations.proLarge,
    }
  }
  if (tier === 'tryOnce') {
    return {
      credits: PRICING_CONFIG.tryOnce.credits,
      regenerations: PRICING_CONFIG.regenerations.tryOnce,
    }
  }
  return {
    credits: 0,
    regenerations: PRICING_CONFIG.regenerations.tryOnce,
  }
}

export function hasActiveSubscription(status: SubscriptionStatus | null): boolean {
  return status === 'active'
}


