import { PRICING_CONFIG, type PricingTier, getRegenerationsForPlan } from '@/config/pricing'

// Type for pricing tiers that have price configurations (excluding tryItForFree)
type PricedTier = Exclude<PricingTier, 'tryItForFree'>
import type { PlanTier, PlanPeriod } from '@/domain/subscription/utils'

// Removed: calculateAnnualSavings - no longer needed for transactional pricing

export function formatPrice(price: number, currency: string = 'USD'): string {
  if (currency === 'USD') {
    return `$${price.toFixed(2)}`
  }
  return `${price.toFixed(2)} ${currency}`
}

/**
 * Get regeneration count for a pricing tier or tier+period combination
 * @param tier - Pricing tier OR plan tier
 * @param period - Plan period (optional, if provided uses tier+period mapping)
 * @returns Number of regenerations
 */
export function getRegenerationCount(tier: PricingTier | PlanTier, period?: PlanPeriod | null): number {
  // If period is provided, use tier+period mapping
  if (period !== undefined && period !== null) {
    return getRegenerationsForPlan(tier as PlanTier, period)
  }
  // Otherwise, use direct pricing tier lookup
  return PRICING_CONFIG.regenerations[tier as PricingTier]
}

export function calculatePhotosFromCredits(credits: number): number {
  return Math.floor(credits / PRICING_CONFIG.credits.perGeneration)
}

export function calculatePricePerPhoto(
  price: number,
  credits: number,
  regenerations: number
): number {
  // Calculate total photos including retries: numberOfPhotos × (1 original + regenerations)
  const numberOfPhotos = calculatePhotosFromCredits(credits)
  const totalPhotos = numberOfPhotos * (1 + regenerations)
  
  // Price per photo = total price / total photos
  return price / totalPhotos
}

export function getPricePerPhoto(tier: PricingTier): number {
  // Try It For Free is free, so price per photo is 0
  if (tier === 'tryItForFree') {
    return 0
  }

  // VIP tier
  if (tier === 'vip') {
    const vipConfig = PRICING_CONFIG.vip
    const regenerations = PRICING_CONFIG.regenerations.vip
    return calculatePricePerPhoto(vipConfig.price, vipConfig.credits, regenerations)
  }

  const tierConfig = PRICING_CONFIG[tier as PricedTier]
  const regenerations = PRICING_CONFIG.regenerations[tier]

  return calculatePricePerPhoto(
    tierConfig.price,
    tierConfig.credits,
    regenerations
  )
}

export function getPricingDisplay() {
  return {
    freeTrial: {
      price: 'Free',
      credits: PRICING_CONFIG.freeTrial.individual,
      pricePerPhoto: formatPrice(getPricePerPhoto('tryItForFree')),
      regenerations: PRICING_CONFIG.regenerations.tryItForFree,
    },
    individual: {
      price: formatPrice(PRICING_CONFIG.individual.price),
      credits: PRICING_CONFIG.individual.credits,
      pricePerPhoto: formatPrice(getPricePerPhoto('individual')),
      regenerations: PRICING_CONFIG.regenerations.individual,
    },
    vip: {
      price: formatPrice(PRICING_CONFIG.vip.price),
      credits: PRICING_CONFIG.vip.credits,
      pricePerPhoto: formatPrice(getPricePerPhoto('vip')),
      regenerations: PRICING_CONFIG.regenerations.vip,
    },
  }
}


