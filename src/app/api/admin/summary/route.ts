import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Admin-only summary statistics endpoint
export async function GET() {
  try {
    const session = await auth()

    // Check if user is admin
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Run all queries in parallel for performance
    const [
      totalUsers,
      totalTeamInvites,
      creditsPurchased,
      creditsUsed,
      paidUsers,
      activeTeams
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Total team invites sent
      prisma.teamInvite.count(),
      
      // Total credits purchased (sum of 'purchase' type transactions)
      prisma.creditTransaction.aggregate({
        _sum: { credits: true },
        where: {
          type: { in: ['purchase', 'subscription', 'top_up', 'free_trial'] }
        }
      }),
      
      // Total credits used (sum from generations)
      prisma.generation.aggregate({
        _sum: { creditsUsed: true },
        where: {
          status: { in: ['completed', 'processing'] }
        }
      }),
      
      // Paid users (users with active subscription)
      prisma.user.count({
        where: {
          subscriptionStatus: 'active'
        }
      }),
      
      // Active teams count
      prisma.team.count()
    ])

    // Calculate accepted invites (invites that were used)
    const acceptedInvites = await prisma.teamInvite.count({
      where: {
        usedAt: { not: null }
      }
    })

    return NextResponse.json({
      totalUsers,
      paidUsers,
      totalTeamInvites,
      acceptedInvites,
      activeTeams,
      creditsPurchased: creditsPurchased._sum.credits || 0,
      creditsUsed: creditsUsed._sum.creditsUsed || 0,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to fetch admin summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch summary data' },
      { status: 500 }
    )
  }
}

