import { PRICING_CONFIG, type PricingPeriod, type PricingTier } from '@/config/pricing'

export function calculateAnnualSavings(tier: PricingTier): number {
  const monthlyTotal = PRICING_CONFIG[tier].monthly.price * 12
  const annualPrice = PRICING_CONFIG[tier].annual.price
  return monthlyTotal - annualPrice
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  if (currency === 'USD') {
    return `$${price.toFixed(2)}`
  }
  return `${price.toFixed(2)} ${currency}`
}

export function getRegenerationCount(
  userType: 'tryOnce' | 'personal' | 'business' | 'invited'
): number {
  return PRICING_CONFIG.regenerations[userType]
}

export function calculatePhotosFromCredits(credits: number): number {
  return Math.floor(credits / PRICING_CONFIG.credits.perGeneration)
}

export function calculatePricePerPhoto(
  price: number,
  credits: number,
  regenerations: number
): number {
  const creditsPerGeneration = PRICING_CONFIG.credits.perGeneration
  return (price / credits) * (creditsPerGeneration / regenerations)
}

export function getPricePerPhoto(
  tier: 'tryOnce' | 'individual' | 'pro',
  period?: PricingPeriod
): number {
  if (tier === 'tryOnce') {
    return calculatePricePerPhoto(
      PRICING_CONFIG.tryOnce.price,
      PRICING_CONFIG.tryOnce.credits,
      PRICING_CONFIG.regenerations.tryOnce
    )
  }

  const tierConfig = PRICING_CONFIG[tier]
  const userType = tier === 'individual' ? 'personal' : 'business'
  const regenerations = PRICING_CONFIG.regenerations[userType]

  if (period && tierConfig[period]) {
    const credits = period === 'annual' ? tierConfig.includedCredits * 12 : tierConfig.includedCredits
    return calculatePricePerPhoto(tierConfig[period].price, credits, regenerations)
  }

  return calculatePricePerPhoto(
    tierConfig.monthly.price,
    tierConfig.includedCredits,
    regenerations
  )
}

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
      topUp: formatPrice(PRICING_CONFIG.individual.topUp.price),
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
      topUp: formatPrice(PRICING_CONFIG.pro.topUp.price),
    },
  }
}


