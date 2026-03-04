import { act, renderHook, waitFor } from '@testing-library/react'
import type { BeautificationValue } from '@/domain/style/elements/beautification/types'
import { useBeautificationDefaults } from '../useBeautificationDefaults'
import {
  loadStyleSettings,
  readSavedBeautification,
  saveStyleSettings,
} from '@/lib/clothing-colors-storage'

jest.mock('@/lib/clothing-colors-storage', () => ({
  loadStyleSettings: jest.fn(),
  readSavedBeautification: jest.fn(),
  saveStyleSettings: jest.fn(),
}))

const mockedLoadStyleSettings = loadStyleSettings as jest.MockedFunction<typeof loadStyleSettings>
const mockedReadSavedBeautification = readSavedBeautification as jest.MockedFunction<typeof readSavedBeautification>
const mockedSaveStyleSettings = saveStyleSettings as jest.MockedFunction<typeof saveStyleSettings>

describe('useBeautificationDefaults', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('keeps saved beautification when present', async () => {
    const savedValue: BeautificationValue = {
      retouching: 'medium',
    }
    mockedReadSavedBeautification.mockReturnValue(savedValue)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ defaults: { retouching: 'high' } }),
    }) as unknown as typeof fetch

    const { result } = renderHook(() =>
      useBeautificationDefaults({
        defaultsEndpoint: '/api/person/beautification',
      })
    )

    await waitFor(() => {
      expect(result.current.isLoadingDefaults).toBe(false)
    })

    expect(result.current.value).toEqual(savedValue)
  })

  it('uses API defaults when no saved value exists', async () => {
    mockedReadSavedBeautification.mockReturnValue(null)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ defaults: { retouching: 'high' } }),
    }) as unknown as typeof fetch

    const { result } = renderHook(() =>
      useBeautificationDefaults({
        defaultsEndpoint: '/api/person/beautification',
      })
    )

    await waitFor(() => {
      expect(result.current.isLoadingDefaults).toBe(false)
    })

    expect(result.current.value.retouching).toBe('high')
  })

  it('persists draft to session using scope-specific settings', () => {
    const valueToPersist: BeautificationValue = {
      retouching: 'none',
    }
    mockedLoadStyleSettings.mockReturnValue({ existing: true } as never)

    const { result } = renderHook(() =>
      useBeautificationDefaults({
        defaultsEndpoint: '/api/person/beautification',
        scope: 'invite_token_1',
        enabled: false,
      })
    )

    act(() => {
      result.current.persistDraftToSession(valueToPersist)
    })

    expect(mockedLoadStyleSettings).toHaveBeenCalledWith('invite_token_1')
    expect(mockedSaveStyleSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        existing: true,
        beautification: {
          mode: 'user-choice',
          value: valueToPersist,
        },
      }),
      'invite_token_1'
    )
  })
})

