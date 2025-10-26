import { prisma } from '@/lib/prisma';
import { PRICING_CONFIG } from '@/config/pricing';
import { getUserCreditBalance } from '@/lib/credits';

export type SubscriptionTier = 'individual' | 'pro' | 'try_once' | null;
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'unpaid' | null;

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}

/**
 * Get subscription information for a user
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionInfo | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
    },
  });

  if (!user) return null;

  return {
    tier: user.subscriptionTier as SubscriptionTier,
    status: user.subscriptionStatus as SubscriptionStatus,
    stripeSubscriptionId: user.stripeSubscriptionId,
    stripeCustomerId: user.stripeCustomerId,
  };
}

/**
 * Get credits allocated for a subscription tier
 */
export function getCreditsForTier(tier: SubscriptionTier): number {
  if (tier === 'individual') {
    return PRICING_CONFIG.individual.includedCredits;
  } else if (tier === 'pro') {
    return PRICING_CONFIG.pro.includedCredits;
  } else if (tier === 'try_once') {
    return PRICING_CONFIG.tryOnce.credits;
  }
  return 0;
}

/**
 * Check if user has an active subscription
 */
export function hasActiveSubscription(status: SubscriptionStatus | null): boolean {
  return status === 'active';
}

/**
 * Check if user has access to a specific tier or better
 */
export function hasTierAccess(
  userTier: SubscriptionTier,
  requiredTier: SubscriptionTier
): boolean {
  if (!requiredTier) return true; // No tier requirement
  if (!userTier) return false; // User has no tier

  const tierLevels: Record<string, number> = {
    try_once: 0,
    individual: 1,
    pro: 2,
  };

  return tierLevels[userTier] >= tierLevels[requiredTier];
}

/**
 * Get the next billing date for a subscription
 * Note: This would need to be retrieved from Stripe API in production
 */
export function getNextBillingDate(stripeSubscriptionId: string | null): Date | null {
  // In production, you would fetch this from Stripe API
  if (!stripeSubscriptionId) return null;
  // Placeholder - would need to integrate with Stripe to get actual billing cycle
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
}

/**
 * Check if subscription is past due
 */
export function isSubscriptionPastDue(status: SubscriptionStatus | null): boolean {
  return status === 'past_due' || status === 'unpaid';
}

/**
 * Get formatted subscription tier name
 */
export function formatTierName(tier: SubscriptionTier): string {
  if (tier === 'individual') return 'Starter';
  if (tier === 'pro') return 'Pro';
  if (tier === 'try_once') return 'Try Once';
  return 'Free';
}

/**
 * Get subscription features for a tier
 */
export function getTierFeatures(tier: SubscriptionTier) {
  if (tier === 'individual') {
    return {
      credits: PRICING_CONFIG.individual.includedCredits,
      regenerations: PRICING_CONFIG.regenerations.personal,
      topUpPrice: PRICING_CONFIG.individual.topUp.pricePerPackage,
    };
  } else if (tier === 'pro') {
    return {
      credits: PRICING_CONFIG.pro.includedCredits,
      regenerations: PRICING_CONFIG.regenerations.business,
      topUpPrice: PRICING_CONFIG.pro.topUp.pricePerPackage,
    };
  } else if (tier === 'try_once') {
    return {
      credits: PRICING_CONFIG.tryOnce.credits,
      regenerations: PRICING_CONFIG.regenerations.tryOnce,
      topUpPrice: 0,
    };
  }
  return {
    credits: 0,
    regenerations: PRICING_CONFIG.regenerations.tryOnce,
    topUpPrice: 0,
  };
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
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
    },
  });

  if (!user) return false;

  // Get user's actual credit balance from transactions
  const creditBalance = await getUserCreditBalance(userId);
  
  // Check if user has sufficient credits
  if (creditBalance >= requiredCredits) return true;

  // Check if user has active subscription
  if (hasActiveSubscription(user.subscriptionStatus as SubscriptionStatus)) {
    // Users with active subscriptions can create generations even if they have 0 credits
    // Credits will be deducted upon generation
    return true;
  }

  return false;
}
