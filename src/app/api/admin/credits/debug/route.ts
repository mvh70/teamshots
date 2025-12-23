import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserCreditBalance, getEffectiveTeamCreditBalance } from '@/domain/credits/credits'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const userEmail = searchParams.get('email')

    if (!userId && !userEmail) {
      return NextResponse.json({ error: 'userId or email parameter required' }, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: userId ? { id: userId } : { email: userEmail! },
      include: {
        person: {
          include: {
            team: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all credit transactions
    const allTransactions = await prisma.creditTransaction.findMany({
      where: {
        OR: [
          { userId: user.id },
          { personId: user.person?.id },
          { teamId: user.person?.teamId }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate balances
    const individualBalance = await getUserCreditBalance(user.id)
    const teamBalance = user.person?.teamId 
      ? await getEffectiveTeamCreditBalance(user.id, user.person.teamId)
      : 0

    // Group transactions by type
    type Transaction = typeof allTransactions[number];
    const transactionsByType = allTransactions.reduce((acc: Record<string, Transaction[]>, tx: Transaction) => {
      const key = `${tx.type}_${tx.userId ? 'user' : tx.teamId ? 'team' : 'person'}`
      if (!acc[key]) acc[key] = []
      acc[key].push(tx)
      return acc
    }, {} as Record<string, Transaction[]>)

    // Calculate sums by type
    const sumsByType = Object.entries(transactionsByType).reduce((acc, [key, txs]) => {
      acc[key] = txs.reduce((sum, tx) => sum + tx.credits, 0)
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        planTier: user.planTier,
        planPeriod: user.planPeriod,
        hasPerson: !!user.person,
        personId: user.person?.id,
        teamId: user.person?.teamId,
        teamName: user.person?.team?.name
      },
      balances: {
        individual: individualBalance,
        team: teamBalance,
        total: individualBalance + teamBalance
      },
      transactionSummary: {
        totalTransactions: allTransactions.length,
        sumsByType,
        transactionsByType: Object.entries(transactionsByType).reduce((acc, [key, txs]) => {
          acc[key] = txs.length
          return acc
        }, {} as Record<string, number>)
      },
      transactions: allTransactions.map(tx => ({
        id: tx.id,
        credits: tx.credits,
        type: tx.type,
        description: tx.description,
        userId: tx.userId,
        personId: tx.personId,
        teamId: tx.teamId,
        planTier: tx.planTier,
        planPeriod: tx.planPeriod,
        createdAt: tx.createdAt
      }))
    })
  } catch (error) {
    Logger.error('Error debugging credits', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

