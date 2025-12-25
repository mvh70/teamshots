// Define Stripe Price IDs per environment (test vs production)
const TEST_STRIPE_PRICE_IDS = {
  INDIVIDUAL: "price_1SajfxENr8odIuXaJU1IuCr3",
  PRO_SMALL: "price_1SajfyENr8odIuXarx9DdGVK",
  PRO_LARGE: "price_1SajfyENr8odIuXaTfKDskg1",
  VIP: "price_1SajfzENr8odIuXavTftq5Dy",
  ENTERPRISE: "price_1Sajg0ENr8odIuXamVNsCXxf",
  TEAM_SEATS: "", // Run scripts/import-stripe-products.js to generate
  INDIVIDUAL_TOP_UP: "price_1Sajg0ENr8odIuXa6kcQpNKs",
  PRO_SMALL_TOP_UP: "price_1Sajg1ENr8odIuXaKsxvILky",
  PRO_LARGE_TOP_UP: "price_1Sajg2ENr8odIuXavC8jcq9y",
  VIP_TOP_UP: "price_1Sajg2ENr8odIuXaUYFabxOr",
  ENTERPRISE_TOP_UP: "price_1Sajg3ENr8odIuXaWB52cjaw",
} as const;

const PROD_STRIPE_PRICE_IDS = {
  INDIVIDUAL: "price_1SajhGENr8odIuXaapskBoOc",
  PRO_SMALL: "price_1SajhHENr8odIuXaN9NWCv32",
  PRO_LARGE: "price_1SajhHENr8odIuXasPp4Fmcv",
  VIP: "price_1SajhIENr8odIuXaeponRjAR",
  ENTERPRISE: "price_1SajhJENr8odIuXa2q4TdXtf",
  TEAM_SEATS: "", // Run scripts/import-stripe-products.js to generate
  INDIVIDUAL_TOP_UP: "price_1SajhJENr8odIuXaVePSTFSd",
  PRO_SMALL_TOP_UP: "price_1SajhKENr8odIuXaoMvaAYf3",
  PRO_LARGE_TOP_UP: "price_1SajhLENr8odIuXanjNp9Ixs",
  VIP_TOP_UP: "price_1SajhLENr8odIuXa8TUXvCxh",
  ENTERPRISE_TOP_UP: "price_1SajhMENr8odIuXawSpvaPeB",
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
  readonly TEAM_SEATS: string;
  readonly INDIVIDUAL_TOP_UP: string;
  readonly PRO_SMALL_TOP_UP: string;
  readonly PRO_LARGE_TOP_UP: string;
  readonly VIP_TOP_UP: string;
  readonly ENTERPRISE_TOP_UP: string;
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


  // Individual tier (Personal - one-time purchase)
  individual: {
    price: 19.99,
    credits: 40, // 5 photos at 10 credits each
    stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL || '',
    topUp: {
      price: 19.99,
      credits: 40,
      stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL_TOP_UP || '',
    },
  },

  // VIP tier (Individual domain anchor - one-time purchase)
  vip: {
    price: 199.99,
    credits: 250, // 25 photos at 10 credits each
    maxTeamMembers: null, // unlimited
    stripePriceId: STRIPE_PRICE_IDS.VIP || '',
    topUp: {
      price: 69.99,
      credits: 100, // 10 photos at 10 credits each
      stripePriceId: STRIPE_PRICE_IDS.VIP_TOP_UP || '',
    },
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



  // Enterprise tier (Team domain anchor - one-time purchase)
  enterprise: {
    price: 399.99,
    credits: 600, // 60 photos at 10 credits each
    maxTeamMembers: null, // unlimited
    stripePriceId: STRIPE_PRICE_IDS.ENTERPRISE || '',
    topUp: {
      price: 149.99,
      credits: 250, // 25 photos at 10 credits each
      stripePriceId: STRIPE_PRICE_IDS.ENTERPRISE_TOP_UP || '',
    },
  },

  // Seats-based pricing (TeamShotsPro domain)
  seats: {
    creditsPerSeat: 100, // 10 photos per seat
    photosPerSeat: 10,
    stripePriceId: STRIPE_PRICE_IDS.TEAM_SEATS || '',
    volumeTiers: [
      { min: 25, max: Infinity, pricePerSeat: 15.96 },
      { min: 10, max: 24, pricePerSeat: 19.90 },
      { min: 1, max: 9, pricePerSeat: 29.00 }
    ],
    // Helper to calculate total price based on seat count
    calculateTotal: (seats: number): number => {
      if (seats < 1) return 0
      const tier = PRICING_CONFIG.seats.volumeTiers.find(
        t => seats >= t.min && seats <= t.max
      )
      return seats * (tier?.pricePerSeat ?? 29.00)
    }
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
