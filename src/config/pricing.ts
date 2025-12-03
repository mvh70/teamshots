// Define Stripe Price IDs per environment (test vs production)
const TEST_STRIPE_PRICE_IDS = {
  INDIVIDUAL: "price_1SVDRqENr8odIuXaUsejcC0Y",
  PRO_SMALL: "price_1SVDRrENr8odIuXam20q1Y0H",
  PRO_LARGE: "price_1SVDRsENr8odIuXaI58rONjp",
  VIP: "", // VIP anchor tier for individual domain - contact sales (no Stripe checkout)
  ENTERPRISE: "", // Enterprise anchor tier for team domain - contact sales (no Stripe checkout)
  INDIVIDUAL_TOP_UP: "price_1SVDRsENr8odIuXauWVusJRu",
  PRO_SMALL_TOP_UP: "price_1SVDRtENr8odIuXa51JORKHM",
  PRO_LARGE_TOP_UP: "price_1SVDRtENr8odIuXasuxkKPYU",
} as const;

const PROD_STRIPE_PRICE_IDS = {
  INDIVIDUAL: "price_1SVEzhENr8odIuXaRD0LmWRv",
  PRO_SMALL: "price_1SVEziENr8odIuXagC8KXdWm",
  PRO_LARGE: "price_1SVEzjENr8odIuXasqgEm3hL",
  VIP: "", // VIP anchor tier for individual domain - contact sales (no Stripe checkout)
  ENTERPRISE: "", // Enterprise anchor tier for team domain - contact sales (no Stripe checkout)
  INDIVIDUAL_TOP_UP: "price_1SVEzjENr8odIuXasgnzDlZv",
  PRO_SMALL_TOP_UP: "price_1SVEzkENr8odIuXaSbNmfuHf",
  PRO_LARGE_TOP_UP: "price_1SVEzlENr8odIuXaIBqDLcGj",
} as const;

const IS_PRODUCTION =
  process.env.NEXT_PUBLIC_APP_ENV === 'production' ||
  process.env.NODE_ENV === 'production';

type StripePriceIds = {
  readonly INDIVIDUAL: string;
  readonly PRO_SMALL: string;
  readonly PRO_LARGE: string;
  readonly VIP: string;
  readonly ENTERPRISE: string;
  readonly INDIVIDUAL_TOP_UP: string;
  readonly PRO_SMALL_TOP_UP: string;
  readonly PRO_LARGE_TOP_UP: string;
};
const STRIPE_PRICE_IDS: StripePriceIds = IS_PRODUCTION ? PROD_STRIPE_PRICE_IDS : TEST_STRIPE_PRICE_IDS;

export const PRICING_CONFIG = {
  // Credits system
  credits: {
    perGeneration: 10,
    rollover: true,
    rolloverLimit: null, // unlimited rollover
  },

  // Regeneration system
  regenerations: {
    tryItForFree: 1,
    individual: 1,
    proSmall: 1,
    proLarge: 2,
    vip: 3, // VIP gets most retries
    enterprise: 3, // Enterprise gets most retries
  },

  // Try It For Free (free tier - grants credits on signup)
  tryItForFree: {
    credits: 10, // Credits granted on signup
  },

  // Individual tier (Personal - one-time purchase)
  individual: {
    price: 19.99,
    credits: 40, // 5 photos at 10 credits each
    stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL || '',
    topUp: {
      price: 19.99,
      credits: 30,
      stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL_TOP_UP || '',
    },
  },

  // VIP tier (Individual domain anchor - contact sales, high price for anchoring effect)
  vip: {
    price: 199.99,
    credits: 300, // 60 photos at 10 credits each
    maxTeamMembers: null, // unlimited
    stripePriceId: STRIPE_PRICE_IDS.VIP || '', // Contact sales - no direct checkout
    isContactSales: true, // Flag to show "Contact Sales" instead of checkout
  },

  // Pro Small tier (Business - up to 5 team members - one-time purchase)
  proSmall: {
    price: 19.99,
    credits: 40, // 5 photos at 10 credits each
    maxTeamMembers: 5,
    stripePriceId: STRIPE_PRICE_IDS.PRO_SMALL || '',
    topUp: {
      price: 22.49,
      credits: 50,
      stripePriceId: STRIPE_PRICE_IDS.PRO_SMALL_TOP_UP || '',
    },
  },

  // Pro Large tier (Business - more than 5 team members - one-time purchase)
  proLarge: {
    price: 59.99,
    credits: 100, // 20 photos at 10 credits each
    maxTeamMembers: null, // unlimited
    stripePriceId: STRIPE_PRICE_IDS.PRO_LARGE || '',
    topUp: {
      price: 36.99,
      credits: 70, // 10 photos at 10 credits each
      stripePriceId: STRIPE_PRICE_IDS.PRO_LARGE_TOP_UP || '',
    },
  },



  // Enterprise tier (Team domain anchor - contact sales, high price for anchoring effect)
  enterprise: {
    price: 399.99,
    credits: 600, // 60 photos at 10 credits each
    maxTeamMembers: null, // unlimited
    stripePriceId: STRIPE_PRICE_IDS.ENTERPRISE || '', // Contact sales - no direct checkout
    isContactSales: true, // Flag to show "Contact Sales" instead of checkout
  },

  // Cost tracking
  costs: {
    geminiApiPerGeneration: 0.10, // Estimated cost per generation
  },

  // Team settings
  team: {
    defaultInviteCredits: 10,
  },

  // Free trial credits (granted on signup)
  freeTrial: {
    individual: 10,  // Credits for individual users on free plan
    pro: 30,         // Credits for pro users (teams) on free plan
  },
} as const;

