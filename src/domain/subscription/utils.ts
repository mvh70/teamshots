export type PlanTier = 'individual' | 'pro' | 'try_once' | null
export type PlanPeriod = 'free' | 'try_once' | 'monthly' | 'annual' | null
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'unpaid' | null

/**
 * Simplified tier type for UI purposes (routing, styling)
 * Maps try_once to 'individual' and uses 'free' for free plans
 */
export type UIPlanTier = 'free' | 'individual' | 'pro'

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
 * Try-once is treated as 'individual' for UI purposes.
 * @param tier - Domain tier ('individual' | 'pro' | 'try_once' | null)
 * @param period - Subscription period
 * @returns Simplified UI tier ('free' | 'individual' | 'pro')
 */
export function normalizePlanTierForUI(
  tier: PlanTier | string | null,
  period: PlanPeriod | null | undefined
): UIPlanTier {
  // Check period first - free users are always 'free' regardless of tier
  if (isFreePlan(period)) {
    return 'free'
  }
  
  // For non-free plans, determine tier
  if (tier === 'pro') {
    return 'pro'
  }
  if (tier === 'individual' || tier === 'try_once') {
    return 'individual' // style try-once like individual
  }
  
  // Default to free if tier is unknown
  return 'free'
}

export function formatTierName(tier: PlanTier): string {
  if (tier === 'individual') return 'Starter'
  if (tier === 'pro') return 'Pro'
  if (tier === 'try_once') return 'Try Once'
  return 'Free'
}

export async function getTierFeatures(tier: PlanTier) {
  const { PRICING_CONFIG } = await import('@/config/pricing') as {
    PRICING_CONFIG: {
      individual: { includedCredits: number }
      pro: { includedCredits: number }
      tryOnce: { credits: number }
      regenerations: { personal: number; business: number; tryOnce: number }
    }
  }

  if (tier === 'individual') {
    return {
      credits: PRICING_CONFIG.individual.includedCredits,
      regenerations: PRICING_CONFIG.regenerations.personal,
    }
  }
  if (tier === 'pro') {
    return {
      credits: PRICING_CONFIG.pro.includedCredits,
      regenerations: PRICING_CONFIG.regenerations.business,
    }
  }
  if (tier === 'try_once') {
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


