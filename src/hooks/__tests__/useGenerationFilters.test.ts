import { act, renderHook } from '@testing-library/react'
import { useGenerationFilters } from '../useGenerationFilters'

describe('useGenerationFilters', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('filters by timeframe and normalizes empty context names as Freestyle', () => {
    const fixedNow = new Date('2026-02-28T12:00:00.000Z').getTime()
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow)

    const { result } = renderHook(() => useGenerationFilters())
    act(() => {
      result.current.setTimeframe('7d')
      result.current.setContext('Freestyle')
    })

    const filtered = result.current.filterGenerated([
      { id: 'recent-empty', createdAt: '2026-02-27T10:00:00.000Z', contextName: '' },
      { id: 'recent-null', createdAt: '2026-02-26T10:00:00.000Z', contextName: null },
      { id: 'old-empty', createdAt: '2026-02-10T10:00:00.000Z', contextName: '' },
      { id: 'recent-styled', createdAt: '2026-02-27T10:00:00.000Z', contextName: 'Studio' },
    ])

    expect(filtered.map((item) => item.id)).toEqual(['recent-empty', 'recent-null'])
  })

  it('matches trimmed context names', () => {
    const { result } = renderHook(() => useGenerationFilters())
    act(() => {
      result.current.setContext('LinkedIn')
    })

    const filtered = result.current.filterGenerated([
      { id: 'match', createdAt: '2026-02-28T10:00:00.000Z', contextName: '  LinkedIn  ' },
      { id: 'mismatch', createdAt: '2026-02-28T10:00:00.000Z', contextName: 'Portrait' },
    ])

    expect(filtered.map((item) => item.id)).toEqual(['match'])
  })
})

