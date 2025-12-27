// Define Stripe Price IDs per environment (test vs production)
const TEST_STRIPE_PRICE_IDS = {
  INDIVIDUAL: "price_1SajfxENr8odIuXaJU1IuCr3",
  VIP: "price_1SajfzENr8odIuXavTftq5Dy",
  TEAM_SEATS: "", // Run scripts/import-stripe-products.js to generate
  INDIVIDUAL_TOP_UP: "price_1Sajg0ENr8odIuXa6kcQpNKs",
  VIP_TOP_UP: "price_1Sajg2ENr8odIuXaUYFabxOr",
} as const;

const PROD_STRIPE_PRICE_IDS = {
  INDIVIDUAL: "price_1SajhGENr8odIuXaapskBoOc",
  VIP: "price_1SajhIENr8odIuXaeponRjAR",
  TEAM_SEATS: "", // Run scripts/import-stripe-products.js to generate
  INDIVIDUAL_TOP_UP: "price_1SajhJENr8odIuXaVePSTFSd",
  VIP_TOP_UP: "price_1SajhLENr8odIuXa8TUXvCxh",
} as const;

const IS_PRODUCTION =
  process.env.NEXT_PUBLIC_APP_ENV === 'production' ||
  process.env.NODE_ENV === 'production';

type StripePriceIds = {
  readonly INDIVIDUAL: string;
  readonly VIP: string;
  readonly TEAM_SEATS: string;
  readonly INDIVIDUAL_TOP_UP: string;
  readonly VIP_TOP_UP: string;
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
    vip: 3, // VIP gets most retries
    seats: 2, // Seats-based pricing gets 2 regenerations
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

  // Seats-based pricing (TeamShotsPro domain)
  seats: {
    minSeats: 2, // Minimum 2 seats required
    creditsPerSeat: 100, // 10 photos per seat
    stripePriceId: STRIPE_PRICE_IDS.TEAM_SEATS || '',
    // Graduated pricing tiers (each tier charged separately and summed)
    // Stored in descending order for consistent config structure
    graduatedTiers: [
      { min: 1000, max: Infinity, pricePerSeat: 17.99 },
      { min: 500, max: 999, pricePerSeat: 19.49 },
      { min: 100, max: 499, pricePerSeat: 20.99 },
      { min: 25, max: 99, pricePerSeat: 22.49 },
      { min: 5, max: 24, pricePerSeat: 23.99 },
      { min: 2, max: 4, pricePerSeat: 29.99 },
    ],
    // Helper to calculate total price using graduated pricing
    // Each tier is charged separately: (tier1 seats × tier1 price) + (tier2 seats × tier2 price) + ...
    calculateTotal: (seats: number): number => {
      if (seats < 2) return 0

      let total = 0
      let remaining = seats

      // Process tiers from smallest to largest (reverse the config order)
      const tiersAscending = [...PRICING_CONFIG.seats.graduatedTiers].reverse()

      for (const tier of tiersAscending) {
        if (remaining <= 0) break

        // Calculate tier capacity
        const tierCapacity = tier.max === Infinity
          ? Infinity
          : tier.max - tier.min + 1

        // Determine how many seats fall in this tier
        const seatsInTier = Math.min(remaining, tierCapacity)

        // Add this tier's cost to total
        total += seatsInTier * tier.pricePerSeat
        remaining -= seatsInTier
      }

      return total
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
export type PricingTier = 'tryItForFree' | 'individual' | 'vip';

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
): 'individual' | null {
  // Free plans don't map to a pricing config key
  if (!period || period === 'free' || period === 'tryOnce' || period === 'try_once') {
    return null
  }

  // Map tier+period combinations to pricing config keys
  if (tier === 'individual' && period === 'small') {
    return 'individual'
  }

  // Backward compatibility: handle legacy period values
  if (period === 'individual') return 'individual'

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

  return PRICING_CONFIG.regenerations.tryItForFree
}
