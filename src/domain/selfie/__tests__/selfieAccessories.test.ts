jest.mock('@/lib/prisma', () => ({
  prisma: {
    selfie: {
      findMany: jest.fn(),
    },
  },
}))

import { aggregateAccessories } from '../selfieAccessories'

describe('aggregateAccessories', () => {
  it('aggregates by confidence threshold, majority, mode, and union', () => {
    const result = aggregateAccessories([
      {
        classification: {
          version: 2,
          accessories: {
            glasses: { detected: true, type: 'prescription', confidence: 0.95 },
            facial_hair: { detected: true, type: 'beard', confidence: 0.9 },
            jewelry: { detected: true, types: ['earrings'], confidence: 0.85 },
            piercings: { detected: true, types: ['nose'], confidence: 0.8 },
          },
        },
      },
      {
        classification: {
          version: 2,
          accessories: {
            glasses: { detected: true, type: 'prescription', confidence: 0.8 },
            facial_hair: { detected: true, type: 'beard', confidence: 0.88 },
            jewelry: { detected: true, types: ['necklace'], confidence: 0.82 },
            piercings: { detected: false, types: [], confidence: 0.78 },
          },
        },
      },
      {
        classification: {
          version: 2,
          accessories: {
            glasses: { detected: false, type: 'none', confidence: 0.9 },
            facial_hair: { detected: false, type: 'none', confidence: 0.75 },
            jewelry: { detected: false, types: [], confidence: 0.9 },
            piercings: { detected: true, types: ['septum'], confidence: 0.65 }, // below threshold
          },
        },
      },
    ])

    expect(result.glasses).toEqual({ detected: true, type: 'prescription' })
    expect(result.facialHair).toEqual({ detected: true, type: 'beard' })
    expect(result.jewelry).toEqual({
      detected: true,
      types: expect.arrayContaining(['earrings', 'necklace']),
    })
    expect(result.piercings).toEqual({
      detected: false,
      types: ['nose'],
    })
  })

  it('returns empty profile for v1-only classifications', () => {
    const result = aggregateAccessories([
      {
        classification: {
          version: 1,
          type: { value: 'front_view', confidence: 0.9 },
          personCount: 1,
          proper: { isProper: true },
          lighting: { quality: 'good' },
          background: { quality: 'good' },
          demographics: {},
        },
      },
    ])

    expect(result).toEqual({})
  })
})
