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
    prisma.context.findFirst({
      where: {
        OR: [
          { settings: { path: ['branding', 'logoKey'], equals: trimmedKey } },
          { settings: { path: ['background', 'key'], equals: trimmedKey } },
        ],
      },
      select: {
        userId: true,
        teamId: true,
      },
    }),
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
 * Validate invite token and return person ID if valid
 */
export async function validateInviteToken(token: string | null): Promise<string | null> {
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
        },
      },
    },
  })

  if (!invite?.person) {
    return null
  }

  return invite.person.id
}

/**
 * Check if invite token authorizes access to file
 */
export function isInviteAuthorized(ownership: OwnershipRecord, invitePersonId: string): boolean {
  if (!ownership.personId) {
    return false
  }
  return ownership.personId === invitePersonId
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
  invitePersonId: string | null
): boolean {
  if (invitePersonId) {
    return isInviteAuthorized(ownership, invitePersonId)
  }
  return isSessionAuthorized(ownership, user, roles)
}

