import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'
import { getEffectiveTeamCreditBalance } from '@/domain/credits/credits'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'individual', 'team', or 'both' (default)

    // OPTIMIZATION: When fetching both or when type is not specified, fetch both balances
    // and share the User + Person query to reduce database queries
    if (!type || type === 'both') {
      // Fetch user with person data once (shared for both calculations)
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          person: {
            select: { teamId: true }
          }
        }
      })
      
      const teamId = user?.person?.teamId || null

      // OPTIMIZATION: Fetch both balances in parallel
      const [individualBalance, teamBalance] = await Promise.all([
        // Get individual credits for the user (only credits with planTier='individual' or no planTier)
        prisma.creditTransaction.aggregate({
          where: {
            userId: session.user.id,
            OR: [
              { planTier: { in: ['individual', 'try_once'] } },
              { planTier: null }
            ]
          },
          _sum: { credits: true }
        }).then(result => result._sum.credits || 0),
        // Get effective team credits (uses centralized function)
        getEffectiveTeamCreditBalance(session.user.id, teamId)
      ])
      
      return NextResponse.json({ 
        individual: individualBalance,
        team: teamBalance
      })
    } else if (type === 'individual') {
      // Get individual credits for the user (only credits with planTier='individual' or no planTier)
      // For individual credits, only count credits that are NOT pro tier
      const result = await prisma.creditTransaction.aggregate({
        where: {
          userId: session.user.id,
          OR: [
            { planTier: { in: ['individual', 'try_once'] } },
            { planTier: null }
          ]
        },
        _sum: { credits: true }
      })
      
      return NextResponse.json({ balance: result._sum.credits || 0 })
    } else if (type === 'team') {
      // Get effective team credits (uses centralized function)
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          person: {
            select: { teamId: true }
          }
        }
      })
      
      const teamId = user?.person?.teamId || null
      const balance = await getEffectiveTeamCreditBalance(session.user.id, teamId)
      
      return NextResponse.json({ balance })
    } else {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    Logger.error('Error fetching credit balance', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
