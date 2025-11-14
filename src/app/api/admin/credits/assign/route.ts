import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createCreditTransaction } from '@/domain/credits/credits'
import { Logger } from '@/lib/logger'
import { z } from 'zod'

export const runtime = 'nodejs'

const assignCreditsSchema = z.object({
  userId: z.string().min(1),
  credits: z.number().int().positive(),
  description: z.string().optional(),
  type: z.enum(['purchase', 'refund']).default('purchase'),
  assignTo: z.enum(['individual', 'team']).default('individual')
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = assignCreditsSchema.parse(body)
    const { userId, credits, description, type, assignTo } = validatedData

    // Validate target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        person: {
          include: {
            team: true
          }
        }
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Determine where to assign credits
    let teamId: string | undefined = undefined
    let personId: string | undefined = undefined
    
    if (assignTo === 'team') {
      if (!targetUser.person?.teamId) {
        return NextResponse.json({ 
          error: 'User is not part of a team. Cannot assign team credits.' 
        }, { status: 400 })
      }
      teamId = targetUser.person.teamId
    } else {
      // Individual credits - assign to userId
      personId = targetUser.person?.id
    }

    // Get plan tier and period for the transaction
    const planTier = targetUser.planTier || null
    const planPeriod = targetUser.planPeriod || null

    // Create credit transaction
    const transaction = await createCreditTransaction({
      credits,
      type: type as 'purchase' | 'refund',
      description: description || `Admin assigned ${credits} credits (${assignTo})`,
      userId: assignTo === 'individual' ? userId : undefined, // Only set userId for individual credits
      teamId: assignTo === 'team' ? teamId : undefined,
      personId: personId
    })

    // Update planTier and planPeriod on the transaction if needed
    if (planTier || planPeriod) {
      await prisma.creditTransaction.update({
        where: { id: transaction.id },
        data: {
          planTier: planTier || undefined,
          planPeriod: planPeriod || undefined
        }
      })
    }

    Logger.info('Admin assigned credits', {
      adminUserId: session.user.id,
      targetUserId: userId,
      credits,
      type,
      assignTo,
      transactionId: transaction.id,
      teamId,
      personId
    })

    // Get updated balance
    const { getUserCreditBalance, getEffectiveTeamCreditBalance } = await import('@/domain/credits/credits')
    const individualBalance = await getUserCreditBalance(userId)
    const teamBalance = targetUser.person?.teamId 
      ? await getEffectiveTeamCreditBalance(userId, targetUser.person.teamId)
      : 0

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        credits: transaction.credits,
        type: transaction.type,
        createdAt: transaction.createdAt
      },
      balances: {
        individual: individualBalance,
        team: teamBalance
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 })
    }
    
    Logger.error('Error assigning credits', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

