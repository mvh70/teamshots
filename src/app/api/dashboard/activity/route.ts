import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserWithRoles, getUserEffectiveRoles } from '@/domain/access/roles'
import { getUserSubscription } from '@/domain/subscription/subscription'
import { Logger } from '@/lib/logger'


export const runtime = 'nodejs'
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // OPTIMIZATION: Fetch subscription in parallel with user to avoid duplicate queries
    const [user, subscription] = await Promise.all([
      getUserWithRoles(session.user.id),
      getUserSubscription(session.user.id)
    ])
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Pass subscription to avoid duplicate query
    const roles = await getUserEffectiveRoles(user, subscription)
    
    // Only show activity for team admins
    if (!roles.isTeamAdmin) {
      return NextResponse.json({
        success: true,
        activities: []
      })
    }
    
    const teamId = user.person?.teamId

    const activities: Array<{
      id: string
      type: string
      user: string
      action: string
      time: Date
      status: string
      isOwn: boolean
      generationType?: 'personal' | 'team'
    }> = []

    // Get recent generations
    const recentGenerations = await prisma.generation.findMany({
      where: {
        OR: [
          // Personal generations
          { 
            person: { 
              userId: session.user.id 
            } 
          },
          // Team generations (if user is part of a team)
          ...(teamId ? [{
            person: {
              teamId: teamId
            }
          }] : [])
        ]
      },
      include: {
        person: {
          select: {
            firstName: true,
            lastName: true,
            user: {
              select: {
                id: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    // Convert generations to activities
    for (const generation of recentGenerations) {
      const personName = generation.person.firstName + 
        (generation.person.lastName ? ` ${generation.person.lastName}` : '')
      
      activities.push({
        id: `generation-${generation.id}`,
        type: 'generation',
        user: personName,
        action: generation.status === 'completed' ? 'generated new headshot' : 
                generation.status === 'processing' ? 'is processing headshot' :
                'uploaded photo for review',
        time: generation.createdAt,
        status: generation.status === 'completed' ? 'completed' : 
                generation.status === 'processing' ? 'processing' : 'pending',
        isOwn: generation.person.user?.id === session.user.id,
        generationType: generation.generationType as 'personal' | 'team' | undefined
      })
    }

    // Get recent team invites (only for team admins)
    if (roles.isTeamAdmin && teamId) {
      const recentInvites = await prisma.teamInvite.findMany({
        where: {
          teamId: teamId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      })

      for (const invite of recentInvites) {
        activities.push({
          id: `invite-${invite.id}`,
          type: 'invitation',
          user: invite.email,
          action: invite.usedAt ? 'joined the team' : 'invited to join team',
          time: invite.usedAt || invite.createdAt,
          status: invite.usedAt ? 'completed' : 'pending',
          isOwn: false
        })
      }
    }

    // Get recent context creations
    const recentContexts = await prisma.context.findMany({
      where: {
        OR: [
          // Personal contexts
          { userId: session.user.id },
          // Team contexts (if user is part of a team)
          ...(teamId ? [{ teamId }] : [])
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    })

    for (const context of recentContexts) {
      activities.push({
        id: `context-${context.id}`,
        type: 'template',
        user: 'You',
        action: `created new template "${context.name}"`,
        time: context.createdAt,
        status: 'completed',
        isOwn: true
      })
    }

    // Sort all activities by time and take the most recent 10
    const sortedActivities = activities
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      activities: sortedActivities
    })

  } catch (error) {
    Logger.error('Error fetching dashboard activity', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
