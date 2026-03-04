import { act, renderHook, waitFor } from '@testing-library/react'
import { useAccessoriesLoader } from '../useAccessoriesLoader'

describe('useAccessoriesLoader', () => {
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('retries while pending reanalysis remains', async () => {
    jest.useFakeTimers()
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessories: { stage: 'first' },
          pendingReanalysisCount: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessories: { stage: 'second' },
          pendingReanalysisCount: 0,
        }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    const { result } = renderHook(() =>
      useAccessoriesLoader({
        endpoint: '/api/person/accessories',
      })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      jest.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.accessories).toEqual({ stage: 'second' })
  })

  it('does not fetch when disabled', () => {
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    const { result } = renderHook(() =>
      useAccessoriesLoader({
        endpoint: '/api/person/accessories',
        enabled: false,
      })
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.accessories).toBeNull()
  })

  it('suppresses logging for abort errors', async () => {
    const fetchMock = jest.fn().mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' })
    )
    global.fetch = fetchMock as unknown as typeof fetch
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() =>
      useAccessoriesLoader({
        endpoint: '/api/person/accessories',
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(consoleError).not.toHaveBeenCalled()
  })
})

