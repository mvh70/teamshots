export const PRICING_CONFIG = {
  // Credits system
  credits: {
    perGeneration: 4,
    variationsPerGeneration: 4,
    rollover: true,
    rolloverLimit: null, // unlimited rollover
  },
  
  // Try Once (one-time purchase)
  tryOnce: {
    price: 5.00,
    credits: 4,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_TRY_ONCE_PRICE_ID || '',
  },
  
  // Starter tier
  starter: {
    monthly: {
      price: 24.00,
      includedCredits: 100,
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID || '',
    },
    annual: {
      price: 245.00,
      includedCredits: 100, // per month
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID || '',
    },
    topUp: {
      pricePerPackage: 0.90,
      creditsPerPackage: 4,
      minimumPurchase: 20, // minimum credits to purchase
    },
  },
  
  // Pro tier
  pro: {
    monthly: {
      price: 59.00,
      includedCredits: 280,
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || '',
    },
    annual: {
      price: 600.00,
      includedCredits: 280, // per month
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || '',
    },
    topUp: {
      pricePerPackage: 0.60,
      creditsPerPackage: 4,
      minimumPurchase: 20, // minimum credits to purchase
    },
  },
  
  // Cost tracking
  costs: {
    geminiApiPerGeneration: 0.10, // Estimated cost per generation
  },
} as const;

// Pricing tier type
export type PricingTier = 'starter' | 'pro';
export type PricingPeriod = 'monthly' | 'annual';

// Helper functions
export function getCreditsForTier(tier: PricingTier, period: PricingPeriod): number {
  return PRICING_CONFIG[tier][period].includedCredits;
}

export function getPriceForTier(tier: PricingTier, period: PricingPeriod): number {
  return PRICING_CONFIG[tier][period].price;
}

export function getTopUpPrice(tier: PricingTier): number {
  return PRICING_CONFIG[tier].topUp.pricePerPackage;
}

export function getTopUpCredits(tier: PricingTier): number {
  return PRICING_CONFIG[tier].topUp.creditsPerPackage;
}

export function formatCreditsDisplay(credits: number): string {
  const generations = Math.floor(credits / PRICING_CONFIG.credits.perGeneration);
  return `${credits} credits (${generations} generation${generations !== 1 ? 's' : ''})`;
}

export function calculateGenerations(credits: number): number {
  return Math.floor(credits / PRICING_CONFIG.credits.perGeneration);
}

export function calculateAnnualSavings(tier: PricingTier): number {
  const monthlyTotal = PRICING_CONFIG[tier].monthly.price * 12;
  const annualPrice = PRICING_CONFIG[tier].annual.price;
  return monthlyTotal - annualPrice;
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  if (currency === 'USD') {
    return `$${price.toFixed(2)}`;
  }
  // Add more currency formatting as needed
  return `${price.toFixed(2)} ${currency}`;
}

// Get pricing data for display
export function getPricingDisplay() {
  return {
    tryOnce: {
      price: formatPrice(PRICING_CONFIG.tryOnce.price),
      credits: PRICING_CONFIG.tryOnce.credits,
      generations: calculateGenerations(PRICING_CONFIG.tryOnce.credits),
    },
    starter: {
      monthly: {
        price: formatPrice(PRICING_CONFIG.starter.monthly.price),
        credits: PRICING_CONFIG.starter.monthly.includedCredits,
        generations: calculateGenerations(PRICING_CONFIG.starter.monthly.includedCredits),
      },
      annual: {
        price: formatPrice(PRICING_CONFIG.starter.annual.price),
        credits: PRICING_CONFIG.starter.annual.includedCredits,
        generations: calculateGenerations(PRICING_CONFIG.starter.annual.includedCredits),
        savings: formatPrice(calculateAnnualSavings('starter')),
      },
      topUp: formatPrice(PRICING_CONFIG.starter.topUp.pricePerPackage),
    },
    pro: {
      monthly: {
        price: formatPrice(PRICING_CONFIG.pro.monthly.price),
        credits: PRICING_CONFIG.pro.monthly.includedCredits,
        generations: calculateGenerations(PRICING_CONFIG.pro.monthly.includedCredits),
      },
      annual: {
        price: formatPrice(PRICING_CONFIG.pro.annual.price),
        credits: PRICING_CONFIG.pro.annual.includedCredits,
        generations: calculateGenerations(PRICING_CONFIG.pro.annual.includedCredits),
        savings: formatPrice(calculateAnnualSavings('pro')),
      },
      topUp: formatPrice(PRICING_CONFIG.pro.topUp.pricePerPackage),
    },
  };
}

