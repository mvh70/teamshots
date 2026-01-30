/**
 * Generation Status Hook
 *
 * Polls generation status until completion or failure using SWR
 */

import { useCallback, useRef, useEffect } from 'react'
import { useSWR, swrFetcher, mutate } from '@/lib/swr'

export interface GenerationStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  generationType: 'personal' | 'team'
  creditSource: 'individual' | 'team'
  creditsUsed: number
  provider: string
  actualCost?: number

  // Images
  uploadedPhotoUrl?: string
  generatedImageUrls: string[]
  generatedPhotoKeys?: string[] // Raw S3 keys for direct use
  acceptedPhotoKey?: string

  // Progress tracking
  userApproved: boolean

  // Error information
  errorMessage?: string

  // Job status
  jobStatus?: {
    id: string
    progress: number
    message?: string
    attemptsMade: number
    processedOn?: number
    finishedOn?: number
    failedReason?: string
  }

  // Timestamps
  createdAt: string
  completedAt?: string
  acceptedAt?: string
  updatedAt: string

  // Related data
  person: {
    id: string
    firstName: string
    lastName?: string
    email?: string
  }
  context?: {
    id: string
    name: string
    stylePreset: string
  }
}

interface UseGenerationStatusOptions {
  generationId: string
  enabled?: boolean
  pollInterval?: number
  maxPollTime?: number
}

interface UseGenerationStatusReturn {
  generation: GenerationStatus | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function isGenerationComplete(data: GenerationStatus | undefined): boolean {
  if (!data) return false
  if (data.status === 'failed') return true
  if (data.status === 'completed') {
    // Only consider complete if we have valid image keys (preferred) or URLs (fallback)
    const hasValidKeys = data.generatedPhotoKeys?.some(key => key && key.length > 0)
    const hasValidUrls = data.generatedImageUrls?.some(url => url && url.length > 0)
    return hasValidKeys || hasValidUrls
  }
  return false
}

export function useGenerationStatus({
  generationId,
  enabled = true,
  pollInterval = 1000,
  maxPollTime = 300000,
}: UseGenerationStatusOptions): UseGenerationStatusReturn {
  const errorCountRef = useRef(0)
  const pollStartTimeRef = useRef(Date.now())
  const shouldStopRef = useRef(false)

  const key = enabled && generationId ? `/api/generations/${generationId}` : null

  const { data, error: swrError, isLoading } = useSWR<GenerationStatus>(
    key,
    swrFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 500,
      onSuccess: () => {
        errorCountRef.current = 0
      },
      onError: () => {
        errorCountRef.current++
        if (errorCountRef.current >= 5) {
          shouldStopRef.current = true
        }
      },
      refreshInterval: (latestData) => {
        // Stop if generation is complete
        if (isGenerationComplete(latestData)) return 0

        // Stop if too many consecutive errors
        if (shouldStopRef.current) return 0

        // Stop if exceeded max poll time
        if (Date.now() - pollStartTimeRef.current > maxPollTime) {
          shouldStopRef.current = true
          return 0
        }

        return pollInterval
      },
    }
  )

  // Reset refs when generationId changes
  useEffect(() => {
    errorCountRef.current = 0
    pollStartTimeRef.current = Date.now()
    shouldStopRef.current = false
  }, [generationId])

  const refetch = useCallback(async () => {
    errorCountRef.current = 0
    pollStartTimeRef.current = Date.now()
    shouldStopRef.current = false
    if (key) {
      await mutate(key)
    }
  }, [key])

  const errorMessage = swrError
    ? (errorCountRef.current >= 5
        ? 'Multiple fetch errors - please check back later'
        : swrError instanceof Error ? swrError.message : 'Unknown error')
    : (shouldStopRef.current && !isGenerationComplete(data)
        ? 'Generation timeout - please check back later'
        : null)

  return {
    generation: data || null,
    loading: isLoading,
    error: errorMessage,
    refetch,
  }
}

/**
 * Hook for polling multiple generations
 */
interface GenerationsListResponse {
  generations: GenerationStatus[]
  pagination?: Record<string, unknown>
}

export function useGenerationsList(options?: {
  page?: number
  limit?: number
  status?: string
  type?: string
}) {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', options.page.toString())
  if (options?.limit) params.set('limit', options.limit.toString())
  if (options?.status) params.set('status', options.status)
  if (options?.type) params.set('type', options.type)

  const key = `/api/generations/list?${params}`

  const { data, error, isLoading, mutate: revalidate } = useSWR<GenerationsListResponse>(
    key,
    swrFetcher,
    {
      revalidateOnFocus: false,
    }
  )

  const refetch = useCallback(async () => {
    await revalidate()
  }, [revalidate])

  return {
    generations: data?.generations || [],
    pagination: data?.pagination || null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Unknown error') : null,
    refetch,
  }
}
