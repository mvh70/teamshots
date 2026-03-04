export type PlanTier = 'individual' | 'pro'
export type PlanPeriod = 'free' | 'small' | 'large' | 'seats'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'unpaid' | null

interface FormatSubscriptionLabelOptions {
  freeLabel?: string
  individualLabel?: string
  proLabel?: string
  teamLabel?: string
  proSmallLabel?: string
  proLargeLabel?: string
  vipLabel?: string
  isIndividualDomain?: boolean
}

/**
 * Simplified tier type for UI purposes (routing, styling)
 * Computed from tier+period combination
 */
export type UIPlanTier = 'free' | 'individual' | 'vip' | 'team'

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
 * @param period - Plan period (free, small, large, or seats)
 * @returns Pricing config key or null
 */
export function getPricingConfigKey(
  tier: PlanTier | string | null,
  period: PlanPeriod | string | null | undefined
): 'individual' | 'vip' | null {
  // Handle free plans
  if (isFreePlan(period)) {
    return null
  }

  // Map tier+period combinations to pricing config keys
  if (tier === 'individual' && period === 'small') {
    return 'individual'
  }
  if (tier === 'individual' && period === 'large') {
    return 'vip'
  }

  // Seats-based pricing doesn't use pricing config keys
  if (tier === 'pro' && period === 'seats') {
    return null
  }

  // Backward compatibility: handle legacy period values
  if (period === 'individual') return 'individual'
  if (period === 'vip') return 'vip'

  return null
}

/**
 * Normalize domain tier and period to simplified UI tier
 * @param tier - Domain tier (individual or pro)
 * @param period - Plan period (free, small, large, or seats)
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

  // Handle seats-based pricing (TeamShotsPro)
  if (tier === 'pro' && period === 'seats') {
    return 'team'
  }

  // Map tier+period to UI tier
  const configKey = getPricingConfigKey(tier, period)
  if (configKey === 'individual') return 'individual'
  if (configKey === 'vip') return 'vip'

  // Backward compatibility: handle legacy values
  if (period === 'individual') return 'individual'
  if (period === 'vip') return 'vip'
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
    return 'plan.free'
  }

  if (tier === 'individual' && period === 'small') return 'Individual'
  if (tier === 'individual' && period === 'large') return 'VIP'
  if (tier === 'pro' && period === 'seats') return 'Pro'

  // Backward compatibility
  if (tier === 'individual') return 'Individual'
  if (tier === 'pro') return 'Pro'
  return 'Free'
}

/**
 * Formats a human-readable subscription label for the UI.
 */
export function formatSubscriptionLabel(
  tier: PlanTier | string | null,
  period: PlanPeriod | string | null | undefined,
  options: FormatSubscriptionLabelOptions = {}
): string {
  const {
    freeLabel = 'Free package',
    individualLabel = 'Individual',
    proLabel = 'Pro',
    teamLabel = 'Team',
    proSmallLabel,
    proLargeLabel,
    vipLabel,
    isIndividualDomain = false,
  } = options

  if (isFreePlan(period)) {
    return freeLabel
  }

  if (tier === 'individual' && period === 'small') {
    return individualLabel
  }

  if (tier === 'individual' && period === 'large' && vipLabel) {
    return vipLabel
  }

  if (tier === 'pro' && period === 'small' && proSmallLabel) {
    return proSmallLabel
  }

  if (tier === 'pro' && period === 'large' && proLargeLabel) {
    return proLargeLabel
  }

  if (tier === 'pro' && period === 'seats') {
    return isIndividualDomain ? individualLabel : teamLabel
  }

  if (tier === 'individual') {
    return individualLabel
  }

  if (tier === 'pro') {
    return isIndividualDomain ? individualLabel : proLabel
  }

  return freeLabel
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
      vip: { credits: number }
      regenerations: { individual: number; vip: number; free: number }
      freeTrial: { individual: number; pro: number }
    }
  }

  // Handle free plans
  if (isFreePlan(period)) {
    if (tier === 'pro') {
      return {
        credits: PRICING_CONFIG.freeTrial.pro,
        regenerations: PRICING_CONFIG.regenerations.free,
      }
    }
    return {
      credits: PRICING_CONFIG.freeTrial.individual,
      regenerations: PRICING_CONFIG.regenerations.free,
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

