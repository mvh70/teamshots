// Define Stripe Price IDs per environment (test vs production)
const TEST_STRIPE_PRICE_IDS = {
  TRY_ONCE: "price_1SQ5yBENr8odIuXavrO8Mdoj",
  INDIVIDUAL_MONTHLY: "price_1SQ5yCENr8odIuXaSZWd1HmH",
  INDIVIDUAL_ANNUAL_MONTHLY: "price_1SQ5yCENr8odIuXawTDntLGO",
  PRO_MONTHLY: "price_1SQ5yDENr8odIuXayMnwCrFK",
  PRO_ANNUAL_MONTHLY: "price_1SQ5yEENr8odIuXaUkDMJtjX",
  INDIVIDUAL_TOP_UP: "price_1SQ5yEENr8odIuXa0xQmW0Fj",
  PRO_TOP_UP: "price_1SQ5yFENr8odIuXaaPqPn0mY",
  TRY_ONCE_TOP_UP: "price_1SQ5yGENr8odIuXaXfKd8zRk",
} as const;

const PROD_STRIPE_PRICE_IDS = {
  TRY_ONCE: "price_1SNf1qENr8odIuXaFvdZpbvz",
  INDIVIDUAL_MONTHLY: "price_1SNf1sENr8odIuXaFh37KBgd",
  INDIVIDUAL_ANNUAL_MONTHLY: "price_1SNf1sENr8odIuXa6Akt2ZyK",
  PRO_MONTHLY: "price_1SNf1tENr8odIuXa2Avo6e3e",
  PRO_ANNUAL_MONTHLY: "price_1SNf1uENr8odIuXaaHbfAHbp",
  INDIVIDUAL_TOP_UP: "price_1SNf1uENr8odIuXaN01qecY0",
  PRO_TOP_UP: "price_1SNf1vENr8odIuXaATPBupuL",
  TRY_ONCE_TOP_UP: "price_1SNf1wENr8odIuXam77AKOKo",
} as const;

const IS_PRODUCTION =
  process.env.NEXT_PUBLIC_APP_ENV === 'production' ||
  process.env.NODE_ENV === 'production';

type StripePriceIds = {
  readonly TRY_ONCE: string;
  readonly INDIVIDUAL_MONTHLY: string;
  readonly INDIVIDUAL_ANNUAL_MONTHLY: string;
  readonly PRO_MONTHLY: string;
  readonly PRO_ANNUAL_MONTHLY: string;
  readonly INDIVIDUAL_TOP_UP: string;
  readonly PRO_TOP_UP: string;
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
    personal: 3,
    business: 4,
    invited: 4,
  },
  
  // Try Once (one-time purchase)
  tryOnce: {
    price: 5.00,
    credits: 10,
    stripePriceId: STRIPE_PRICE_IDS.TRY_ONCE || '',
    topUp: {
      price: 8.90,
      credits: 20,
      stripePriceId: STRIPE_PRICE_IDS.TRY_ONCE_TOP_UP || '',
    },
  },
  
  // Individual tier (Personal)
  individual: {
    includedCredits: 60, // per month
    monthly: {
      price: 24.00,
      stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL_MONTHLY || '',
    },
    annual: {
      price: 228.00,
      stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL_ANNUAL_MONTHLY || '',
    },
    topUp: {
      price: 9.99,
      credits: 30,
      stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL_TOP_UP || '',
    },
  },
  
  // Pro tier (Business)
  pro: {
    includedCredits: 200, // per month
    monthly: {
      price: 59.00,
      stripePriceId: STRIPE_PRICE_IDS.PRO_MONTHLY || '',
    },
    annual: {
      price: 588.00,
      stripePriceId: STRIPE_PRICE_IDS.PRO_ANNUAL_MONTHLY || '',
    },
    topUp: {
      price: 24.99,
      credits: 100,
      stripePriceId: STRIPE_PRICE_IDS.PRO_TOP_UP || '',
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
  
  // Default package granted on signup (folder name in src/domain/style/packages/)
  defaultSignupPackage: 'headshot1',
} as const;

// Pricing tier type
export type PricingTier = 'individual' | 'pro';
export type PricingPeriod = 'monthly' | 'annual';
