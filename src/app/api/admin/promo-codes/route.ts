import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { RESTRICTED_DOMAINS } from '@/config/domain'
import Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

// Schema for creating a promo code
const createPromoCodeSchema = z.object({
  code: z.string().min(1).max(50).transform(val => val.toUpperCase().trim()),
  domain: z.string().min(1),
  discountType: z.enum(['percentage', 'fixed_amount']),
  discountValue: z.number().positive(),
  maxUses: z.number().int().positive().nullable().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  applicableTo: z.array(z.enum(['plan', 'seats', 'top_up'])).min(1).default(['plan', 'seats', 'top_up']),
  minSeats: z.number().int().positive().nullable().optional(),
})

// GET /api/admin/promo-codes - List all promo codes
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get optional domain filter from query params
    const { searchParams } = new URL(request.url)
    const domainFilter = searchParams.get('domain')

    const promoCodes = await prisma.promoCode.findMany({
      where: domainFilter ? { domain: domainFilter } : undefined,
      include: {
        _count: {
          select: { usages: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get available domains for filter dropdown
    const availableDomains = [...RESTRICTED_DOMAINS]

    return NextResponse.json({
      promoCodes: promoCodes.map(code => ({
        ...code,
        actualUsageCount: code._count.usages,
      })),
      availableDomains,
    })
  } catch (error) {
    console.error('Error fetching promo codes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promo codes' },
      { status: 500 }
    )
  }
}

// POST /api/admin/promo-codes - Create a new promo code
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parseResult = createPromoCodeSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      )
    }

    const data = parseResult.data

    // Check if code already exists for this domain
    const existingCode = await prisma.promoCode.findUnique({
      where: {
        code_domain: {
          code: data.code,
          domain: data.domain,
        }
      }
    })

    if (existingCode) {
      return NextResponse.json(
        { error: 'A promo code with this name already exists for this domain' },
        { status: 400 }
      )
    }

    // Create Stripe Coupon
    let stripeCouponId: string | undefined
    let stripePromoCodeId: string | undefined

    try {
      // Create coupon in Stripe
      const coupon = await stripe.coupons.create({
        id: `${data.code}_${data.domain.replace(/\./g, '_')}`,
        name: `${data.code} (${data.domain})`,
        ...(data.discountType === 'percentage'
          ? { percent_off: data.discountValue }
          : { amount_off: Math.round(data.discountValue * 100), currency: 'usd' }
        ),
        duration: 'once',
        max_redemptions: data.maxUses || undefined,
        redeem_by: data.validUntil ? Math.floor(new Date(data.validUntil).getTime() / 1000) : undefined,
      })

      stripeCouponId = coupon.id

      // Create promotion code from coupon
      const promoCode = await stripe.promotionCodes.create({
        promotion: {
          type: 'coupon',
          coupon: coupon.id,
        },
        code: data.code,
        active: true,
        max_redemptions: data.maxUses || undefined,
        expires_at: data.validUntil ? Math.floor(new Date(data.validUntil).getTime() / 1000) : undefined,
      })

      stripePromoCodeId = promoCode.id
    } catch (stripeError) {
      console.error('Error creating Stripe coupon/promo code:', stripeError)
      // Continue without Stripe integration - code will work locally but not in Stripe checkout
    }

    // Create promo code in database
    const promoCode = await prisma.promoCode.create({
      data: {
        code: data.code,
        domain: data.domain,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxUses: data.maxUses,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        applicableTo: data.applicableTo,
        minSeats: data.minSeats,
        stripeCouponId,
        stripePromoCodeId,
        active: true,
      }
    })

    return NextResponse.json({ promoCode }, { status: 201 })
  } catch (error) {
    console.error('Error creating promo code:', error)
    return NextResponse.json(
      { error: 'Failed to create promo code' },
      { status: 500 }
    )
  }
}
