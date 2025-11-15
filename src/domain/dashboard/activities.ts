import { prisma } from '@/lib/prisma'
import { deriveGenerationType } from '@/domain/generation/utils'
import { buildGenerationWhere, buildContextWhere } from '@/lib/prisma-helpers'

export interface Activity {
  id: string
  type: string
  user: string
  action: string
  time: Date
  status: string
  isOwn: boolean
  generationType?: 'personal' | 'team'
}

export interface PendingInvite {
  id: string
  email: string
  name: string
  sent: string
  status: string
  expiresAt: Date
}

/**
 * Transform a generation into an activity
 */
export function transformGenerationToActivity(
  generation: {
    id: string
    status: string
    createdAt: Date
    person: {
      firstName: string
      lastName: string | null
      teamId: string | null
      user?: { id: string } | null
    }
  },
  currentUserId: string
): Activity {
  const personName = generation.person.firstName + 
    (generation.person.lastName ? ` ${generation.person.lastName}` : '')
  
  const derivedGenerationType = deriveGenerationType(generation.person.teamId)
  
  return {
    id: `generation-${generation.id}`,
    type: 'generation',
    user: personName,
    action: generation.status === 'completed' ? 'generated new headshot' : 
            generation.status === 'processing' ? 'is processing headshot' :
            'uploaded photo for review',
    time: generation.createdAt,
    status: generation.status === 'completed' ? 'completed' : 
            generation.status === 'processing' ? 'processing' : 'pending',
    isOwn: generation.person.user?.id === currentUserId,
    generationType: derivedGenerationType
  }
}

/**
 * Transform a team invite into an activity
 */
export function transformInviteToActivity(
  invite: {
    id: string
    email: string
    usedAt: Date | null
    createdAt: Date
  }
): Activity {
  return {
    id: `invite-${invite.id}`,
    type: 'invitation',
    user: invite.email,
    action: invite.usedAt ? 'joined the team' : 'invited to join team',
    time: invite.usedAt || invite.createdAt,
    status: invite.usedAt ? 'completed' : 'pending',
    isOwn: false
  }
}

/**
 * Transform a context into an activity
 */
export function transformContextToActivity(
  context: {
    id: string
    name: string
    createdAt: Date
  }
): Activity {
  return {
    id: `context-${context.id}`,
    type: 'template',
    user: 'You',
    action: `created new template "${context.name}"`,
    time: context.createdAt,
    status: 'completed',
    isOwn: true
  }
}

/**
 * Fetch user activities (generations, invites, contexts)
 * @param userId - The user ID
 * @param teamId - Optional team ID (null for personal-only)
 * @param limit - Maximum number of activities to return
 * @param isTeamAdmin - Whether user is a team admin
 * @returns Array of activities sorted by time (most recent first)
 */
export async function fetchUserActivities(
  userId: string,
  teamId: string | null,
  limit: number = 10,
  isTeamAdmin: boolean = false
): Promise<Activity[]> {
  const activities: Activity[] = []

  // Fetch all activity data in parallel
  const [recentGenerations, recentInvites, recentContexts] = await Promise.all([
    // Get recent generations
    prisma.generation.findMany({
      where: buildGenerationWhere(userId, teamId),
      include: {
        person: {
          select: {
            firstName: true,
            lastName: true,
            teamId: true,
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
    isTeamAdmin && teamId
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
      where: buildContextWhere(userId, teamId),
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    })
  ])

  // Transform generations to activities
  for (const generation of recentGenerations) {
    activities.push(transformGenerationToActivity(generation, userId))
  }

  // Transform invites to activities
  for (const invite of recentInvites) {
    activities.push(transformInviteToActivity(invite))
  }

  // Transform contexts to activities
  for (const context of recentContexts) {
    activities.push(transformContextToActivity(context))
  }

  // Sort all activities by time and take the most recent
  return activities
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, limit)
}

/**
 * Fetch pending team invites
 * @param teamId - The team ID
 * @returns Array of pending invites with createdAt for formatting
 */
export async function fetchPendingInvites(teamId: string): Promise<Array<PendingInvite & { createdAt: Date }>> {
  const pendingTeamInvites = await prisma.teamInvite.findMany({
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

  return pendingTeamInvites.map(invite => ({
    id: invite.id,
    email: invite.email,
    name: invite.email.split('@')[0], // Use email prefix as name
    sent: '', // Will be formatted by caller using formatTimeAgo
    status: 'pending',
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt
  }))
}

