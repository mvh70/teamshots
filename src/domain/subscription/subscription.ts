import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { PRICING_CONFIG } from '@/config/pricing'
import { getUserCreditBalance } from '@/domain/credits/credits'
import type { PlanTier, PlanPeriod, SubscriptionStatus } from '@/domain/subscription/utils'

export interface SubscriptionInfo {
  tier: PlanTier
  status: SubscriptionStatus
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  period: PlanPeriod
  nextRenewal?: Date | null
  nextChange?: {
    action: 'start' | 'change' | 'cancel' | 'schedule'
    planTier: PlanTier
    planPeriod: PlanPeriod
    effectiveDate: Date
  } | null
}

// Add cache at the top of the file, after imports
// OPTIMIZATION: Use Map with automatic cleanup to prevent memory leaks
const subscriptionCache = new Map<string, { data: SubscriptionInfo | null; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute
const MAX_CACHE_SIZE = 1000; // Maximum number of cached entries

/**
 * Clean up old cache entries to prevent memory leaks
 * Removes entries older than CACHE_TTL or if cache exceeds MAX_CACHE_SIZE
 */
function cleanupCache(): void {
  const now = Date.now()
  const entriesToDelete: string[] = []

  // Find entries to delete (too old or if cache is too large)
  for (const [key, value] of subscriptionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      entriesToDelete.push(key)
    }
  }

  // If cache is still too large after removing old entries, remove oldest remaining entries
  if (subscriptionCache.size - entriesToDelete.length > MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(subscriptionCache.entries())
      .filter(([key]) => !entriesToDelete.includes(key))
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
    
    const excessCount = subscriptionCache.size - entriesToDelete.length - MAX_CACHE_SIZE
    for (let i = 0; i < excessCount; i++) {
      entriesToDelete.push(sortedEntries[i][0])
    }
  }

  // Delete entries
  for (const key of entriesToDelete) {
    subscriptionCache.delete(key)
  }
}

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

  // Use planTier as single source of truth - never overwrite it
  // planPeriod indicates size (free, small, large) for transactional pricing
  const storedTierRaw = (user as unknown as { planTier?: string | null }).planTier
  const storedTier: PlanTier = (storedTierRaw === 'pro' || storedTierRaw === 'individual') ? storedTierRaw : 'individual'

  const rawPeriod = (user as unknown as { planPeriod?: string | null }).planPeriod ?? null
  
  // Normalize period: handle legacy values and map to new structure
  const period = ((): PlanPeriod => {
    // Legacy periods that need mapping
    if (rawPeriod === 'month' || rawPeriod === 'monthly') {
      // Legacy monthly - map based on tier
      return 'small'
    }
    if (rawPeriod === 'year' || rawPeriod === 'annual') {
      // Legacy annual - map based on tier
      if (storedTier === 'pro') return 'seats'
      return 'small'
    }
    // Legacy individual period
    if (rawPeriod === 'individual') return 'small'
    // New structure
    if (rawPeriod === 'free' || rawPeriod === 'small' || rawPeriod === 'large' || rawPeriod === 'seats') {
      return rawPeriod as PlanPeriod
    }
    // Default to free
    return 'free'
  })()

  // Compute next renewal date when applicable
  // Note: For one-time purchases and seats-based pricing, there's no recurring billing, so nextRenewal is null
  let nextRenewal: Date | null = null

  const result = {
    tier: storedTier,
    status: user.subscriptionStatus as SubscriptionStatus,
    stripeSubscriptionId: user.stripeSubscriptionId,
    stripeCustomerId: user.stripeCustomerId,
    period,
    nextRenewal,
    nextChange: upcoming
      ? {
          action: upcoming.action,
          planTier: (upcoming.planTier === 'pro' ? 'pro' : 'individual') as PlanTier,
          planPeriod: (upcoming.planPeriod === 'small' || upcoming.planPeriod === 'large' || upcoming.planPeriod === 'seats' ? upcoming.planPeriod : 'free') as PlanPeriod,
          effectiveDate: new Date(upcoming.effectiveDate),
        }
      : null,
  }

  // After computing result
  subscriptionCache.set(userId, { data: result, timestamp: Date.now() });
  
  // Cleanup cache periodically (every 10th call to avoid overhead)
  if (subscriptionCache.size % 10 === 0) {
    cleanupCache();
  }
  
  return result;
}

/**
 * Get credits allocated for a tier+period combination
 * @param tier - Plan tier
 * @param period - Plan period
 * @returns Number of credits
 */
export function getCreditsForTier(tier: PlanTier, period: PlanPeriod | null | undefined): number {
  // Import isFreePlan from utils
  const isFreePlan = (p: PlanPeriod | string | null | undefined): boolean => {
    return p === 'free' || p === 'tryOnce' || p === 'try_once' || !p
  }

  // Handle free plans
  if (isFreePlan(period)) {
    if (tier === 'pro') {
      return PRICING_CONFIG.freeTrial.pro
    }
    return PRICING_CONFIG.freeTrial.individual
  }

  // Map tier+period to credits
  if (tier === 'individual' && period === 'small') {
    return PRICING_CONFIG.individual.credits
  }

  // Legacy pro tier - teams now use seats-based pricing
  if (tier === 'pro') {
    return 0
  }

  // Backward compatibility
  if (tier === 'individual') {
    return PRICING_CONFIG.individual.credits
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
 * @param tier - Plan tier
 * @param period - Plan period (optional)
 * @returns Formatted tier name
 */
export function formatTierName(tier: PlanTier, period?: PlanPeriod | null): string {
  const isFreePlan = (p: PlanPeriod | string | null | undefined): boolean => {
    return p === 'free' || p === 'tryOnce' || p === 'try_once' || !p
  }

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
 * Get subscription features for a tier+period combination
 * @param tier - Plan tier
 * @param period - Plan period
 * @returns Object with credits, regenerations, and topUpPrice
 */
export function getTierFeatures(tier: PlanTier, period: PlanPeriod | null | undefined) {
  const isFreePlan = (p: PlanPeriod | string | null | undefined): boolean => {
    return p === 'free' || p === 'tryOnce' || p === 'try_once' || !p
  }

  // Handle free plans
  if (isFreePlan(period)) {
    if (tier === 'pro') {
      return {
        credits: PRICING_CONFIG.freeTrial.pro,
        regenerations: PRICING_CONFIG.regenerations.tryItForFree,
        topUpPrice: 0,
      }
    }
    return {
      credits: PRICING_CONFIG.freeTrial.individual,
      regenerations: PRICING_CONFIG.regenerations.tryItForFree,
      topUpPrice: 0,
    }
  }

  // Map tier+period to features
  if (tier === 'individual' && period === 'small') {
    return {
      credits: PRICING_CONFIG.individual.credits,
      regenerations: PRICING_CONFIG.regenerations.individual,
      topUpPrice: PRICING_CONFIG.individual.topUp.price,
    }
  }

  // Legacy pro tier - teams now use seats-based pricing
  // Return zero credits as they should be using the seats model
  if (tier === 'pro') {
    return {
      credits: 0,
      regenerations: PRICING_CONFIG.regenerations.tryItForFree,
      topUpPrice: 0,
    }
  }

  // Backward compatibility
  if (tier === 'individual') {
    return {
      credits: PRICING_CONFIG.individual.credits,
      regenerations: PRICING_CONFIG.regenerations.individual,
      topUpPrice: PRICING_CONFIG.individual.topUp.price,
    }
  }

  return {
    credits: 0,
    regenerations: PRICING_CONFIG.regenerations.tryItForFree,
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


