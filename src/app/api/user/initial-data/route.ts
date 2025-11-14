import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { UserService } from '@/domain/services/UserService'
import { CreditService } from '@/domain/services/CreditService'
import { getTeamOnboardingState } from '@/domain/team/onboarding'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

/**
 * Consolidated endpoint for initial user data after registration/login
 * Returns all data needed by the frontend in a single request to minimize database calls
 */
export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch all user context data in parallel
    const [userContext, creditBalance, userWithLocale, personData] = await Promise.all([
      UserService.getUserContext(userId),
      CreditService.getCreditBalanceSummary(userId),
      // Get user locale directly from database
      prisma.user.findUnique({
        where: { id: userId },
        select: { locale: true }
      }),
      // Get person data with lastName and email
      prisma.person.findUnique({
        where: { userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          teamId: true,
          team: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    ])

    const { user, roles, subscription, onboarding, teamId } = userContext
    const teamName = personData?.team?.name || user.person?.team?.name || null
    const isFirstVisit = UserService.isFirstTimeVisitor(user)

    // Get dashboard stats (only if needed - can be lazy loaded)
    const teamOnboardingState = await getTeamOnboardingState({
      isTeamAdmin: roles.isTeamAdmin,
      teamId: teamId || undefined,
    })

    // Get basic counts (minimal queries)
    const [generationsCount, contextsCount, creditsUsedResult] = await Promise.all([
      prisma.generation.count({
        where: {
          OR: [
            { person: { userId } },
            ...(teamId ? [{ person: { teamId } }] : [])
          ]
        }
      }),
      prisma.context.count({
        where: {
          OR: [
            { userId },
            ...(teamId ? [{ teamId }] : [])
          ]
        }
      }),
      prisma.generation.aggregate({
        where: {
          OR: [
            { person: { userId } },
            ...(teamId ? [{ person: { teamId } }] : [])
          ]
        },
        _sum: { creditsUsed: true }
      })
    ])

    // Get team members count (only if team admin)
    let teamMembersCount = 0
    if (roles.isTeamAdmin && teamId) {
      teamMembersCount = await prisma.person.count({
        where: { teamId }
      })
    }

    return NextResponse.json({
      success: true,
      // User context
      user: {
        id: user.id,
        email: user.email,
        locale: userWithLocale?.locale || 'en',
      },
      person: personData ? {
        id: personData.id,
        firstName: personData.firstName,
        lastName: personData.lastName,
        email: personData.email,
        teamId: personData.teamId,
      } : null,
      // Roles
      roles: {
        isTeamAdmin: roles.isTeamAdmin,
        isTeamMember: roles.isTeamMember,
        isRegularUser: roles.isRegularUser,
        isPlatformAdmin: roles.isPlatformAdmin,
        teamId,
        teamName,
      },
      // Subscription
      subscription: subscription ? {
        tier: subscription.tier,
        period: subscription.period,
        status: subscription.status,
      } : null,
      // Credits
      credits: {
        individual: creditBalance.individual,
        team: creditBalance.team,
      },
      // Dashboard stats
      stats: {
        photosGenerated: generationsCount,
        activeTemplates: contextsCount,
        creditsUsed: creditsUsedResult._sum.creditsUsed || 0,
        teamMembers: teamMembersCount,
        pendingInvites: teamOnboardingState.pendingInviteCount,
      },
      // Onboarding
      onboarding: {
        ...onboarding,
        needsTeamSetup: teamOnboardingState.needsTeamSetup,
        needsPhotoStyleSetup: teamOnboardingState.needsPhotoStyleSetup,
        needsTeamInvites: teamOnboardingState.needsTeamInvites,
        nextTeamOnboardingStep: teamOnboardingState.nextStep,
        isFirstVisit,
      },
    })
  } catch (error) {
    Logger.error('Error fetching initial user data', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

