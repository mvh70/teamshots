import { prisma } from '@/lib/prisma'
import { getUserEffectiveRoles, getUserWithRoles } from '@/domain/access/roles'

/**
 * File ownership record type
 */
export type OwnershipRecord =
  | { type: 'selfie'; personId: string | null; userId: string | null; teamId: string | null }
  | { type: 'generation'; personId: string | null; userId: string | null; teamId: string | null }
  | { type: 'context'; personId: null; userId: string | null; teamId: string | null }

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
          { uploadedPhotoKey: trimmedKey },
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
    // Settings are stored with nested structure: { packageName, version, settings: { background: { key }, branding: { logoKey } } }
    // So we need to navigate: settings->'settings'->'background'->>'key'
    prisma.$queryRaw<Array<{ userId: string | null; teamId: string | null }>>`
      SELECT "userId", "teamId"
      FROM "Context"
      WHERE 
        ("settings"->'settings'->'branding'->>'logoKey') = ${trimmedKey}
        OR ("settings"->'settings'->'background'->>'key') = ${trimmedKey}
        OR ("settings"->'branding'->>'logoKey') = ${trimmedKey}
        OR ("settings"->'background'->>'key') = ${trimmedKey}
      LIMIT 1
    `.then(results => results[0] || null),
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
    }
  }

  return null
}

/**
 * Validate invite token and return person ID and team ID if valid
 */
export async function validateInviteToken(token: string | null): Promise<{ personId: string; teamId: string | null } | null> {
  if (!token) {
    return null
  }

  const invite = await prisma.teamInvite.findFirst({
    where: {
      token,
      usedAt: { not: null },
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

  return {
    personId: invite.person.id,
    teamId: invite.person.teamId
  }
}

/**
 * Check if invite token authorizes access to file
 */
export function isInviteAuthorized(ownership: OwnershipRecord, invitePersonId: string, inviteTeamId: string | null, fileKey?: string): boolean {
  // For selfies and generations, check personId match
  if (ownership.personId) {
    return ownership.personId === invitePersonId
  }

  // For context files (backgrounds/logos), check teamId match
  if (ownership.type === 'context' && ownership.teamId && inviteTeamId) {
    return ownership.teamId === inviteTeamId
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
  fileKey?: string
): boolean {
  if (invitePersonId) {
    return isInviteAuthorized(ownership, invitePersonId, inviteTeamId, fileKey)
  }
  return isSessionAuthorized(ownership, user, roles)
}

