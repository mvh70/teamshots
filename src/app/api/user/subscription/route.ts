import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getUserSubscription } from '@/domain/subscription/subscription'
import { getTeamSeatInfo } from '@/domain/pricing/seats'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'


export const runtime = 'nodejs'
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const subscription = await getUserSubscription(session.user.id)
    
    // Fetch seat info - User owns teams via the teams relation (as admin)
    let seatInfo = null
    
    // Check if user owns a team (is admin)
    const ownedTeam = await prisma.team.findFirst({
      where: { adminId: session.user.id },
      select: { id: true }
    })

    if (ownedTeam) {
      seatInfo = await getTeamSeatInfo(ownedTeam.id)
    }
    
    return NextResponse.json({ subscription, seatInfo })
  } catch (error) {
    Logger.error('Error fetching subscription', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
