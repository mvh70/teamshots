// Define Stripe Price IDs per environment (test vs production)
const TEST_STRIPE_PRICE_IDS = {
  TRY_ONCE: "price_1SVDRqENr8odIuXa8iteYR8v",
  INDIVIDUAL: "price_1SVDRqENr8odIuXaUsejcC0Y",
  PRO_SMALL: "price_1SVDRrENr8odIuXam20q1Y0H",
  PRO_LARGE: "price_1SVDRsENr8odIuXaI58rONjp",
  INDIVIDUAL_TOP_UP: "price_1SVDRsENr8odIuXauWVusJRu",
  PRO_SMALL_TOP_UP: "price_1SVDRtENr8odIuXa51JORKHM",
  PRO_LARGE_TOP_UP: "price_1SVDRtENr8odIuXasuxkKPYU",
  TRY_ONCE_TOP_UP: "price_1SVDRuENr8odIuXaZofhMLDy",
} as const;

const PROD_STRIPE_PRICE_IDS = {
  TRY_ONCE: "price_1SVEzhENr8odIuXaB5GH9ols",
  INDIVIDUAL: "price_1SVEzhENr8odIuXaRD0LmWRv",
  PRO_SMALL: "price_1SVEziENr8odIuXagC8KXdWm",
  PRO_LARGE: "price_1SVEzjENr8odIuXasqgEm3hL",
  INDIVIDUAL_TOP_UP: "price_1SVEzjENr8odIuXasgnzDlZv",
  PRO_SMALL_TOP_UP: "price_1SVEzkENr8odIuXaSbNmfuHf",
  PRO_LARGE_TOP_UP: "price_1SVEzlENr8odIuXaIBqDLcGj",
  TRY_ONCE_TOP_UP: "price_1SVEzlENr8odIuXazlEJJjXi",
} as const;

const IS_PRODUCTION =
  process.env.NEXT_PUBLIC_APP_ENV === 'production' ||
  process.env.NODE_ENV === 'production';

type StripePriceIds = {
  readonly TRY_ONCE: string;
  readonly INDIVIDUAL: string;
  readonly PRO_SMALL: string;
  readonly PRO_LARGE: string;
  readonly INDIVIDUAL_TOP_UP: string;
  readonly PRO_SMALL_TOP_UP: string;
  readonly PRO_LARGE_TOP_UP: string;
  readonly TRY_ONCE_TOP_UP: string;
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
    tryOnce: 2,
    individual: 3,
    proSmall: 4,
    proLarge: 4,
    invited: 4,
  },

  // Try Once (one-time purchase)
  tryOnce: {
    price: 5.00,
    credits: 10,
    stripePriceId: STRIPE_PRICE_IDS.TRY_ONCE || '',
    topUp: {
      price: 24.99,
      credits: 50,
      stripePriceId: STRIPE_PRICE_IDS.TRY_ONCE_TOP_UP || '',
    },
  },

  // Individual tier (Personal - one-time purchase)
  individual: {
    price: 19.99,
    credits: 50, // 5 photos at 10 credits each
    stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL || '',
    topUp: {
      price: 19.99,
      credits: 50,
      stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL_TOP_UP || '',
    },
  },

  // Pro Small tier (Business - up to 5 team members - one-time purchase)
  proSmall: {
    price: 19.99,
    credits: 50, // 5 photos at 10 credits each
    maxTeamMembers: 5,
    stripePriceId: STRIPE_PRICE_IDS.PRO_SMALL || '',
    topUp: {
      price: 19.99,
      credits: 50,
      stripePriceId: STRIPE_PRICE_IDS.PRO_SMALL_TOP_UP || '',
    },
  },

  // Pro Large tier (Business - more than 5 team members - one-time purchase)
  proLarge: {
    price: 59.99,
    credits: 200, // 20 photos at 10 credits each
    maxTeamMembers: null, // unlimited
    stripePriceId: STRIPE_PRICE_IDS.PRO_LARGE || '',
    topUp: {
      price: 29.99,
      credits: 100, // 10 photos at 10 credits each
      stripePriceId: STRIPE_PRICE_IDS.PRO_LARGE_TOP_UP || '',
    },
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

// Pricing tier type
export type PricingTier = 'tryOnce' | 'individual' | 'proSmall' | 'proLarge';
