'use client'

import { useEffect, useState, useCallback } from 'react'
import { jsonFetcher } from '@/lib/fetcher'

export interface UseApiDataOptions<T> {
  url: string
  enabled?: boolean
  retry?: number
  onError?: (error: Error) => void
  transform?: (data: unknown) => T
}

export interface UseApiDataResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Reusable hook for API data fetching
 * Provides consistent loading, error handling, and retry logic
 */
export function useApiData<T = unknown>({
  url,
  enabled = true,
  retry = 0,
  onError,
  transform,
}: UseApiDataOptions<T>): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await jsonFetcher<T>(url, { retry })
      const transformed = transform ? transform(result) : result
      setData(transformed)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setData(null)
      onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [url, enabled, retry, transform, onError])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  }
}

