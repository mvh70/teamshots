import { PRICING_CONFIG, type PricingTier } from '@/config/pricing'

// Removed: calculateAnnualSavings - no longer needed for transactional pricing

export function formatPrice(price: number, currency: string = 'USD'): string {
  if (currency === 'USD') {
    return `$${price.toFixed(2)}`
  }
  return `${price.toFixed(2)} ${currency}`
}

export function getRegenerationCount(tier: PricingTier): number {
  return PRICING_CONFIG.regenerations[tier]
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

export function getPricePerPhoto(tier: PricingTier): number {
  const tierConfig = PRICING_CONFIG[tier]
  const regenerations = PRICING_CONFIG.regenerations[tier]

  return calculatePricePerPhoto(
    tierConfig.price,
    tierConfig.credits,
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
      price: formatPrice(PRICING_CONFIG.individual.price),
      credits: PRICING_CONFIG.individual.credits,
      pricePerPhoto: formatPrice(getPricePerPhoto('individual')),
      regenerations: PRICING_CONFIG.regenerations.individual,
    },
    proSmall: {
      price: formatPrice(PRICING_CONFIG.proSmall.price),
      credits: PRICING_CONFIG.proSmall.credits,
      pricePerPhoto: formatPrice(getPricePerPhoto('proSmall')),
      regenerations: PRICING_CONFIG.regenerations.proSmall,
      },
    proLarge: {
      price: formatPrice(PRICING_CONFIG.proLarge.price),
      credits: PRICING_CONFIG.proLarge.credits,
      pricePerPhoto: formatPrice(getPricePerPhoto('proLarge')),
      regenerations: PRICING_CONFIG.regenerations.proLarge,
    },
  }
}


