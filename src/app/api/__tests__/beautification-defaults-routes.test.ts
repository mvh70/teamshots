jest.mock('next/server', () => {
  class MockNextResponse {
    status: number
    private readonly body: unknown

    constructor(body: unknown = null, init?: { status?: number }) {
      this.body = body
      this.status = init?.status ?? 200
    }

    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init)
    }

    async json() {
      return this.body
    }
  }

  return {
    NextRequest: class MockNextRequest {},
    NextResponse: MockNextResponse,
  }
})

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/invite-access', () => ({
  resolveInviteAccess: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  Prisma: {},
  prisma: {
    person: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { resolveInviteAccess } from '@/lib/invite-access'
import { GET as getPersonBeautification, PUT as putPersonBeautification } from '@/app/api/person/beautification/route'
import { GET as getInviteBeautification, PUT as putInviteBeautification } from '@/app/api/team/member/beautification/route'

describe('beautification defaults routes', () => {
  const personByUserId: Record<string, string> = {
    'user-1': 'person-user',
  }

  const defaultsByPersonId: Record<string, unknown> = {
    'person-user': { retouching: 'light' },
    'person-invite': { retouching: 'light' },
  }

  beforeEach(() => {
    jest.clearAllMocks()

    ;(auth as jest.Mock).mockResolvedValue({
      user: {
        id: 'user-1',
      },
    })

    ;(resolveInviteAccess as jest.Mock).mockResolvedValue({
      ok: true,
      access: {
        token: 'invite-token',
        inviteId: 'invite-1',
        teamId: 'team-1',
        person: { id: 'person-invite' },
      },
    })

    ;(prisma.person.findUnique as jest.Mock).mockImplementation(
      ({ where }: { where: { userId?: string; id?: string } }) => {
        if (where.userId) {
          const personId = personByUserId[where.userId]
          if (!personId) return Promise.resolve(null)
          return Promise.resolve({
            id: personId,
            beautificationDefaults: defaultsByPersonId[personId],
          })
        }
        if (where.id) {
          if (!defaultsByPersonId[where.id]) return Promise.resolve(null)
          return Promise.resolve({
            id: where.id,
            beautificationDefaults: defaultsByPersonId[where.id],
          })
        }
        return Promise.resolve(null)
      }
    )

    ;(prisma.person.update as jest.Mock).mockImplementation(
      ({ where, data }: { where: { id: string }; data: { beautificationDefaults: unknown } }) => {
        defaultsByPersonId[where.id] = data.beautificationDefaults
        return Promise.resolve({
          id: where.id,
          beautificationDefaults: data.beautificationDefaults,
        })
      }
    )
  })

  it('persists and prefills defaults independently for normal and invite personas', async () => {
    const personPutResponse = await putPersonBeautification({
      json: async () => ({ defaults: { retouching: 'max' } }),
    } as never)
    expect(personPutResponse.status).toBe(200)

    const invitePutResponse = await putInviteBeautification({
      url: 'http://localhost/api/team/member/beautification?token=invite-token',
      json: async () => ({ defaults: { retouching: 'none' } }),
    } as never)
    expect(invitePutResponse.status).toBe(200)

    const personGetResponse = await getPersonBeautification()
    expect(personGetResponse.status).toBe(200)
    await expect(personGetResponse.json()).resolves.toEqual({
      defaults: { retouching: 'high' },
    })

    const inviteGetResponse = await getInviteBeautification({
      url: 'http://localhost/api/team/member/beautification?token=invite-token',
    } as never)
    expect(inviteGetResponse.status).toBe(200)
    await expect(inviteGetResponse.json()).resolves.toEqual({
      defaults: { retouching: 'none' },
    })
  })
})
