import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-middleware'
import { internalError } from '@/lib/api/errors'

export const runtime = 'nodejs'
import { prisma } from '@/lib/prisma'
import { UserService } from '@/domain/services/UserService'
import { Logger } from '@/lib/logger'
import { getTeamOnboardingState } from '@/domain/team/onboarding'
import { buildGenerationWhere } from '@/lib/prisma-helpers'
import { fetchUserActivities, fetchPendingInvites } from '@/domain/dashboard/activities'
import { formatTimeAgo } from '@/lib/format-time'
import { getTeamSeatInfo } from '@/domain/pricing/seats'

// OPTIMIZATION: Simple in-memory cache for dashboard stats (30 second TTL)
const statsCache = new Map<string, { data: unknown; timestamp: number }>()
const STATS_CACHE_TTL = 30 * 1000 // 30 seconds

export async function GET() {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    // OPTIMIZATION: Use shared UserService.getUserContext to get all user data in one call
    const userContext = await UserService.getUserContext(userId)

    // OPTIMIZATION: Check cache first (only for stats, not for activities/invites which change frequently)
    const cacheKey = `dashboard-stats-${userId}`
    const cached = statsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < STATS_CACHE_TTL) {
      Logger.debug('dashboard.stats.cache.hit', { userId })

      // Use pre-fetched user context data
      const teamId = userContext.teamId
      const teamName = userContext.user.person?.team?.name || null

      const isFirstVisit = userContext.user.createdAt
        ? new Date().getTime() - userContext.user.createdAt.getTime() < 2 * 60 * 60 * 1000
        : false

      // Return cached stats with fresh userRole
      const cachedData = cached.data as {
        stats: {
          photosGenerated: number
          activeTemplates: number
          creditsUsed: number
          teamMembers: number
          pendingInvites?: number
        }
        activities: Array<{
          id: string
          type: string
          user: string
          action: string
          time: Date
          status: string
          isOwn: boolean
          generationType?: 'personal' | 'team'
        }>
        pendingInvites: Array<{
          id: string
          email: string
          name: string
          sent: string
          status: string
          expiresAt: Date
        }>
      }

      const pendingInviteCountFromCache = Array.isArray(cachedData.pendingInvites)
        ? cachedData.pendingInvites.length
        : 0

      const [onboardingState, seatInfo] = await Promise.all([
        getTeamOnboardingState({
          isTeamAdmin: userContext.roles.isTeamAdmin,
          teamId,
          prefetchedMemberCount: typeof cachedData.stats.teamMembers === 'number' ? cachedData.stats.teamMembers : undefined,
          prefetchedPendingInviteCount: pendingInviteCountFromCache
        }),
        teamId ? getTeamSeatInfo(teamId) : Promise.resolve(null)
      ])

      return NextResponse.json({
        success: true,
        stats: {
          ...cachedData.stats,
          pendingInvites: pendingInviteCountFromCache
        },
        userRole: {
          isTeamAdmin: userContext.roles.isTeamAdmin,
          isTeamMember: userContext.roles.isTeamMember,
          isRegularUser: userContext.roles.isRegularUser,
          teamId: teamId,
          teamName: teamName,
          needsTeamSetup: onboardingState.needsTeamSetup,
          needsPhotoStyleSetup: onboardingState.needsPhotoStyleSetup,
          needsTeamInvites: onboardingState.needsTeamInvites,
          nextTeamOnboardingStep: onboardingState.nextStep,
          isFirstVisit: isFirstVisit,
          isSeatsBasedTeam: seatInfo?.isSeatsModel ?? false
        },
        activities: cachedData.activities,
        pendingInvites: cachedData.pendingInvites
      })
    }

    // OPTIMIZATION: User context already fetched above, use it here
    const teamId = userContext.teamId
    const teamName = userContext.user.person?.team?.name || null

    // OPTIMIZATION: Use createdAt from user context (already fetched)
    // Consider it a first visit if account was created within the last 2 hours
    const isFirstVisit = userContext.user.createdAt
      ? new Date().getTime() - userContext.user.createdAt.getTime() < 2 * 60 * 60 * 1000
      : false

    // Build base stats object
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

    // OPTIMIZATION: Run all stats queries in parallel
    // OPTIMIZATION: Use query helpers for consistent WHERE conditions
    const [generationsCount, contextsCount, creditsUsedResult, teamMembersCount] = await Promise.all([
      // Get user's generations count
      prisma.generation.count({
        where: buildGenerationWhere(userId, teamId)
      }),
      // Get active photo styles (contexts) count
      // In team mode: only count team contexts (teamId matches)
      // In personal mode: only count personal contexts (userId matches, teamId is null)
      prisma.context.count({
        where: teamId
          ? {
              // Team mode: only team contexts
              teamId: teamId
            }
          : {
              // Personal mode: only personal contexts
              userId: userId,
              teamId: null
            }
      }),
      // Get credits used from generations
      prisma.generation.aggregate({
        where: buildGenerationWhere(userId, teamId),
        _sum: {
          creditsUsed: true
        }
      }),
      // Get team members count (only for team admins)
      userContext.roles.isTeamAdmin && teamId
        ? prisma.person.count({
            where: {
              teamId: teamId
            }
          })
        : Promise.resolve(0)
    ])

    stats.photosGenerated = generationsCount
    stats.activeTemplates = contextsCount
    stats.creditsUsed = creditsUsedResult._sum.creditsUsed || 0
    stats.teamMembers = teamMembersCount

    // OPTIMIZATION: Only fetch activity and invites if user is team admin
    let activities: Array<{
      id: string
      type: string
      user: string
      action: string
      time: Date
      status: string
      isOwn: boolean
      generationType?: 'personal' | 'team'
    }> = []

    let pendingInvites: Array<{
      id: string
      email: string
      name: string
      sent: string
      status: string
      expiresAt: Date
    }> = []
    let pendingTeamInvitesCount = 0

    if (userContext.roles.isTeamAdmin) {
      // Use shared activity fetching logic
      activities = await fetchUserActivities(userId, teamId, 10, true)

      // Fetch pending invites
      if (teamId) {
        const pendingTeamInvites = await fetchPendingInvites(teamId)
        pendingTeamInvitesCount = pendingTeamInvites.length
        type PendingInvite = typeof pendingTeamInvites[number];
        pendingInvites = pendingTeamInvites.map((invite: PendingInvite) => ({
          ...invite,
          sent: formatTimeAgo(invite.expiresAt) // Format using shared utility
        }))
      }
    }

    const [onboardingState, seatInfo] = await Promise.all([
      getTeamOnboardingState({
        isTeamAdmin: userContext.roles.isTeamAdmin,
        teamId,
        prefetchedMemberCount: teamMembersCount,
        prefetchedPendingInviteCount: pendingTeamInvitesCount
      }),
      teamId ? getTeamSeatInfo(teamId) : Promise.resolve(null)
    ])

    const responseData = {
      success: true,
      stats: {
        ...stats,
        pendingInvites: pendingTeamInvitesCount
      },
      userRole: {
        isTeamAdmin: userContext.roles.isTeamAdmin,
        isTeamMember: userContext.roles.isTeamMember,
        isRegularUser: userContext.roles.isRegularUser,
        teamId: teamId,
        teamName: teamName,
        needsTeamSetup: onboardingState.needsTeamSetup,
        needsPhotoStyleSetup: onboardingState.needsPhotoStyleSetup,
        needsTeamInvites: onboardingState.needsTeamInvites,
        nextTeamOnboardingStep: onboardingState.nextStep,
        isFirstVisit: isFirstVisit,
        isSeatsBasedTeam: seatInfo?.isSeatsModel ?? false
      },
      activities,
      pendingInvites
    }

    // OPTIMIZATION: Cache stats (but not activities/invites which change frequently)
    // Only cache stats portion to allow fresh activities/invites on next request
    statsCache.set(cacheKey, {
      data: {
        stats,
        activities, // Cache these too for now, but could be excluded if needed
        pendingInvites
      },
      timestamp: Date.now()
    })

    // Clean up old cache entries (simple cleanup, runs every request but is fast)
    if (statsCache.size > 100) {
      const now = Date.now()
      for (const [key, value] of statsCache.entries()) {
        if (now - value.timestamp > STATS_CACHE_TTL) {
          statsCache.delete(key)
        }
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    Logger.error('Error fetching dashboard data', { error: error instanceof Error ? error.message : String(error) })
    return internalError('Failed to fetch dashboard data')
  }
}

