import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/promo-codes/[id]/usage - Get usage history for a promo code
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const skip = (page - 1) * limit

    // Check if promo code exists
    const promoCode = await prisma.promoCode.findUnique({
      where: { id },
      select: { id: true, code: true }
    })

    if (!promoCode) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    // Get usages with pagination
    const [usages, totalCount] = await Promise.all([
      prisma.promoCodeUsage.findMany({
        where: { promoCodeId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
      }),
      prisma.promoCodeUsage.count({
        where: { promoCodeId: id }
      })
    ])

    // Calculate totals
    const totals = await prisma.promoCodeUsage.aggregate({
      where: { promoCodeId: id },
      _sum: {
        discountAmount: true,
        originalAmount: true,
      }
    })

    return NextResponse.json({
      usages: usages.map(usage => ({
        id: usage.id,
        userId: usage.userId,
        email: usage.email || usage.user?.email,
        userName: usage.user?.person
          ? `${usage.user.person.firstName || ''} ${usage.user.person.lastName || ''}`.trim()
          : null,
        discountAmount: usage.discountAmount,
        originalAmount: usage.originalAmount,
        stripeSessionId: usage.stripeSessionId,
        createdAt: usage.createdAt,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      totals: {
        totalDiscountGiven: totals._sum.discountAmount || 0,
        totalOriginalAmount: totals._sum.originalAmount || 0,
        usageCount: totalCount,
      }
    })
  } catch (error) {
    console.error('Error fetching promo code usage:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promo code usage' },
      { status: 500 }
    )
  }
}