// Pricing tier type (maps to pricing config keys)
export type PricingTier = 'tryItForFree' | 'individual' | 'proSmall' | 'proLarge' | 'vip' | 'enterprise';

// Import types from subscription utils
import type { PlanTier, PlanPeriod } from '@/domain/subscription/utils'

/**
 * Map tier+period combination to pricing config key
 * @param tier - Plan tier (individual or pro)
 * @param period - Plan period (free, small, or large)
 * @returns Pricing config key or null for free plans
 */
export function getPricingConfigKey(
  tier: PlanTier | string | null,
  period: PlanPeriod | string | null | undefined
): 'individual' | 'proSmall' | 'proLarge' | null {
  // Free plans don't map to a pricing config key
  if (!period || period === 'free' || period === 'tryOnce' || period === 'try_once') {
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
 * Get PricingTier from tier+period combination
 * @param tier - Plan tier
 * @param period - Plan period
 * @returns PricingTier for use with pricing config
 */
export function getPricingTier(
  tier: PlanTier | string | null,
  period: PlanPeriod | string | null | undefined
): PricingTier {
  const configKey = getPricingConfigKey(tier, period)
  if (configKey === 'individual') return 'individual'
  if (configKey === 'proSmall') return 'proSmall'
  if (configKey === 'proLarge') return 'proLarge'
  return 'tryItForFree'
}

/**
 * Get credits for a tier+period combination
 * @param tier - Plan tier
 * @param period - Plan period
 * @returns Number of credits
 */
export function getCreditsForPlan(
  tier: PlanTier | string | null,
  period: PlanPeriod | string | null | undefined
): number {
  // Handle free plans
  if (!period || period === 'free' || period === 'tryOnce' || period === 'try_once') {
    if (tier === 'pro') {
      return PRICING_CONFIG.freeTrial.pro
    }
    return PRICING_CONFIG.freeTrial.individual
  }

  // Map tier+period to credits
  const configKey = getPricingConfigKey(tier, period)
  if (configKey === 'individual') return PRICING_CONFIG.individual.credits
  if (configKey === 'proSmall') return PRICING_CONFIG.proSmall.credits
  if (configKey === 'proLarge') return PRICING_CONFIG.proLarge.credits

  return 0
}

/**
 * Get regenerations for a tier+period combination
 * @param tier - Plan tier
 * @param period - Plan period
 * @returns Number of regenerations
 */
export function getRegenerationsForPlan(
  tier: PlanTier | string | null,
  period: PlanPeriod | string | null | undefined
): number {
  // Handle free plans
  if (!period || period === 'free' || period === 'tryOnce' || period === 'try_once') {
    return PRICING_CONFIG.regenerations.tryItForFree
  }

  // Map tier+period to regenerations
  const configKey = getPricingConfigKey(tier, period)
  if (configKey === 'individual') return PRICING_CONFIG.regenerations.individual
  if (configKey === 'proSmall') return PRICING_CONFIG.regenerations.proSmall
  if (configKey === 'proLarge') return PRICING_CONFIG.regenerations.proLarge

  return PRICING_CONFIG.regenerations.tryItForFree
}
