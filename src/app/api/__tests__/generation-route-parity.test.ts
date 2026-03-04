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

jest.mock('@/domain/extension', () => ({
  getExtensionAuthFromHeaders: jest.fn(),
  EXTENSION_SCOPES: { GENERATION_CREATE: 'generation:create' },
}))

jest.mock('@/lib/cors', () => ({
  handleCorsPreflightSync: jest.fn(),
  addCorsHeaders: (response: Response) => response,
}))

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
}))

jest.mock('@/lib/security-logger', () => ({
  SecurityLogger: {
    logRateLimitExceeded: jest.fn(),
    logSuspiciousActivity: jest.fn(),
  },
}))

jest.mock('@/config/pricing', () => ({
  PRICING_CONFIG: {
    credits: { perGeneration: 10 },
  },
  getPricingTier: jest.fn(() => 'individual'),
}))

jest.mock('@/config/packages', () => ({
  PACKAGES_CONFIG: {
    defaultPlanPackage: 'freepackage',
  },
}))

jest.mock('@/domain/pricing', () => ({
  getRegenerationCount: jest.fn(() => 2),
}))

jest.mock('@/domain/credits/credits', () => ({
  getPersonCreditBalance: jest.fn(() => 0),
  getTeamInviteRemainingCredits: jest.fn(),
}))

jest.mock('@/domain/style/packages', () => ({
  getPackageConfig: jest.fn(),
}))

jest.mock('@/domain/style/settings-resolver', () => ({
  resolvePhotoStyleSettings: jest.fn((_: string, _context: unknown, user: unknown) => user ?? {}),
}))

jest.mock('@/domain/selfie/selfie-types', () => ({
  extractFromClassification: jest.fn(),
}))

jest.mock('@/domain/services/CreditService', () => ({
  CreditService: {
    determineCreditSource: jest.fn(),
    canAffordOperation: jest.fn(),
    getCreditBalanceSummary: jest.fn(),
  },
}))

jest.mock('@/domain/services/UserService', () => ({
  UserService: {
    getUserContext: jest.fn(),
  },
}))

jest.mock('@/domain/generation', () => ({
  RegenerationService: {
    regenerate: jest.fn(),
  },
}))

jest.mock('@/domain/generation/utils', () => ({
  deriveGenerationType: jest.fn(() => 'team'),
}))

jest.mock('@/domain/generation/generation-helpers', () => ({
  enqueueGenerationJob: jest.fn(),
  createGenerationWithCreditReservation: jest.fn(),
  serializeStyleSettingsForGeneration: jest.fn(),
  enrichGenerationJobFromSelfies: jest.fn(),
  getRegenerationLimitForAdmin: jest.fn(() => 2),
  handleEnqueueFailure: jest.fn(async () => {
    throw new Error('Failed to queue generation job. Credits have been refunded.')
  }),
}))

jest.mock('@/domain/generation/selfieResolver', () => ({
  resolveSelfies: jest.fn(),
}))

jest.mock('@/lib/invite-utils', () => ({
  extendInviteExpiry: jest.fn(() => Promise.resolve()),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    selfie: {
      findMany: jest.fn(),
    },
    person: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
    teamInvite: {
      findFirst: jest.fn(),
    },
    context: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    userPackage: {
      findFirst: jest.fn(),
    },
  },
  Prisma: {},
}))

import { auth } from '@/auth'
import { getExtensionAuthFromHeaders } from '@/domain/extension'
import { checkRateLimit } from '@/lib/rate-limit'
import { getTeamInviteRemainingCredits } from '@/domain/credits/credits'
import { getPackageConfig } from '@/domain/style/packages'
import { extractFromClassification } from '@/domain/selfie/selfie-types'
import { CreditService } from '@/domain/services/CreditService'
import { UserService } from '@/domain/services/UserService'
import { RegenerationService } from '@/domain/generation'
import { getPricingTier } from '@/config/pricing'
import { getRegenerationCount } from '@/domain/pricing'
import {
  createGenerationWithCreditReservation,
  enrichGenerationJobFromSelfies,
  enqueueGenerationJob,
  getRegenerationLimitForAdmin,
  handleEnqueueFailure,
  serializeStyleSettingsForGeneration,
} from '@/domain/generation/generation-helpers'
import { resolveSelfies } from '@/domain/generation/selfieResolver'
import { prisma } from '@/lib/prisma'
import { POST as normalGenerationPost } from '@/app/api/generations/create/route'
import { POST as inviteGenerationPost } from '@/app/api/team/member/generations/create/route'

