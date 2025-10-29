// Define Stripe Price IDs here. You can list multiple IDs (e.g., per environment or legacy prices).
const STRIPE_PRICE_IDS = {
  TRY_ONCE: "price_1SNf1qENr8odIuXaFvdZpbvz",
  INDIVIDUAL_MONTHLY: "price_1SNf1sENr8odIuXaFh37KBgd",
  INDIVIDUAL_ANNUAL_MONTHLY: "price_1SNf1sENr8odIuXa6Akt2ZyK",
  PRO_MONTHLY: "price_1SNf1tENr8odIuXa2Avo6e3e",
  PRO_ANNUAL_MONTHLY: "price_1SNf1uENr8odIuXaaHbfAHbp",
  INDIVIDUAL_TOP_UP: "price_1SNf1uENr8odIuXaN01qecY0",
  PRO_TOP_UP: "price_1SNf1vENr8odIuXaATPBupuL",
  TRY_ONCE_TOP_UP: "price_1SNf1wENr8odIuXam77AKOKo",
} as const;

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
} as const;

// Pricing tier type
export type PricingTier = 'individual' | 'pro';
export type PricingPeriod = 'monthly' | 'annual';
