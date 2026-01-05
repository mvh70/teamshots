import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import Stripe from 'stripe'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

// Schema for updating a promo code
const updatePromoCodeSchema = z.object({
  active: z.boolean().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  applicableTo: z.array(z.enum(['plan', 'seats', 'top_up'])).min(1).optional(),
  minSeats: z.number().int().positive().nullable().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/promo-codes/[id] - Get a single promo code with details
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params

    const promoCode = await prisma.promoCode.findUnique({
      where: { id },
      include: {
        usages: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Limit to recent 50 usages
          include: {
            user: {
              select: {
                id: true,
                email: true,
                person: {
                  select: {
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          }
        },
        _count: {
          select: { usages: true }
        }
      }
    })

    if (!promoCode) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    return NextResponse.json({
      promoCode: {
        ...promoCode,
        actualUsageCount: promoCode._count.usages,
      }
    })
  } catch (error) {
    console.error('Error fetching promo code:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promo code' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/promo-codes/[id] - Update a promo code
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params
    const body = await request.json()
    const parseResult = updatePromoCodeSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      )
    }

    const data = parseResult.data

    // Check if promo code exists
    const existingCode = await prisma.promoCode.findUnique({
      where: { id }
    })

    if (!existingCode) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    // Update Stripe promotion code if we're changing active status
    if (data.active !== undefined && existingCode.stripePromoCodeId) {
      try {
        await stripe.promotionCodes.update(existingCode.stripePromoCodeId, {
          active: data.active,
        })
      } catch (stripeError) {
        console.error('Error updating Stripe promotion code:', stripeError)
        // Continue with database update even if Stripe fails
      }
    }

    // Update promo code in database
    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: {
        active: data.active,
        maxUses: data.maxUses,
        validUntil: data.validUntil !== undefined
          ? (data.validUntil ? new Date(data.validUntil) : null)
          : undefined,
        applicableTo: data.applicableTo,
        minSeats: data.minSeats,
      }
    })

    return NextResponse.json({ promoCode })
  } catch (error) {
    console.error('Error updating promo code:', error)
    return NextResponse.json(
      { error: 'Failed to update promo code' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/promo-codes/[id] - Deactivate a promo code (soft delete)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params

    // Check if promo code exists
    const existingCode = await prisma.promoCode.findUnique({
      where: { id }
    })

    if (!existingCode) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    // Deactivate in Stripe if exists
    if (existingCode.stripePromoCodeId) {
      try {
        await stripe.promotionCodes.update(existingCode.stripePromoCodeId, {
          active: false,
        })
      } catch (stripeError) {
        console.error('Error deactivating Stripe promotion code:', stripeError)
      }
    }

    // Soft delete - just deactivate
    await prisma.promoCode.update({
      where: { id },
      data: { active: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting promo code:', error)
    return NextResponse.json(
      { error: 'Failed to delete promo code' },
      { status: 500 }
    )
  }
}
