import { prisma } from '@/lib/prisma'
import { extendInviteExpiry } from '@/lib/invite-utils'

export type InviteAccessErrorCode =
  | 'missing_token'
  | 'invalid_or_expired_invite'
  | 'person_not_found'
  | 'access_revoked'

export interface InviteAccessError {
  code: InviteAccessErrorCode
  status: number
  message: string
}

export interface InviteAccess {
  inviteId: string
  token: string
  teamId: string
  contextId: string | null
  email: string
  person: {
    id: string
    firstName: string | null
    email: string | null
    userId: string | null
    teamId: string | null
  }
}

export type ResolveInviteAccessResult =
  | { ok: true; access: InviteAccess }
  | { ok: false; error: InviteAccessError }

interface ResolveInviteAccessOptions {
  token: string | null
  extendExpiry?: boolean
}

export async function resolveInviteAccess({
  token,
  extendExpiry = true,
}: ResolveInviteAccessOptions): Promise<ResolveInviteAccessResult> {
  if (!token) {
    return {
      ok: false,
      error: {
        code: 'missing_token',
        status: 400,
        message: 'Missing token',
      },
    }
  }

  const invite = await prisma.teamInvite.findFirst({
    where: {
      token,
      usedAt: { not: null },
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      token: true,
      teamId: true,
      contextId: true,
      email: true,
      expiresAt: true,
      person: {
        select: {
          id: true,
          firstName: true,
          email: true,
          userId: true,
          teamId: true,
        },
      },
    },
  })

  if (!invite) {
    return {
      ok: false,
      error: {
        code: 'invalid_or_expired_invite',
        status: 401,
        message: 'Invalid or expired invite',
      },
    }
  }

  if (!invite.person) {
    return {
      ok: false,
      error: {
        code: 'person_not_found',
        status: 404,
        message: 'Person not found',
      },
    }
  }

  if (invite.person.teamId !== invite.teamId) {
    return {
      ok: false,
      error: {
        code: 'access_revoked',
        status: 403,
        message: 'Access revoked',
      },
    }
  }

  if (extendExpiry) {
    const expiryTime = invite.expiresAt instanceof Date ? invite.expiresAt.getTime() : null
    if (expiryTime !== null) {
      const hoursUntilExpiry = (expiryTime - Date.now()) / (1000 * 60 * 60)
      if (hoursUntilExpiry < 12) {
        extendInviteExpiry(invite.id).catch(() => {
          // Sliding expiry is best-effort only.
        })
      }
    }
  }

  return {
    ok: true,
    access: {
      inviteId: invite.id,
      token: invite.token,
      teamId: invite.teamId,
      contextId: invite.contextId,
      email: invite.email,
      person: {
        id: invite.person.id,
        firstName: invite.person.firstName,
        email: invite.person.email,
        userId: invite.person.userId,
        teamId: invite.person.teamId,
      },
    },
  }
}
