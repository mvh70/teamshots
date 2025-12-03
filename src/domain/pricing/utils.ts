import { PRICING_CONFIG, type PricingTier, getRegenerationsForPlan } from '@/config/pricing'
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

  // VIP and Enterprise are contact sales, calculate for display purposes
  if (tier === 'vip') {
    const vipConfig = PRICING_CONFIG.vip
    const regenerations = PRICING_CONFIG.regenerations.vip
    return calculatePricePerPhoto(vipConfig.price, vipConfig.credits, regenerations)
  }

  if (tier === 'enterprise') {
    const enterpriseConfig = PRICING_CONFIG.enterprise
    const regenerations = PRICING_CONFIG.regenerations.enterprise
    return calculatePricePerPhoto(enterpriseConfig.price, enterpriseConfig.credits, regenerations)
  }

  const tierConfig = PRICING_CONFIG[tier] as Extract<typeof PRICING_CONFIG[PricingTier], { price: number }>
  const regenerations = PRICING_CONFIG.regenerations[tier]

  return calculatePricePerPhoto(
    tierConfig.price,
    tierConfig.credits,
    regenerations
  )
}

export function getPricingDisplay() {
  return {
    tryItForFree: {
      price: 'Free',
      credits: PRICING_CONFIG.tryItForFree.credits,
      pricePerPhoto: formatPrice(getPricePerPhoto('tryItForFree')),
      regenerations: PRICING_CONFIG.regenerations.tryItForFree,
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
    vip: {
      price: formatPrice(PRICING_CONFIG.vip.price),
      credits: PRICING_CONFIG.vip.credits,
      pricePerPhoto: formatPrice(getPricePerPhoto('vip')),
      regenerations: PRICING_CONFIG.regenerations.vip,
      isContactSales: true,
    },
    enterprise: {
      price: formatPrice(PRICING_CONFIG.enterprise.price),
      credits: PRICING_CONFIG.enterprise.credits,
      pricePerPhoto: formatPrice(getPricePerPhoto('enterprise')),
      regenerations: PRICING_CONFIG.regenerations.enterprise,
      isContactSales: true,
    },
  }
}


