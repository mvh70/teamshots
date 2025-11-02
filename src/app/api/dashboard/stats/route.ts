import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserWithRoles, getUserEffectiveRoles } from '@/domain/access/roles'
import { Logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserWithRoles(session.user.id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const roles = await getUserEffectiveRoles(user)
    const teamId = user.person?.teamId
    const teamName = user.person?.team?.name || null

    // Get user's creation date to determine if this is their first visit
    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { createdAt: true }
    })
    
    // Consider it a first visit if account was created within the last 2 hours
    const isFirstVisit = userRecord?.createdAt 
      ? new Date().getTime() - userRecord.createdAt.getTime() < 2 * 60 * 60 * 1000
      : false

    // Base stats for all users
    const stats: {
      photosGenerated: number
      activeTemplates: number
      creditsUsed: number
      teamMembers?: number
      pendingInvites?: number
    } = {
      photosGenerated: 0,
      activeTemplates: 0,
      creditsUsed: 0,
      teamMembers: 0, // Only relevant for team admins
    }

    // Get user's generations count
    const generationsCount = await prisma.generation.count({
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
      }
    })

    stats.photosGenerated = generationsCount

    // Get active templates (contexts) count
    const contextsCount = await prisma.context.count({
      where: {
        OR: [
          // Personal contexts
          { userId: session.user.id },
          // Team contexts (if user is part of a team)
          ...(teamId ? [{ teamId }] : [])
        ]
      }
    })

    stats.activeTemplates = contextsCount

    // Get credits used from generations
    const creditsUsedResult = await prisma.generation.aggregate({
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
      _sum: {
        creditsUsed: true
      }
    })

    stats.creditsUsed = creditsUsedResult._sum.creditsUsed || 0

    // Get team members count (only for team admins)
    if (roles.isTeamAdmin && teamId) {
      const teamMembersCount = await prisma.person.count({
        where: {
          teamId: teamId
        }
      })
      stats.teamMembers = teamMembersCount
    }

    return NextResponse.json({
      success: true,
      stats,
      userRole: {
        isTeamAdmin: roles.isTeamAdmin,
        isTeamMember: roles.isTeamMember,
        isRegularUser: roles.isRegularUser,
        teamId: teamId,
        teamName: teamName,
        needsTeamSetup: roles.isTeamAdmin && !teamId,
        isFirstVisit: isFirstVisit
      }
    })

  } catch (error) {
    Logger.error('Error fetching dashboard stats', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
