import { renderHook } from '@testing-library/react'
import { useCustomizationCompletion } from '../useCustomizationCompletion'
import { getUneditedEditableFieldNames } from '@/domain/style/userChoice'
import type { PhotoStyleSettings } from '@/types/photo-style'

jest.mock('@/domain/style/userChoice', () => ({
  getUneditedEditableFieldNames: jest.fn()
}))

jest.mock('@/domain/style/packages', () => ({
  getPackageConfig: jest.fn(() => ({
    defaultSettings: {
      clothing: { mode: 'predefined', value: { type: 'business' } },
      clothingColors: { mode: 'user-choice', value: { topLayer: '#1a1a1a', baseLayer: '#2b2b2b' } },
      pose: { mode: 'predefined', value: { type: 'classic_corporate' } },
      expression: { mode: 'predefined', value: { type: 'genuine_smile' } },
      branding: { mode: 'predefined', value: { type: 'exclude' } }
    }
  }))
}))

const mockedGetUneditedEditableFieldNames = getUneditedEditableFieldNames as jest.MockedFunction<typeof getUneditedEditableFieldNames>

describe('useCustomizationCompletion', () => {
  const photoStyleSettings = {
    clothing: { mode: 'predefined', value: { type: 'business' } },
    clothingColors: { mode: 'user-choice', value: { topLayer: '#1a1a1a', baseLayer: '#2b2b2b' } },
    pose: { mode: 'predefined', value: { type: 'classic_corporate' } },
    expression: { mode: 'predefined', value: { type: 'genuine_smile' } },
    branding: { mode: 'predefined', value: { type: 'exclude' } }
  } as const

  const originalContextSettings = {
    clothing: { mode: 'predefined', value: { type: 'business' } },
    clothingColors: { mode: 'user-choice', value: { topLayer: '#1a1a1a', baseLayer: '#2b2b2b' } },
    pose: { mode: 'predefined', value: { type: 'classic_corporate' } },
    expression: { mode: 'predefined', value: { type: 'genuine_smile' } },
    branding: { mode: 'predefined', value: { type: 'exclude' } }
  } as const

  const acceptedOnVisitKeys = ['clothing', 'clothingColors', 'pose', 'expression', 'branding']

  beforeEach(() => {
    mockedGetUneditedEditableFieldNames.mockReturnValue(['clothingColors'])
  })

  afterEach(() => {
    mockedGetUneditedEditableFieldNames.mockReset()
  })

  it('keeps unedited fields scoped to editable step keys', () => {
    const { result } = renderHook(() =>
      useCustomizationCompletion({
        photoStyleSettings: photoStyleSettings as unknown as PhotoStyleSettings,
        originalContextSettings: originalContextSettings as unknown as PhotoStyleSettings,
        packageId: 'headshot1',
        stepKeys: ['clothingColors'],
        isMobileViewport: false,
        includeDefaultValues: true,
        acceptedOnVisitKeys,
        acceptedOnVisitVisitedKeys: new Set<string>()
      })
    )

    expect(result.current.uneditedFields).toEqual(['clothingColors'])
    expect(result.current.hasUneditedFields).toBe(true)
  })

  it('marks accepted editable step complete after visit even when unchanged', () => {
    const { result } = renderHook(() =>
      useCustomizationCompletion({
        photoStyleSettings: photoStyleSettings as unknown as PhotoStyleSettings,
        originalContextSettings: originalContextSettings as unknown as PhotoStyleSettings,
        packageId: 'headshot1',
        stepKeys: ['clothingColors'],
        isMobileViewport: false,
        includeDefaultValues: true,
        acceptedOnVisitKeys,
        acceptedOnVisitVisitedKeys: new Set(['clothingColors'])
      })
    )

    expect(result.current.uneditedFields).toEqual([])
    expect(result.current.hasUneditedFields).toBe(false)
  })
})
