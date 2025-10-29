export type SubscriptionTier = 'individual' | 'pro' | 'try_once' | null
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'unpaid' | null

export function formatTierName(tier: SubscriptionTier): string {
  if (tier === 'individual') return 'Starter'
  if (tier === 'pro') return 'Pro'
  if (tier === 'try_once') return 'Try Once'
  return 'Free'
}

export async function getTierFeatures(tier: SubscriptionTier) {
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


