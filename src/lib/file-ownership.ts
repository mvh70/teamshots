import { prisma } from '@/lib/prisma'
import { getUserEffectiveRoles, getUserWithRoles } from '@/domain/access/roles'
import { extendInviteExpiry } from '@/lib/invite-utils'

/**
 * File ownership record type
 */
export type OwnershipRecord =
  | { type: 'selfie'; personId: string | null; userId: string | null; teamId: string | null }
  | { type: 'generation'; personId: string | null; userId: string | null; teamId: string | null }
  | { type: 'context'; personId: null; userId: string | null; teamId: string | null; contextId: string | null }

/**
 * Find file ownership by checking selfie, generation, and context tables
 * Returns ownership record in priority order: selfie > generation > context
 */
export async function findFileOwnership(key: string): Promise<OwnershipRecord | null> {
  const trimmedKey = key.trim()

  if (!trimmedKey) {
    return null
  }

  // OPTIMIZATION: Run all three ownership queries in parallel
  const [selfie, generation, context] = await Promise.all([
    prisma.selfie.findFirst({
      where: {
        OR: [
          { key: trimmedKey },
          { processedKey: trimmedKey },
        ],
      },
      select: {
        personId: true,
        person: {
          select: {
            userId: true,
            teamId: true,
          },
        },
      },
    }),
    prisma.generation.findFirst({
      where: {
        OR: [
          { acceptedPhotoKey: trimmedKey },
          { generatedPhotoKeys: { has: trimmedKey } },
        ],
        deleted: false,
      },
      select: {
        personId: true,
        person: {
          select: {
            userId: true,
            teamId: true,
          },
        },
      },
    }),
    // Use raw SQL to query JSON fields efficiently
    // Settings use ElementSettings wrapper: { mode: '...', value: { logoKey: '...' } }
    // So paths are: settings.settings.branding.value.logoKey or settings.branding.value.logoKey
    prisma.$queryRaw<Array<{ id: string; userId: string | null; teamId: string | null }>>`
      SELECT "id", "userId", "teamId"
      FROM "Context"
      WHERE
        ("settings"->'settings'->'branding'->'value'->>'logoKey') = ${trimmedKey}
        OR ("settings"->'settings'->'background'->'value'->>'key') = ${trimmedKey}
        OR ("settings"->'branding'->'value'->>'logoKey') = ${trimmedKey}
        OR ("settings"->'background'->'value'->>'key') = ${trimmedKey}
      LIMIT 1
    `.then((results: Array<{ id: string; userId: string | null; teamId: string | null }>) => results[0] || null),
  ])

  // Return results in priority order: selfie > generation > context
  if (selfie) {
    return {
      type: 'selfie',
      personId: selfie.personId,
      userId: selfie.person?.userId ?? null,
      teamId: selfie.person?.teamId ?? null,
    }
  }

  if (generation) {
    return {
      type: 'generation',
      personId: generation.personId,
      userId: generation.person?.userId ?? null,
      teamId: generation.person?.teamId ?? null,
    }
  }

  if (context) {
    return {
      type: 'context',
      personId: null,
      userId: context.userId ?? null,
      teamId: context.teamId ?? null,
      contextId: context.id ?? null,
    }
  }

  return null
}

/**
 * Validate invite token and return person ID, team ID, and context ID if valid
 * Also extends invite expiry (sliding expiration) when token is valid
 * SECURITY: Validates token expiry to prevent access with expired invites
 */
export async function validateInviteToken(token: string | null): Promise<{ personId: string; teamId: string | null; contextId: string | null } | null> {
  if (!token) {
    return null
  }

  const invite = await prisma.teamInvite.findFirst({
    where: {
      token,
      usedAt: { not: null },
      // SECURITY: Validate invite has not expired
      expiresAt: { gt: new Date() },
    },
    include: {
      person: {
        select: {
          id: true,
          teamId: true,
        },
      },
    },
  })

  if (!invite?.person) {
    return null
  }

  // Extend invite expiry (sliding expiration) - don't await to avoid blocking
  extendInviteExpiry(invite.id).catch(() => {
    // Silently fail - expiry extension is best effort
  })

  return {
    personId: invite.person.id,
    teamId: invite.person.teamId,
    contextId: invite.contextId
  }
}

/**
 * Check if invite token authorizes access to file
 */
export function isInviteAuthorized(
  ownership: OwnershipRecord, 
  invitePersonId: string, 
  inviteTeamId: string | null, 
  inviteContextId: string | null,
  fileKey?: string
): boolean {
  // For selfies and generations, check personId match
  if (ownership.personId) {
    return ownership.personId === invitePersonId
  }

  // For context files (backgrounds/logos), check teamId match OR contextId match
  // The contextId match is important for cross-team contexts like freepackage
  // where the invite's context may not belong to the same team
  if (ownership.type === 'context') {
    // Allow if the file belongs to the context assigned to this invite
    if (ownership.contextId && inviteContextId && ownership.contextId === inviteContextId) {
      return true
    }
    // Also allow if the file belongs to a context owned by the same team
    if (ownership.teamId && inviteTeamId && ownership.teamId === inviteTeamId) {
      return true
    }
  }

  // Special case: Allow invited users to access background and logo files they've uploaded
  // even if not yet saved to a context (e.g., during style customization)
  if (fileKey && (fileKey.startsWith(`backgrounds/${invitePersonId}/`) || fileKey.startsWith(`logos/${invitePersonId}/`))) {
    return true
  }

  return false
}

/**
 * Check if session user is authorized to access file
 */
export function isSessionAuthorized(
  ownership: OwnershipRecord,
  user: Awaited<ReturnType<typeof getUserWithRoles>> | null,
  roles: Awaited<ReturnType<typeof getUserEffectiveRoles>> | null
): boolean {
  if (!user || !roles) {
    return false
  }

  if (roles.isPlatformAdmin) {
    return true
  }

  const userPersonId = user.person?.id ?? null
  const userTeamId = user.person?.teamId ?? null

  const sameUser = ownership.userId !== null && ownership.userId === user.id
  const samePerson = ownership.personId !== null && userPersonId !== null && ownership.personId === userPersonId
  const sameTeam = ownership.teamId !== null && userTeamId !== null && ownership.teamId === userTeamId

  switch (ownership.type) {
    case 'selfie':
      if (sameUser || samePerson) {
        return true
      }
      if (sameTeam && roles.isTeamAdmin) {
        return true
      }
      return false
    case 'generation':
      if (sameUser || samePerson) {
        return true
      }
      if (sameTeam && roles.isTeamAdmin) {
        return true
      }
      return false
    case 'context':
      if (sameUser) {
        return true
      }
      if (sameTeam && (roles.isTeamAdmin || roles.isTeamMember)) {
        return true
      }
      return false
    default:
      return false
  }
}

/**
 * Unified authorization check that handles both session and invite token authorization
 */
export function isFileAuthorized(
  ownership: OwnershipRecord,
  user: Awaited<ReturnType<typeof getUserWithRoles>> | null,
  roles: Awaited<ReturnType<typeof getUserEffectiveRoles>> | null,
  invitePersonId: string | null,
  inviteTeamId: string | null = null,
  inviteContextId: string | null = null,
  fileKey?: string,
  handoffPersonId?: string | null
): boolean {
  // Handoff token access - person can access their own selfies
  if (handoffPersonId && ownership.type === 'selfie' && ownership.personId === handoffPersonId) {
    return true
  }
  if (invitePersonId) {
    return isInviteAuthorized(ownership, invitePersonId, inviteTeamId, inviteContextId, fileKey)
  }
  return isSessionAuthorized(ownership, user, roles)
}

