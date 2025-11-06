import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { PRICING_CONFIG } from '@/config/pricing'
import { getUserCreditBalance } from '@/domain/credits/credits'

export type PlanTier = 'individual' | 'pro' | 'try_once' | null
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'unpaid' | null
export type PlanPeriod = 'free' | 'try_once' | 'monthly' | 'annual' | null

export interface SubscriptionInfo {
  tier: PlanTier
  status: SubscriptionStatus
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  period?: PlanPeriod
  nextRenewal?: Date | null
  nextChange?: {
    action: 'start' | 'change' | 'cancel' | 'schedule'
    planTier: Exclude<PlanTier, null>
    planPeriod: Exclude<PlanPeriod, null>
    effectiveDate: Date
  } | null
}

// Add cache at the top of the file, after imports
const subscriptionCache = new Map<string, { data: SubscriptionInfo | null; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Get subscription information for a user
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionInfo | null> {
  const cached = subscriptionCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    Logger.debug('subscription.cache.hit', { userId });
    return cached.data;
  }

  // OPTIMIZATION: Run all queries in parallel
  // User query and subscriptionChange queries are independent and can execute simultaneously
  const subscriptionChangeClient = prisma as unknown as { subscriptionChange: { findFirst: (args: unknown) => Promise<unknown> } }
  const [user, upcoming, latestEffective] = await Promise.all([
    // Fetch user data
    prisma.user.findUnique({
      where: { id: userId },
    }),
    // Find upcoming change (effective in the future)
    subscriptionChangeClient.subscriptionChange.findFirst({
      where: {
        userId,
        effectiveDate: { gt: new Date() },
      },
      orderBy: { effectiveDate: 'asc' },
    }) as Promise<{ action: 'start'|'change'|'cancel'|'schedule'; planTier: string; planPeriod: string; effectiveDate: Date } | null>,
    // Find latest effective change (in the past) - prepare query but conditionally use result
    subscriptionChangeClient.subscriptionChange.findFirst({
      where: {
        userId,
        effectiveDate: { lte: new Date() },
        action: { in: ['start', 'change'] },
      },
      orderBy: { effectiveDate: 'desc' },
    }) as Promise<{ effectiveDate?: Date } | null>
  ])

  if (!user) return null

  // Derive effective tier: a try_once purchase is represented as planPeriod 'try_once'
  // even though planTier may remain 'individual'. Surface 'try_once' in API to drive UI correctly.
  const storedTier = (user as unknown as { planTier?: PlanTier }).planTier ?? null
  const rawPeriod = (user as unknown as { planPeriod?: string | null }).planPeriod ?? null
  const period = ((): PlanPeriod => {
    if (rawPeriod === 'month') return 'monthly'
    if (rawPeriod === 'year') return 'annual'
    return (rawPeriod as PlanPeriod) ?? null
  })()
  Logger.info('subscription.period.normalized', { userId, rawPeriod, period })
  const effectiveTier: PlanTier = period === 'try_once' ? 'try_once' : storedTier

  // Compute next renewal date when applicable
  let nextRenewal: Date | null = null
  if (user.subscriptionStatus === 'active' && (period === 'monthly' || period === 'annual')) {
    // Use the latestEffective result from parallel query (already fetched above)
    if (latestEffective?.effectiveDate) {
      const base = new Date(latestEffective.effectiveDate)
      if (period === 'monthly') {
        nextRenewal = new Date(base)
        nextRenewal.setMonth(nextRenewal.getMonth() + 1)
      } else if (period === 'annual') {
        nextRenewal = new Date(base)
        nextRenewal.setFullYear(nextRenewal.getFullYear() + 1)
      }
      Logger.info('subscription.nextRenewal.computed', {
        userId,
        base: base.toISOString(),
        period,
        nextRenewal: nextRenewal?.toISOString?.() ?? null,
      })
    } else {
      Logger.info('subscription.latestEffective.missing', { userId })
    }
  }

  const result = {
    tier: effectiveTier,
    status: user.subscriptionStatus as SubscriptionStatus,
    stripeSubscriptionId: user.stripeSubscriptionId,
    stripeCustomerId: user.stripeCustomerId,
    period,
    nextRenewal,
    nextChange: upcoming
      ? {
          action: upcoming.action,
          planTier: upcoming.planTier as Exclude<PlanTier, null>,
          planPeriod: upcoming.planPeriod as Exclude<PlanPeriod, null>,
          effectiveDate: new Date(upcoming.effectiveDate),
        }
      : null,
  }

  // After computing result
  subscriptionCache.set(userId, { data: result, timestamp: Date.now() });
  return result;
}