describe('generation route parity', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    ;(auth as jest.Mock).mockResolvedValue({
      user: {
        id: 'user-1',
        person: {
          teamId: 'team-1',
        },
      },
    })
    ;(getExtensionAuthFromHeaders as jest.Mock).mockResolvedValue(null)
    ;(checkRateLimit as jest.Mock).mockResolvedValue({
      success: true,
      reset: Date.now() + 60_000,
    })
    ;(getTeamInviteRemainingCredits as jest.Mock).mockResolvedValue(100)

    ;(CreditService.determineCreditSource as jest.Mock).mockResolvedValue({
      creditSource: 'individual',
      generationType: 'team',
      teamId: 'team-1',
      reason: 'test',
    })
    ;(CreditService.canAffordOperation as jest.Mock).mockResolvedValue(true)
    ;(CreditService.getCreditBalanceSummary as jest.Mock).mockResolvedValue({
      individual: 100,
      team: 0,
      person: 100,
      total: 100,
    })
    ;(UserService.getUserContext as jest.Mock).mockResolvedValue({
      roles: { isTeamAdmin: false },
      teamId: 'team-1',
      user: { person: { id: 'person-user', teamId: 'team-1' } },
      subscription: { tier: 'individual', period: 'small' },
    })

    ;(getPackageConfig as jest.Mock).mockReturnValue({
      visibleCategories: [],
      extractUiSettings: (settings: Record<string, unknown>) => settings,
      persistenceAdapter: {
        deserialize: (settings: Record<string, unknown>) => settings,
      },
    })
    ;(extractFromClassification as jest.Mock).mockImplementation(
      (classification: { marker?: string }) => ({
        selfieType: classification.marker === 'front' ? 'front_view' : 'side_view',
      })
    )
    ;(serializeStyleSettingsForGeneration as jest.Mock).mockReturnValue({
      packageId: 'freepackage',
      inputSelfies: { keys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'] },
    })
    ;(resolveSelfies as jest.Mock).mockResolvedValue({
      primarySelfie: {
        id: 'selfie-1',
        key: 'selfies/p1/a.jpg',
      },
      selfieS3Keys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
    })
    ;(createGenerationWithCreditReservation as jest.Mock)
      .mockResolvedValue({ generation: { id: 'gen-default' } })
    ;(enrichGenerationJobFromSelfies as jest.Mock).mockResolvedValue({
      selfieAssetIds: ['asset-a', 'asset-b'],
      selfieTypeMap: {
        'selfies/p1/a.jpg': 'front_view',
        'selfies/p1/b.jpg': 'side_view',
      },
      demographics: {
        gender: 'female',
        ageRange: '25-34',
      },
    })
    ;(enqueueGenerationJob as jest.Mock)
      .mockResolvedValue({ id: 'job-default' })
    ;(getRegenerationLimitForAdmin as jest.Mock).mockReturnValue(2)
    ;(handleEnqueueFailure as jest.Mock).mockImplementation(async () => {
      throw new Error('Failed to queue generation job. Credits have been refunded.')
    })

    ;(prisma.selfie.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'selfie-1',
        key: 'selfies/p1/a.jpg',
        personId: 'person-1',
        classification: { marker: 'front' },
        person: { userId: 'user-1', teamId: 'team-1' },
      },
      {
        id: 'selfie-2',
        key: 'selfies/p1/b.jpg',
        personId: 'person-1',
        classification: { marker: 'side' },
        person: { userId: 'user-1', teamId: 'team-1' },
      },
    ])
    ;(prisma.person.findUnique as jest.Mock).mockImplementation(({ where }: { where: { id?: string; userId?: string } }) => {
      if (where.id) {
        return Promise.resolve({
          userId: 'user-1',
          teamId: 'team-1',
          inviteToken: 'invite-person-token',
          team: { adminId: 'admin-1' },
        })
      }

      if (where.userId) {
        return Promise.resolve({
          id: 'person-user',
          teamId: 'team-1',
        })
      }

      return Promise.resolve(null)
    })
    ;(prisma.team.findUnique as jest.Mock).mockResolvedValue({
      adminId: 'admin-1',
      activeContextId: null,
      admin: {
        planPeriod: 'monthly',
        planTier: 'individual',
      },
    })
    ;(prisma.teamInvite.findFirst as jest.Mock).mockResolvedValue({
      id: 'invite-1',
      token: 'invite-token',
      teamId: 'team-1',
      contextId: null,
      email: 'invitee@example.com',
      person: {
        id: 'person-1',
        teamId: 'team-1',
        userId: null,
        email: 'invitee@example.com',
      },
    })
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'admin-1',
    })
  })

  it('enqueues equivalent enrichment fields for normal and invite generation routes', async () => {
    const normalRequest = {
      url: 'http://localhost/api/generations/create',
      headers: {
        get: jest.fn(() => null),
      },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
        styleSettings: { packageId: 'freepackage' },
        prompt: 'Professional headshot',
        workflowVersion: 'v3',
      }),
    }

    const inviteRequest = {
      url: 'http://localhost/api/team/member/generations/create?token=invite-token',
      headers: {
        get: jest.fn(() => null),
      },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
        styleSettings: { packageId: 'freepackage' },
        prompt: 'Professional headshot',
        workflowVersion: 'v3',
      }),
    }

    const normalResponse = await normalGenerationPost(normalRequest as never)
    const inviteResponse = await inviteGenerationPost(inviteRequest as never)

    expect(normalResponse.status).toBe(200)
    expect(inviteResponse.status).toBe(200)
    expect(enqueueGenerationJob).toHaveBeenCalledTimes(2)

    const normalPayload = (enqueueGenerationJob as jest.Mock).mock.calls[0][0]
    const invitePayload = (enqueueGenerationJob as jest.Mock).mock.calls[1][0]

    expect(normalPayload).toEqual(
      expect.objectContaining({
        teamId: 'team-1',
        selfieAssetIds: ['asset-a', 'asset-b'],
        selfieTypeMap: {
          'selfies/p1/a.jpg': 'front_view',
          'selfies/p1/b.jpg': 'side_view',
        },
        demographics: {
          gender: 'female',
          ageRange: '25-34',
        },
      })
    )

    expect(invitePayload).toEqual(
      expect.objectContaining({
        teamId: 'team-1',
        selfieAssetIds: ['asset-a', 'asset-b'],
        selfieTypeMap: {
          'selfies/p1/a.jpg': 'front_view',
          'selfies/p1/b.jpg': 'side_view',
        },
        demographics: {
          gender: 'female',
          ageRange: '25-34',
        },
      })
    )

    expect(invitePayload.selfieAssetIds).toEqual(normalPayload.selfieAssetIds)
    expect(invitePayload.selfieTypeMap).toEqual(normalPayload.selfieTypeMap)
    expect(invitePayload.demographics).toEqual(normalPayload.demographics)
  })

  it('uses fallback prompt for invite generation when prompt is omitted', async () => {
    const inviteRequest = {
      url: 'http://localhost/api/team/member/generations/create?token=invite-token',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
        styleSettings: { packageId: 'freepackage' },
      }),
    }

    const response = await inviteGenerationPost(inviteRequest as never)
    expect(response.status).toBe(200)

    expect(enqueueGenerationJob).toHaveBeenCalledTimes(1)
    const invitePayload = (enqueueGenerationJob as jest.Mock).mock.calls[0][0]
    expect(invitePayload.prompt).toBe('Professional headshot')
  })

  it('accepts beautification style settings in normal generation create', async () => {
    const normalRequest = {
      url: 'http://localhost/api/generations/create',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
        styleSettings: {
          packageId: 'freepackage',
          beautification: {
            mode: 'user-choice',
            value: { retouching: 'medium' },
          },
        },
        prompt: 'Professional headshot',
      }),
    }

    const response = await normalGenerationPost(normalRequest as never)
    expect(response.status).toBe(200)
    expect(serializeStyleSettingsForGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        styleSettings: expect.objectContaining({
          beautification: expect.objectContaining({
            mode: 'user-choice',
          }),
        }),
      })
    )
  })

  it('accepts beautification style settings in invite generation create', async () => {
    const inviteRequest = {
      url: 'http://localhost/api/team/member/generations/create?token=invite-token',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
        styleSettings: {
          packageId: 'freepackage',
          beautification: {
            mode: 'user-choice',
            value: { retouching: 'light' },
          },
        },
        prompt: 'Professional headshot',
      }),
    }

    const response = await inviteGenerationPost(inviteRequest as never)
    expect(response.status).toBe(200)
    expect(serializeStyleSettingsForGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        styleSettings: expect.objectContaining({
          beautification: expect.objectContaining({
            mode: 'user-choice',
          }),
        }),
      })
    )
  })

  it('rejects disallowed style categories in normal generation create', async () => {
    const normalRequest = {
      url: 'http://localhost/api/generations/create',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg'],
        styleSettings: {
          packageId: 'freepackage',
          forbiddenCategory: { mode: 'user-choice', value: 'x' },
        },
        prompt: 'Professional headshot',
      }),
    }

    const response = await normalGenerationPost(normalRequest as never)
    expect(response.status).toBe(400)
    expect(createGenerationWithCreditReservation).not.toHaveBeenCalled()
  })

  it('rejects invite generation create when invite is expired or missing', async () => {
    ;(prisma.teamInvite.findFirst as jest.Mock).mockResolvedValueOnce(null)

    const inviteRequest = {
      url: 'http://localhost/api/team/member/generations/create?token=invite-token',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg'],
        styleSettings: { packageId: 'freepackage' },
        prompt: 'Professional headshot',
      }),
    }

    const response = await inviteGenerationPost(inviteRequest as never)
    expect(response.status).toBe(401)
    expect(createGenerationWithCreditReservation).not.toHaveBeenCalled()
  })

  it('rejects invite generation create when invite member no longer belongs to invite team', async () => {
    ;(prisma.teamInvite.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'invite-1',
      token: 'invite-token',
      teamId: 'team-1',
      contextId: null,
      email: 'invitee@example.com',
      person: {
        id: 'person-1',
        teamId: 'team-2',
        userId: null,
        email: 'invitee@example.com',
      },
    })

    const inviteRequest = {
      url: 'http://localhost/api/team/member/generations/create?token=invite-token',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg'],
        styleSettings: { packageId: 'freepackage' },
        prompt: 'Professional headshot',
      }),
    }

    const response = await inviteGenerationPost(inviteRequest as never)
    expect(response.status).toBe(403)
    expect(createGenerationWithCreditReservation).not.toHaveBeenCalled()
  })

  it('rejects disallowed style categories in invite generation create', async () => {
    const inviteRequest = {
      url: 'http://localhost/api/team/member/generations/create?token=invite-token',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg'],
        styleSettings: {
          packageId: 'freepackage',
          forbiddenCategory: { mode: 'user-choice', value: 'x' },
        },
        prompt: 'Professional headshot',
      }),
    }

    const response = await inviteGenerationPost(inviteRequest as never)
    expect(response.status).toBe(400)
    expect(createGenerationWithCreditReservation).not.toHaveBeenCalled()
  })

  it('rejects invite generation create when team admin does not own requested package', async () => {
    const inviteRequest = {
      url: 'http://localhost/api/team/member/generations/create?token=invite-token',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg'],
        styleSettings: { packageId: 'headshot1' },
        prompt: 'Professional headshot',
      }),
    }

    const response = await inviteGenerationPost(inviteRequest as never)
    expect(response.status).toBe(403)
    expect(createGenerationWithCreditReservation).not.toHaveBeenCalled()
  })

  it('ignores client isRegeneration flag when originalGenerationId is missing', async () => {
    const normalRequest = {
      url: 'http://localhost/api/generations/create',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
        styleSettings: { packageId: 'freepackage' },
        prompt: 'Professional headshot',
        isRegeneration: true,
      }),
    }

    const response = await normalGenerationPost(normalRequest as never)
    expect(response.status).toBe(200)
    expect(RegenerationService.regenerate).not.toHaveBeenCalled()
    expect(createGenerationWithCreditReservation).toHaveBeenCalledTimes(1)
  })

  it('uses pricing helpers for normal route regeneration count mapping', async () => {
    ;(UserService.getUserContext as jest.Mock).mockResolvedValueOnce({
      roles: { isTeamAdmin: false },
      teamId: 'team-1',
      user: { person: { id: 'person-user', teamId: 'team-1' } },
      subscription: { tier: 'individual', period: 'large' },
    })
    ;(prisma.person.findUnique as jest.Mock).mockImplementation(({ where }: { where: { id?: string; userId?: string } }) => {
      if (where.id) {
        return Promise.resolve({
          userId: 'user-1',
          teamId: 'team-1',
          inviteToken: null,
          team: { adminId: 'admin-1' },
        })
      }
      if (where.userId) {
        return Promise.resolve({
          id: 'person-user',
          teamId: 'team-1',
        })
      }
      return Promise.resolve(null)
    })
    ;(getPricingTier as jest.Mock).mockReturnValueOnce('vip')
    ;(getRegenerationCount as jest.Mock).mockReturnValueOnce(3)

    const normalRequest = {
      url: 'http://localhost/api/generations/create',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
        styleSettings: { packageId: 'freepackage' },
        prompt: 'Professional headshot',
      }),
    }

    const response = await normalGenerationPost(normalRequest as never)
    expect(response.status).toBe(200)
    expect(getPricingTier).toHaveBeenCalledWith('individual', 'large')
    expect(getRegenerationCount).toHaveBeenCalledWith('vip', 'large')
    expect(createGenerationWithCreditReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        generationData: expect.objectContaining({
          maxRegenerations: 3,
          remainingRegenerations: 3,
        }),
      })
    )
  })

  it('uses pricing helpers for invite route regeneration count mapping', async () => {
    ;(prisma.team.findUnique as jest.Mock).mockResolvedValueOnce({
      adminId: 'admin-1',
      activeContextId: null,
      admin: {
        planPeriod: 'seats',
        planTier: 'pro',
      },
    })
    ;(getRegenerationLimitForAdmin as jest.Mock).mockReturnValueOnce(2)

    const inviteRequest = {
      url: 'http://localhost/api/team/member/generations/create?token=invite-token',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
        styleSettings: { packageId: 'freepackage' },
        prompt: 'Professional headshot',
      }),
    }

    const response = await inviteGenerationPost(inviteRequest as never)
    expect(response.status).toBe(200)
    expect(getRegenerationLimitForAdmin).toHaveBeenCalledWith('pro', 'seats')
    expect(createGenerationWithCreditReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        generationData: expect.objectContaining({
          maxRegenerations: 2,
          remainingRegenerations: 2,
        }),
      })
    )
  })

  it('returns 402 with credit summary when normal route reservation fails', async () => {
    ;(createGenerationWithCreditReservation as jest.Mock).mockRejectedValueOnce(
      new Error('Insufficient credits')
    )
    ;(CreditService.getCreditBalanceSummary as jest.Mock).mockResolvedValueOnce({
      individual: 4,
      team: 0,
      person: 4,
      total: 4,
    })

    const normalRequest = {
      url: 'http://localhost/api/generations/create',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
        styleSettings: { packageId: 'freepackage' },
        prompt: 'Professional headshot',
      }),
    }

    const response = await normalGenerationPost(normalRequest as never)
    const payload = await response.json()
    expect(response.status).toBe(402)
    expect(payload).toEqual(
      expect.objectContaining({
        error: 'Insufficient individual credits',
        required: 10,
        available: 4,
      })
    )
  })

  it('returns 402 when invite route reservation fails with insufficient credits', async () => {
    ;(createGenerationWithCreditReservation as jest.Mock).mockRejectedValueOnce(
      new Error('Insufficient credits')
    )
    ;(getTeamInviteRemainingCredits as jest.Mock).mockResolvedValueOnce(3)

    const inviteRequest = {
      url: 'http://localhost/api/team/member/generations/create?token=invite-token',
      headers: { get: jest.fn(() => null) },
      json: async () => ({
        selfieKeys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
        styleSettings: { packageId: 'freepackage' },
        prompt: 'Professional headshot',
      }),
    }

    const response = await inviteGenerationPost(inviteRequest as never)
    const payload = await response.json()
    expect(response.status).toBe(402)
    expect(payload).toEqual(
      expect.objectContaining({
        error: 'Insufficient credits',
        required: 10,
        available: 3,
      })
    )
  })
})
