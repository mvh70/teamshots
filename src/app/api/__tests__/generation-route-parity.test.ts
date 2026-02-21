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
  determineWorkflowVersion: jest.fn((version?: 'v3') => version || 'v3'),
  createGenerationWithCreditReservation: jest.fn(),
  serializeStyleSettingsForGeneration: jest.fn(),
  enrichGenerationJobFromSelfies: jest.fn(),
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
import {
  createGenerationWithCreditReservation,
  enrichGenerationJobFromSelfies,
  enqueueGenerationJob,
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
    ;(UserService.getUserContext as jest.Mock).mockResolvedValue({
      roles: { isTeamAdmin: false },
      teamId: 'team-1',
      user: { person: { id: 'person-user', teamId: 'team-1' } },
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
      .mockResolvedValueOnce({ generation: { id: 'gen-normal' } })
      .mockResolvedValueOnce({ generation: { id: 'gen-invite' } })
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
      .mockResolvedValueOnce({ id: 'job-normal' })
      .mockResolvedValueOnce({ id: 'job-invite' })

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
      admin: {
        planPeriod: 'monthly',
        planTier: 'individual',
      },
    })
    ;(prisma.teamInvite.findFirst as jest.Mock).mockResolvedValue({
      id: 'invite-1',
      person: {
        id: 'person-1',
        teamId: 'team-1',
        team: {
          id: 'team-1',
          activeContextId: null,
          adminId: 'admin-1',
        },
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
})
