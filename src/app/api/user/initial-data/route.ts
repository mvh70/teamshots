import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-middleware'
import { internalError } from '@/lib/api/errors'
import { UserService } from '@/domain/services/UserService'
import { CreditService } from '@/domain/services/CreditService'
import { getTeamOnboardingState } from '@/domain/team/onboarding'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { buildGenerationWhere, buildContextWhere } from '@/lib/prisma-helpers'

/**
 * Consolidated endpoint for initial user data after registration/login
 * Returns all data needed by the frontend in a single request to minimize database calls
 */
export const runtime = 'nodejs'

export async function GET() {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    // Fetch all user context data in parallel
    // OPTIMIZATION: userContext already includes person data, so we only need to fetch locale separately
    const [userContext, creditBalance, userWithLocale] = await Promise.all([
      UserService.getUserContext(userId),
      CreditService.getCreditBalanceSummary(userId),
      // Get user locale directly from database (not included in UserWithRoles type yet)
      prisma.user.findUnique({
        where: { id: userId },
        select: { locale: true }
      })
    ])

    // Parse completed tours from Person.onboardingState
    let completedTours: string[] = []
    if (userContext.person?.onboardingState) {
      try {
        const parsed = JSON.parse(userContext.person.onboardingState)
        if (parsed.completedTours && Array.isArray(parsed.completedTours)) {
          completedTours = parsed.completedTours
        }
      } catch {
        // If parsing fails, treat as empty (old format or invalid JSON)
      }
    }

    const { user, roles, subscription, onboarding, teamId, person } = userContext
    const teamName = person?.team?.name || user.person?.team?.name || null
    const isFirstVisit = UserService.isFirstTimeVisitor(user)

    // Get dashboard stats (only if needed - can be lazy loaded)
    const teamOnboardingState = await getTeamOnboardingState({
      isTeamAdmin: roles.isTeamAdmin,
      teamId: teamId || undefined,
    })

    // Get basic counts (minimal queries) - use query helpers for consistency
    const [generationsCount, contextsCount, creditsUsedResult] = await Promise.all([
      prisma.generation.count({
        where: buildGenerationWhere(userId, teamId)
      }),
      prisma.context.count({
        where: buildContextWhere(userId, teamId)
      }),
      prisma.generation.aggregate({
        where: buildGenerationWhere(userId, teamId),
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
      person: person ? {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        teamId: person.teamId,
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
        person: creditBalance.person,
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
        completedTours, // Include completed tours from database
      },
    })
  } catch (error) {
    Logger.error('Error fetching initial user data', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return internalError('Failed to fetch initial user data')
  }
}

