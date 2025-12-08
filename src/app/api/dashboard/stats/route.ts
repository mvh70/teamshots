import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { UserService } from '@/domain/services/UserService'
import { Logger } from '@/lib/logger'
import { getTeamOnboardingState } from '@/domain/team/onboarding'


export const runtime = 'nodejs'
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // OPTIMIZATION: Use UserService for consolidated user context fetching
    const userContext = await UserService.getUserContext(session.user.id)
    const { user, roles } = userContext
    const teamId = user.person?.teamId
    const teamName = user.person?.team?.name || null
    const isFirstVisit = UserService.isFirstTimeVisitor(user)

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
      pendingInvites: 0
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

    // Get active photo styles (contexts) count
    // In team mode: only count team contexts (teamId matches)
    // In personal mode: only count personal contexts (userId matches, teamId is null)
    const contextsCount = await prisma.context.count({
      where: teamId
        ? {
            // Team mode: only team contexts
            teamId: teamId
          }
        : {
            // Personal mode: only personal contexts
            userId: session.user.id,
            teamId: null
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

    const onboardingState = await getTeamOnboardingState({
      isTeamAdmin: roles.isTeamAdmin,
      teamId,
      teamName,
      prefetchedMemberCount: typeof stats.teamMembers === 'number' ? stats.teamMembers : undefined
    })
    stats.pendingInvites = onboardingState.pendingInviteCount

    return NextResponse.json({
      success: true,
      stats,
      userRole: {
        isTeamAdmin: roles.isTeamAdmin,
        isTeamMember: roles.isTeamMember,
        isRegularUser: roles.isRegularUser,
        teamId: teamId,
        teamName: teamName,
        needsTeamSetup: onboardingState.needsTeamSetup,
        needsPhotoStyleSetup: onboardingState.needsPhotoStyleSetup,
        needsTeamInvites: onboardingState.needsTeamInvites,
        nextTeamOnboardingStep: onboardingState.nextStep,
        isFirstVisit: isFirstVisit
      }
    })

  } catch (error) {
    Logger.error('Error fetching dashboard stats', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
