import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'
import { prisma } from '@/lib/prisma'
import { UserService } from '@/domain/services/UserService'
import { Logger } from '@/lib/logger'
import { getTeamOnboardingState } from '@/domain/team/onboarding'
import { deriveGenerationType } from '@/domain/generation/utils'

// OPTIMIZATION: Simple in-memory cache for dashboard stats (30 second TTL)
const statsCache = new Map<string, { data: unknown; timestamp: number }>()
const STATS_CACHE_TTL = 30 * 1000 // 30 seconds

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // OPTIMIZATION: Use shared UserService.getUserContext to get all user data in one call
    const userContext = await UserService.getUserContext(session.user.id)

    // OPTIMIZATION: Check cache first (only for stats, not for activities/invites which change frequently)
    const cacheKey = `dashboard-stats-${session.user.id}`
    const cached = statsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < STATS_CACHE_TTL) {
      Logger.debug('dashboard.stats.cache.hit', { userId: session.user.id })

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

      const onboardingState = await getTeamOnboardingState({
        isTeamAdmin: userContext.roles.isTeamAdmin,
        teamId,
        prefetchedMemberCount: typeof cachedData.stats.teamMembers === 'number' ? cachedData.stats.teamMembers : undefined,
        prefetchedPendingInviteCount: pendingInviteCountFromCache
      })

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
          isFirstVisit: isFirstVisit
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
    // OPTIMIZATION: Simplify WHERE conditions when teamId is null (avoid unnecessary OR)
    const [generationsCount, contextsCount, creditsUsedResult, teamMembersCount] = await Promise.all([
      // Get user's generations count
      prisma.generation.count({
        where: teamId
          ? {
              OR: [
                // Personal generations
                { 
                  person: { 
                    userId: session.user.id 
                  } 
                },
                // Team generations
                {
                  person: {
                    teamId: teamId
                  }
                }
              ]
            }
          : {
              // When no team, use simple condition (no OR needed)
              person: { 
                userId: session.user.id 
              }
            }
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
              userId: session.user.id,
              teamId: null
            }
      }),
      // Get credits used from generations
      prisma.generation.aggregate({
        where: teamId
          ? {
              OR: [
                // Personal generations
                { 
                  person: { 
                    userId: session.user.id 
                  } 
                },
                // Team generations
                {
                  person: {
                    teamId: teamId
                  }
                }
              ]
            }
          : {
              // When no team, use simple condition (no OR needed)
              person: { 
                userId: session.user.id 
              }
            },
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

    // Build activities array (only for team admins)
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

    // Build pending invites array (only for team admins)
    let pendingInvites: Array<{
      id: string
      email: string
      name: string
      sent: string
      status: string
      expiresAt: Date
    }> = []
    let pendingTeamInvitesCount = 0

    // OPTIMIZATION: Only fetch activity and invites if user is team admin
    if (userContext.roles.isTeamAdmin) {
      // Fetch activity and pending invites in parallel
      const [recentGenerations, recentInvites, recentContexts, pendingTeamInvites] = await Promise.all([
        // Get recent generations
        prisma.generation.findMany({
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
                teamId: true, // Needed to derive generationType
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
        }),
        // Get recent team invites (only for team admins)
        teamId
          ? prisma.teamInvite.findMany({
              where: {
                teamId: teamId
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 5
            })
          : Promise.resolve([]),
        // Get recent context creations
        prisma.context.findMany({
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
        }),
        // Get pending team invites
        userContext.roles.isTeamAdmin && teamId
          ? prisma.teamInvite.findMany({
              where: {
                teamId: teamId,
                usedAt: null, // Only pending invites
                expiresAt: {
                  gt: new Date() // Not expired
                }
              },
              orderBy: {
                createdAt: 'desc'
              }
            })
          : Promise.resolve([])
      ])

      pendingTeamInvitesCount = pendingTeamInvites.length

      // Convert generations to activities
      for (const generation of recentGenerations) {
        const personName = generation.person.firstName + 
          (generation.person.lastName ? ` ${generation.person.lastName}` : '')
        
        // Derive generationType from person.teamId (single source of truth)
        const derivedGenerationType = deriveGenerationType(generation.person.teamId)
        
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
          generationType: derivedGenerationType // Derived from person.teamId, not stored field
        })
      }

      // Convert team invites to activities
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

      // Convert contexts to activities
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

      // Format pending invites
      pendingInvites = pendingTeamInvites.map(invite => ({
        id: invite.id,
        email: invite.email,
        name: invite.email.split('@')[0], // Use email prefix as name
        sent: formatTimeAgo(invite.createdAt),
        status: 'pending',
        expiresAt: invite.expiresAt
      }))

      // Sort all activities by time and take the most recent 10
      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      activities.splice(10)
    }

    const onboardingState = await getTeamOnboardingState({
      isTeamAdmin: userContext.roles.isTeamAdmin,
      teamId,
      prefetchedMemberCount: teamMembersCount,
      prefetchedPendingInviteCount: pendingTeamInvitesCount
    })

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
        isFirstVisit: isFirstVisit
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
}