/**
 * Get credits allocated for a subscription tier
 */
export function getCreditsForTier(tier: PlanTier): number {
  if (tier === 'individual') {
    return PRICING_CONFIG.individual.includedCredits
  } else if (tier === 'pro') {
    return PRICING_CONFIG.pro.includedCredits
  } else if (tier === 'try_once') {
    return PRICING_CONFIG.tryOnce.credits
  }
  return 0
}

/**
 * Check if user has an active subscription
 */
export function hasActiveSubscription(status: SubscriptionStatus | null): boolean {
  return status === 'active'
}

/**
 * Check if user has access to a specific tier or better
 */
export function hasTierAccess(
  userTier: PlanTier,
  requiredTier: PlanTier
): boolean {
  if (!requiredTier) return true // No tier requirement
  if (!userTier) return false // User has no tier

  const tierLevels: Record<string, number> = {
    try_once: 0,
    individual: 1,
    pro: 2,
  }

  return tierLevels[userTier] >= tierLevels[requiredTier]
}

/**
 * Get the next billing date for a subscription
 * Note: This would need to be retrieved from Stripe API in production
 */
export function getNextBillingDate(stripeSubscriptionId: string | null): Date | null {
  if (!stripeSubscriptionId) return null
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
}

/**
 * Check if subscription is past due
 */
export function isSubscriptionPastDue(status: SubscriptionStatus | null): boolean {
  return status === 'past_due' || status === 'unpaid'
}

/**
 * Get formatted subscription tier name
 */
export function formatTierName(tier: PlanTier): string {
  if (tier === 'individual') return 'Starter'
  if (tier === 'pro') return 'Pro'
  if (tier === 'try_once') return 'Try Once'
  return 'Free'
}

/**
 * Get subscription features for a tier
 */
export function getTierFeatures(tier: PlanTier) {
  if (tier === 'individual') {
    return {
      credits: PRICING_CONFIG.individual.includedCredits,
      regenerations: PRICING_CONFIG.regenerations.personal,
      topUpPrice: PRICING_CONFIG.individual.topUp.price,
    }
  } else if (tier === 'pro') {
    return {
      credits: PRICING_CONFIG.pro.includedCredits,
      regenerations: PRICING_CONFIG.regenerations.business,
      topUpPrice: PRICING_CONFIG.pro.topUp.price,
    }
  } else if (tier === 'try_once') {
    return {
      credits: PRICING_CONFIG.tryOnce.credits,
      regenerations: PRICING_CONFIG.regenerations.tryOnce,
      topUpPrice: 0,
    }
  }
  return {
    credits: 0,
    regenerations: PRICING_CONFIG.regenerations.tryOnce,
    topUpPrice: 0,
  }
}

/**
 * Check if user can create generations (has credits or active subscription)
 */
export async function canCreateGeneration(
  userId: string,
  requiredCredits: number = PRICING_CONFIG.credits.perGeneration
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) return false

  const creditBalance = await getUserCreditBalance(userId)
  if (creditBalance >= requiredCredits) return true

  if (hasActiveSubscription(user.subscriptionStatus as SubscriptionStatus)) {
    return true
  }

  return false
}


