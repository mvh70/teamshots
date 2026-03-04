jest.mock('@/domain/style/packages', () => ({
  getPackageConfig: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    context: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    userPackage: {
      findFirst: jest.fn(),
    },
  },
}))

import { getPackageConfig } from '@/domain/style/packages'
import { findDisallowedStyleCategory } from '../create-validation'

describe('findDisallowedStyleCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allows beautification even when it is not listed in visible categories', () => {
    ;(getPackageConfig as jest.Mock).mockReturnValue({
      visibleCategories: ['background', 'pose'],
    })

    const disallowed = findDisallowedStyleCategory(
      {
        packageId: 'headshot1',
        beautification: {
          mode: 'user-choice',
          value: { retouching: 'light' },
        },
      },
      'headshot1'
    )

    expect(disallowed).toBeNull()
  })

  it('still rejects unknown categories', () => {
    ;(getPackageConfig as jest.Mock).mockReturnValue({
      visibleCategories: ['background', 'pose'],
    })

    const disallowed = findDisallowedStyleCategory(
      {
        packageId: 'headshot1',
        beautification: {
          mode: 'user-choice',
          value: { retouching: 'light' },
        },
        forbiddenCategory: { mode: 'user-choice', value: 'x' },
      },
      'headshot1'
    )

    expect(disallowed).toBe('forbiddenCategory')
  })
})
