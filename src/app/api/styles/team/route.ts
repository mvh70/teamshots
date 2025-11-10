import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'


export const runtime = 'nodejs'
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's team information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: {
              include: {
                contexts: {
                  where: { 
                    teamId: { not: null },
                    userId: null // Only team contexts
                  },
                  orderBy: { createdAt: 'desc' }
                },
                activeContext: true
              }
            }
          }
        }
      }
    })

    const teamId = (user as { person?: { team?: { id: string } } })?.person?.team?.id || null

    if (!teamId) {
      return NextResponse.json({ 
        error: 'User is not part of a team',
        contexts: [],
        activeContext: null,
        contextType: 'team'
      })
    }

    // Return team contexts
    const teamData = (user as { person?: { team?: { contexts: unknown[]; activeContext: unknown } } })?.person?.team
    const teamContexts = (teamData as { contexts: unknown[] }).contexts || []
    const teamActive = (teamData as { activeContext: unknown }).activeContext || null

    return NextResponse.json({
      contexts: teamContexts,
      activeContext: teamActive,
      contextType: 'team'
    })

  } catch (error) {
    Logger.error('Error fetching team contexts', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
