jest.mock('@/lib/prisma', () => ({
  prisma: {
    selfie: {
      findMany: jest.fn(),
    },
    generation: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
  Prisma: {},
}))

jest.mock('@/domain/style/packages', () => ({
  getPackageConfig: jest.fn(),
}))

jest.mock('@/domain/selfie/selfie-types', () => ({
  extractFromClassification: jest.fn(),
}))

jest.mock('@/domain/selfie/selfieDemographics', () => ({
  getDemographicsFromSelfieIds: jest.fn(),
  hasDemographicData: jest.fn(),
}))

jest.mock('@/domain/services/AssetService', () => ({
  AssetService: {
    resolveToAsset: jest.fn(),
    linkSelfieToAsset: jest.fn(),
  },
}))

jest.mock('@/domain/services/CreditService', () => ({
  CreditService: {
    reserveCreditsForGeneration: jest.fn(),
  },
}))

jest.mock('@/domain/credits/credits', () => ({
  refundCreditsForFailedGeneration: jest.fn(),
}))

jest.mock('@/lib/prisma-retry', () => ({
  withSerializableRetry: jest.fn(async (fn: () => unknown) => fn()),
}))

import { getPricingTier } from '@/config/pricing'
import { PRICING_CONFIG } from '@/config/pricing'
import { getRegenerationCount } from '@/domain/pricing'
import { refundCreditsForFailedGeneration } from '@/domain/credits/credits'
import { prisma } from '@/lib/prisma'
import { getPackageConfig } from '@/domain/style/packages'
import { extractFromClassification } from '@/domain/selfie/selfie-types'
import { getDemographicsFromSelfieIds, hasDemographicData } from '@/domain/selfie/selfieDemographics'
import { AssetService } from '@/domain/services/AssetService'
import { CreditService } from '@/domain/services/CreditService'
import {
  createGenerationWithCreditReservation,
  enrichGenerationJobFromSelfies,
  getRegenerationLimitForAdmin,
  handleEnqueueFailure,
  serializeStyleSettingsForGeneration,
} from '../generation-helpers'

describe('generation helpers parity regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('serializes style settings and persists input selfies consistently', () => {
    ;(getPackageConfig as jest.Mock).mockReturnValue({
      persistenceAdapter: {
        serialize: jest.fn().mockReturnValue({
          packageId: 'headshot1',
          clothing: {
            colors: {
              topLayer: '#112233',
            },
          },
        }),
      },
    })

    const result = serializeStyleSettingsForGeneration({
      packageId: 'headshot1',
      styleSettings: { packageId: 'headshot1' },
      selfieS3Keys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
    })

    expect(result.inputSelfies).toEqual({
      keys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
    })
    expect(result.clothingColors).toEqual({
      colors: {
        topLayer: '#112233',
      },
    })
  })

  it('enriches selfie job metadata used by both invite and normal routes', async () => {
    ;(prisma.selfie.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', key: 'selfies/p1/a.jpg', assetId: null, classification: { marker: 'face' } },
      { id: 's2', key: 'selfies/p1/b.jpg', assetId: 'existing-asset', classification: { marker: 'body' } },
    ])
    ;(extractFromClassification as jest.Mock).mockImplementation(
      (classification: { marker?: string }) => ({
        selfieType: classification.marker === 'face' ? 'front_view' : 'unknown',
      })
    )
    ;(AssetService.resolveToAsset as jest.Mock)
      .mockResolvedValueOnce({ id: 'asset-a' })
      .mockResolvedValueOnce({ id: 'asset-b' })
    ;(getDemographicsFromSelfieIds as jest.Mock).mockResolvedValue({
      gender: 'male',
      ageRange: '25-34',
    })
    ;(hasDemographicData as jest.Mock).mockReturnValue(true)

    const result = await enrichGenerationJobFromSelfies({
      generationId: 'gen-1',
      personId: 'p1',
      teamId: 'team-1',
      selfieS3Keys: ['selfies/p1/a.jpg', 'selfies/p1/b.jpg'],
    })

    expect(result).toEqual({
      selfieAssetIds: ['asset-a', 'asset-b'],
      selfieTypeMap: { 'selfies/p1/a.jpg': 'front_view' },
      demographics: {
        gender: 'male',
        ageRange: '25-34',
      },
    })
    expect(AssetService.resolveToAsset).toHaveBeenNthCalledWith(
      1,
      'selfies/p1/a.jpg',
      expect.objectContaining({ ownerType: 'team', teamId: 'team-1', personId: 'p1' })
    )
    expect(AssetService.linkSelfieToAsset).toHaveBeenCalledWith('s1', 'asset-a')
  })

  it('returns empty enrichment on recoverable metadata failures', async () => {
    ;(prisma.selfie.findMany as jest.Mock).mockRejectedValue(new Error('db unavailable'))

    await expect(
      enrichGenerationJobFromSelfies({
        generationId: 'gen-2',
        personId: 'p2',
        selfieS3Keys: ['selfies/p2/a.jpg'],
      })
    ).resolves.toEqual({})
  })

  it('fails generation creation when reservation fails', async () => {
    const tx = {
      generation: {
        create: jest.fn(),
      },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: (innerTx: unknown) => unknown) => cb(tx))
    ;(CreditService.reserveCreditsForGeneration as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Insufficient credits',
    })

    await expect(
      createGenerationWithCreditReservation({
        generationData: {
          personId: 'p3',
          generatedPhotoKeys: [],
          styleSettings: {},
          creditSource: 'individual',
          creditsUsed: 10,
          status: 'pending',
        },
        reservationUserId: 'u3',
        reservationPersonId: 'p3',
        requiredCredits: 10,
      })
    ).rejects.toThrow('Insufficient credits')

    expect(tx.generation.create).not.toHaveBeenCalled()
  })

  it('calculates admin regeneration limit with shared helper', () => {
    const planTier = 'individual'
    const planPeriod = 'small'
    const expected = getRegenerationCount(getPricingTier(planTier, planPeriod), planPeriod)

    expect(getRegenerationLimitForAdmin(planTier, planPeriod)).toBe(expected)
  })

  it('refunds and cleans up on enqueue failure for standard flow', async () => {
    ;(refundCreditsForFailedGeneration as jest.Mock).mockResolvedValue({ id: 'refund-1' })
    ;(prisma.generation.delete as jest.Mock).mockResolvedValue(undefined)

    await expect(
      handleEnqueueFailure({
        generationId: 'gen-standard',
        personId: 'person-standard',
        credits: 10,
        error: new Error('queue down'),
      })
    ).rejects.toThrow('Failed to queue generation job. Credits have been refunded.')

    expect(refundCreditsForFailedGeneration).toHaveBeenCalledWith(
      'person-standard',
      10,
      'Refund for queue failure (generation gen-standard)',
      undefined,
      undefined
    )
    expect(prisma.generation.delete).toHaveBeenCalledWith({ where: { id: 'gen-standard' } })
  })

  it('refunds and cleans up on enqueue failure for invite flow', async () => {
    ;(refundCreditsForFailedGeneration as jest.Mock).mockResolvedValue({ id: 'refund-2' })
    ;(prisma.generation.delete as jest.Mock).mockResolvedValue(undefined)

    await expect(
      handleEnqueueFailure({
        generationId: 'gen-invite',
        personId: 'person-invite',
        inviteId: 'invite-1',
        error: new Error('queue down'),
      })
    ).rejects.toThrow('Failed to queue generation job. Credits have been refunded.')

    expect(refundCreditsForFailedGeneration).toHaveBeenCalledWith(
      'person-invite',
      PRICING_CONFIG.credits.perGeneration,
      'Refund for invite queue failure (generation gen-invite)',
      undefined,
      'invite-1'
    )
    expect(prisma.generation.delete).toHaveBeenCalledWith({ where: { id: 'gen-invite' } })
  })
})
