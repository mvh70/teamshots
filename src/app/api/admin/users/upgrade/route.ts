import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { upgradeUserPlan } from '@/domain/subscription/admin'
import { Logger } from '@/lib/logger'
import { z } from 'zod'

export const runtime = 'nodejs'

const upgradeSchema = z.object({
  userId: z.string().min(1),
  planTier: z.enum(['individual', 'pro']),
  planPeriod: z.enum(['small', 'large', 'seats']),
  seats: z.number().int().min(2).optional(),
  assignSeatToUser: z.boolean().default(true),
  reason: z.string().optional()
}).refine(
  (data) => {
    // If pro/seats, seats is required
    if (data.planTier === 'pro' && data.planPeriod === 'seats') {
      return data.seats !== undefined && data.seats >= 2
    }
    // If individual, period must be small or large
    if (data.planTier === 'individual') {
      return ['small', 'large'].includes(data.planPeriod)
    }
    return true
  },
  {
    message: 'Pro plan requires seats >= 2. Individual plan requires period: small or large.'
  }
)

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true, email: true }
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = upgradeSchema.parse(body)

    // Get target user info for logging
    const targetUser = await prisma.user.findUnique({
      where: { id: validatedData.userId },
      select: { id: true, email: true, planTier: true, planPeriod: true }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Log the admin action
    Logger.info('Admin initiating plan upgrade', {
      adminUserId: session.user.id,
      adminEmail: adminUser.email,
      targetUserId: validatedData.userId,
      targetEmail: targetUser.email,
      previousPlan: { tier: targetUser.planTier, period: targetUser.planPeriod },
      newPlan: { tier: validatedData.planTier, period: validatedData.planPeriod },
      seats: validatedData.seats,
      assignSeatToUser: validatedData.assignSeatToUser,
      reason: validatedData.reason
    })

    // Perform the upgrade
    const result = await upgradeUserPlan({
      userId: validatedData.userId,
      planTier: validatedData.planTier,
      planPeriod: validatedData.planPeriod,
      seats: validatedData.seats,
      assignSeatToUser: validatedData.assignSeatToUser,
      adminUserId: session.user.id,
      adminEmail: adminUser.email || 'admin',
      reason: validatedData.reason
    })

    if (!result.ok) {
      Logger.error('Admin plan upgrade failed', {
        error: result.error,
        adminUserId: session.user.id,
        targetUserId: validatedData.userId
      })
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      ...result.value
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    Logger.error('Error in admin plan upgrade', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
