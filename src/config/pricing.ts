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
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_TRY_ONCE_PRICE_ID || '',
  },
  
  // Individual tier (Personal)
  individual: {
    includedCredits: 60, // per month
    monthly: {
      price: 24.00,
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID || '',
    },
    annual: {
      price: 228.00,
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID || '',
    },
    topUp: {
      pricePerPackage: 0.90,
      creditsPerPackage: 10,
      minimumPurchase: 20, // minimum credits to purchase
    },
  },
  
  // Pro tier (Business)
  pro: {
    includedCredits: 200, // per month
    monthly: {
      price: 59.00,
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || '',
    },
    annual: {
      price: 588.00,
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || '',
    },
    topUp: {
      pricePerPackage: 0.60,
      creditsPerPackage: 10,
      minimumPurchase: 20, // minimum credits to purchase
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

// Helper functions
export function getCreditsForTier(tier: PricingTier): number {
  return PRICING_CONFIG[tier].includedCredits;
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

export function calculateAnnualSavings(tier: 'individual' | 'pro'): number {
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

// Get regeneration count for user type
export function getRegenerationCount(userType: 'tryOnce' | 'personal' | 'business' | 'invited'): number {
  return PRICING_CONFIG.regenerations[userType];
}

// Calculate number of photos based on credits
export function calculatePhotosFromCredits(credits: number): number {
  return Math.floor(credits / PRICING_CONFIG.credits.perGeneration);
}

// Calculate price per photo using the correct formula:
// (Tier Price / Credits) * (Credits per Generation / Regenerations per Tier)
export function calculatePricePerPhoto(price: number, credits: number, regenerations: number): number {
  const creditsPerGeneration = PRICING_CONFIG.credits.perGeneration;
  
  // Formula: (price / credits) * (credits per generation / regenerations per tier)
  return (price / credits) * (creditsPerGeneration / regenerations);
}

// Get price per photo for tier
export function getPricePerPhoto(tier: 'tryOnce' | 'individual' | 'pro', period?: 'monthly' | 'annual'): number {
  if (tier === 'tryOnce') {
    return calculatePricePerPhoto(
      PRICING_CONFIG.tryOnce.price,
      PRICING_CONFIG.tryOnce.credits,
      PRICING_CONFIG.regenerations.tryOnce
    );
  }
  
  const tierConfig = PRICING_CONFIG[tier];
  const userType = tier === 'individual' ? 'personal' : 'business';
  const regenerations = PRICING_CONFIG.regenerations[userType];
  
  if (period && tierConfig[period]) {
    // For annual pricing, use the annual price and multiply credits by 12 months
    // This gives us the true cost per photo over the annual period
    const credits = period === 'annual' ? tierConfig.includedCredits * 12 : tierConfig.includedCredits;
    return calculatePricePerPhoto(
      tierConfig[period].price,
      credits,
      regenerations
    );
  }
  
  return calculatePricePerPhoto(
    tierConfig.monthly.price,
    tierConfig.includedCredits,
    regenerations
  );
}

// Get pricing data for display
export function getPricingDisplay() {
  return {
    tryOnce: {
      price: formatPrice(PRICING_CONFIG.tryOnce.price),
      credits: PRICING_CONFIG.tryOnce.credits,
      pricePerPhoto: formatPrice(getPricePerPhoto('tryOnce')),
      regenerations: PRICING_CONFIG.regenerations.tryOnce,
    },
    individual: {
      monthly: {
        price: formatPrice(PRICING_CONFIG.individual.monthly.price),
        credits: PRICING_CONFIG.individual.includedCredits,
        pricePerPhoto: formatPrice(getPricePerPhoto('individual', 'monthly')),
        regenerations: PRICING_CONFIG.regenerations.personal,
      },
      annual: {
        price: formatPrice(PRICING_CONFIG.individual.annual.price),
        credits: PRICING_CONFIG.individual.includedCredits,
        pricePerPhoto: formatPrice(getPricePerPhoto('individual', 'annual')),
        regenerations: PRICING_CONFIG.regenerations.personal,
        savings: formatPrice(calculateAnnualSavings('individual')),
      },
      topUp: formatPrice(PRICING_CONFIG.individual.topUp.pricePerPackage),
    },
    pro: {
      monthly: {
        price: formatPrice(PRICING_CONFIG.pro.monthly.price),
        credits: PRICING_CONFIG.pro.includedCredits,
        pricePerPhoto: formatPrice(getPricePerPhoto('pro', 'monthly')),
        regenerations: PRICING_CONFIG.regenerations.business,
      },
      annual: {
        price: formatPrice(PRICING_CONFIG.pro.annual.price),
        credits: PRICING_CONFIG.pro.includedCredits,
        pricePerPhoto: formatPrice(getPricePerPhoto('pro', 'annual')),
        regenerations: PRICING_CONFIG.regenerations.business,
        savings: formatPrice(calculateAnnualSavings('pro')),
      },
      topUp: formatPrice(PRICING_CONFIG.pro.topUp.pricePerPackage),
    },
  };
}

