import { prisma } from '@/lib/prisma'
import type { PromoCode } from '@prisma/client'

export type DiscountType = 'percentage' | 'fixed_amount'
export type PurchaseType = 'plan' | 'seats' | 'top_up'

export interface PromoCodeValidation {
  valid: boolean
  error?: string
  promoCode?: PromoCode
  discount?: {
    type: DiscountType
    value: number
    discountAmount: number
    finalAmount: number
  }
}

export interface ValidatePromoCodeParams {
  code: string
  domain: string
  purchaseType: PurchaseType
  originalAmount: number
  userId?: string
  email?: string
  seats?: number
}

/**
 * Validate a promo code and calculate the discount
 */
export async function validatePromoCode(
  params: ValidatePromoCodeParams
): Promise<PromoCodeValidation> {
  const { code, domain, purchaseType, originalAmount, userId, email, seats } = params

  // Normalize code to uppercase
  const normalizedCode = code.trim().toUpperCase()

  // Find the promo code for this domain
  const promoCode = await prisma.promoCode.findUnique({
    where: {
      code_domain: {
        code: normalizedCode,
        domain,
      },
    },
  })

  if (!promoCode) {
    return { valid: false, error: 'Invalid promo code' }
  }

  // Check if active
  if (!promoCode.active) {
    return { valid: false, error: 'This promo code is no longer active' }
  }

  // Check date range
  const now = new Date()
  if (promoCode.validFrom && now < promoCode.validFrom) {
    return { valid: false, error: 'This promo code is not yet valid' }
  }
  if (promoCode.validUntil && now > promoCode.validUntil) {
    return { valid: false, error: 'This promo code has expired' }
  }

  // Check max uses
  if (promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses) {
    return { valid: false, error: 'This promo code has reached its usage limit' }
  }

  // Check applicable purchase types
  if (!promoCode.applicableTo.includes(purchaseType)) {
    return {
      valid: false,
      error: `This promo code is not valid for ${purchaseType} purchases`,
    }
  }

  // Check minimum seats requirement
  if (promoCode.minSeats && purchaseType === 'seats') {
    if (!seats || seats < promoCode.minSeats) {
      return {
        valid: false,
        error: `This promo code requires a minimum of ${promoCode.minSeats} seats`,
      }
    }
  }

  // Check if user has already used this code (once per user)
  if (userId || email) {
    const existingUsage = await prisma.promoCodeUsage.findFirst({
      where: {
        promoCodeId: promoCode.id,
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(email ? [{ email: email.toLowerCase() }] : []),
        ],
      },
    })

    if (existingUsage) {
      return { valid: false, error: 'You have already used this promo code' }
    }
  }

  // Calculate discount
  const discount = calculateDiscount(
    promoCode.discountType as DiscountType,
    promoCode.discountValue,
    originalAmount
  )

  return {
    valid: true,
    promoCode,
    discount,
  }
}

/**
 * Calculate the discount amount based on discount type
 */
export function calculateDiscount(
  type: DiscountType,
  value: number,
  originalAmount: number
): {
  type: DiscountType
  value: number
  discountAmount: number
  finalAmount: number
} {
  let discountAmount: number

  if (type === 'percentage') {
    discountAmount = Math.round((originalAmount * value) / 100 * 100) / 100
  } else {
    // fixed_amount
    discountAmount = Math.min(value, originalAmount)
  }

  const finalAmount = Math.max(0, Math.round((originalAmount - discountAmount) * 100) / 100)

  return {
    type,
    value,
    discountAmount,
    finalAmount,
  }
}

/**
 * Record a promo code usage after successful payment
 */
export async function recordPromoCodeUsage(params: {
  promoCodeId: string
  userId?: string
  email?: string
  discountAmount: number
  originalAmount: number
  stripeSessionId?: string
}): Promise<void> {
  const { promoCodeId, userId, email, discountAmount, originalAmount, stripeSessionId } = params

  await prisma.$transaction([
    // Increment usage count
    prisma.promoCode.update({
      where: { id: promoCodeId },
      data: { usedCount: { increment: 1 } },
    }),
    // Record the usage
    prisma.promoCodeUsage.create({
      data: {
        promoCodeId,
        userId,
        email: email?.toLowerCase(),
        discountAmount,
        originalAmount,
        stripeSessionId,
      },
    }),
  ])
}

/**
 * Get a promo code by code and domain
 */
export async function getPromoCode(
  code: string,
  domain: string
): Promise<PromoCode | null> {
  return prisma.promoCode.findUnique({
    where: {
      code_domain: {
        code: code.trim().toUpperCase(),
        domain,
      },
    },
  })
}

/**
 * Get all promo codes, optionally filtered by domain
 */
export async function getPromoCodes(domain?: string): Promise<PromoCode[]> {
  return prisma.promoCode.findMany({
    where: domain ? { domain } : undefined,
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Create a new promo code
 */
export async function createPromoCode(data: {
  code: string
  domain: string
  discountType: DiscountType
  discountValue: number
  maxUses?: number | null
  validFrom?: Date
  validUntil?: Date | null
  applicableTo?: PurchaseType[]
  minSeats?: number | null
  stripeCouponId?: string
  stripePromoCodeId?: string
}): Promise<PromoCode> {
  return prisma.promoCode.create({
    data: {
      code: data.code.trim().toUpperCase(),
      domain: data.domain,
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxUses: data.maxUses,
      validFrom: data.validFrom ?? new Date(),
      validUntil: data.validUntil,
      applicableTo: data.applicableTo ?? ['plan', 'seats', 'top_up'],
      minSeats: data.minSeats,
      stripeCouponId: data.stripeCouponId,
      stripePromoCodeId: data.stripePromoCodeId,
    },
  })
}

/**
 * Update an existing promo code
 */
export async function updatePromoCode(
  id: string,
  data: Partial<{
    discountType: DiscountType
    discountValue: number
    maxUses: number | null
    validFrom: Date
    validUntil: Date | null
    active: boolean
    applicableTo: PurchaseType[]
    minSeats: number | null
  }>
): Promise<PromoCode> {
  return prisma.promoCode.update({
    where: { id },
    data,
  })
}

/**
 * Deactivate a promo code
 */
export async function deactivatePromoCode(id: string): Promise<PromoCode> {
  return prisma.promoCode.update({
    where: { id },
    data: { active: false },
  })
}

/**
 * Get usage history for a promo code
 */
export async function getPromoCodeUsage(promoCodeId: string) {
  return prisma.promoCodeUsage.findMany({
    where: { promoCodeId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}
