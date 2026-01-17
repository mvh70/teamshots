'use client'

import { useCallback } from 'react'
import { useSWR, swrFetcher, mutate } from '@/lib/swr'

interface UploadListItem {
  id: string
  uploadedKey: string
  validated: boolean
  createdAt: string
  hasGenerations: boolean
  selfieType?: string | null
  selfieTypeConfidence?: number | null
  personCount?: number | null
  isProper?: boolean | null
  improperReason?: string | null
}

interface UploadListResponse {
  items?: UploadListItem[]
}

// Poll interval when selfies are being analyzed (2 seconds)
const ANALYZING_POLL_INTERVAL = 2000

interface UseSelfieUploadsOptions {
  /** When false, disables auto-fetch on mount. Use for invite mode where token-based auth is used. */
  enabled?: boolean
}

const UPLOADS_KEY = '/api/uploads/list'

export function useSelfieUploads(options: UseSelfieUploadsOptions = {}) {
  const { enabled = true } = options

  const { data, error: swrError, isLoading } = useSWR<UploadListResponse>(
    enabled ? UPLOADS_KEY : null,
    (url) => swrFetcher(url, { credentials: 'include', cache: 'no-store' }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 1000,
      focusThrottleInterval: 2000, // Prevent focus storms
      refreshInterval: (latestData) => {
        // Poll when there are selfies being analyzed (no selfieType)
        const items = latestData?.items || []
        const hasAnalyzing = items.some(u => !u.selfieType || u.selfieType === '')
        return hasAnalyzing ? ANALYZING_POLL_INTERVAL : 0
      },
    }
  )

  const uploads = data?.items || []
  const error = swrError ? 'Failed to load uploads' : null

  const loadUploads = useCallback(async () => {
    if (enabled) {
      await mutate(UPLOADS_KEY)
    }
  }, [enabled])

  return {
    uploads,
    loading: isLoading,
    error,
    loadUploads
  }
}
