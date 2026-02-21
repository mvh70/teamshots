jest.mock('@/lib/prisma', () => ({
  prisma: {
    teamInvite: {
      findFirst: jest.fn(),
    },
  },
}))

jest.mock('@/lib/invite-utils', () => ({
  extendInviteExpiry: jest.fn(() => Promise.resolve(true)),
}))

import { prisma } from '@/lib/prisma'
import { extendInviteExpiry } from '@/lib/invite-utils'
import { resolveInviteAccess } from '@/lib/invite-access'

describe('resolveInviteAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns missing_token when token is absent', async () => {
    const result = await resolveInviteAccess({ token: null })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'missing_token',
        status: 400,
        message: 'Missing token',
      },
    })
    expect(prisma.teamInvite.findFirst).not.toHaveBeenCalled()
  })

  it('returns invalid_or_expired_invite when invite is not found', async () => {
    ;(prisma.teamInvite.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await resolveInviteAccess({ token: 'invite-token' })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid_or_expired_invite',
        status: 401,
        message: 'Invalid or expired invite',
      },
    })
  })

  it('returns person_not_found when invite has no person', async () => {
    ;(prisma.teamInvite.findFirst as jest.Mock).mockResolvedValue({
      id: 'invite-1',
      token: 'invite-token',
      teamId: 'team-1',
      contextId: null,
      email: 'invitee@example.com',
      person: null,
    })

    const result = await resolveInviteAccess({ token: 'invite-token' })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'person_not_found',
        status: 404,
        message: 'Person not found',
      },
    })
  })

  it('returns access_revoked when person moved out of invite team', async () => {
    ;(prisma.teamInvite.findFirst as jest.Mock).mockResolvedValue({
      id: 'invite-1',
      token: 'invite-token',
      teamId: 'team-1',
      contextId: null,
      email: 'invitee@example.com',
      person: {
        id: 'person-1',
        email: 'invitee@example.com',
        userId: null,
        teamId: 'team-2',
      },
    })

    const result = await resolveInviteAccess({ token: 'invite-token' })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'access_revoked',
        status: 403,
        message: 'Access revoked',
      },
    })
  })

  it('returns invite access and extends expiry for valid invite', async () => {
    ;(prisma.teamInvite.findFirst as jest.Mock).mockResolvedValue({
      id: 'invite-1',
      token: 'invite-token',
      teamId: 'team-1',
      contextId: 'ctx-1',
      email: 'invitee@example.com',
      person: {
        id: 'person-1',
        email: 'invitee@example.com',
        userId: 'user-1',
        teamId: 'team-1',
      },
    })

    const result = await resolveInviteAccess({ token: 'invite-token' })

    expect(result).toEqual({
      ok: true,
      access: {
        inviteId: 'invite-1',
        token: 'invite-token',
        teamId: 'team-1',
        contextId: 'ctx-1',
        email: 'invitee@example.com',
        person: {
          id: 'person-1',
          email: 'invitee@example.com',
          userId: 'user-1',
          teamId: 'team-1',
        },
      },
    })
    expect(extendInviteExpiry).toHaveBeenCalledWith('invite-1')
  })
})
