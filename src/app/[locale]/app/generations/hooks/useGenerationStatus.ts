/**
 * Generation Status Hook
 * 
 * Polls generation status until completion or failure
 */

import { useState, useEffect, useCallback } from 'react'
import { jsonFetcher } from '@/lib/fetcher'

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
  acceptedPhotoKey?: string
  
  // Progress tracking
  userApproved: boolean
  adminApproved: boolean
  
  // Moderation
  moderationScore?: number
  moderationPassed: boolean
  moderationDate?: string
  
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

export function useGenerationStatus({
  generationId,
  enabled = true,
  pollInterval = 2000, // 2 seconds
  maxPollTime = 300000, // 5 minutes
}: UseGenerationStatusOptions): UseGenerationStatusReturn {
  const [generation, setGeneration] = useState<GenerationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pollStartTime, setPollStartTime] = useState<number>(Date.now())

  const fetchGenerationStatus = useCallback(async () => {
    if (!generationId || !enabled) return

    try {
      const data = await jsonFetcher<GenerationStatus>(`/api/generations/${generationId}`)
      setGeneration(data)
      setError(null)
      
      // Stop polling if generation is completed or failed
      if (data.status === 'completed' || data.status === 'failed') {
        setLoading(false)
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setLoading(false)
    }
  }, [generationId, enabled])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPollStartTime(Date.now())
    await fetchGenerationStatus()
  }, [fetchGenerationStatus])

  // Initial fetch
  useEffect(() => {
    if (enabled && generationId) {
      fetchGenerationStatus()
    }
  }, [fetchGenerationStatus, enabled, generationId])

  // Polling effect
  useEffect(() => {
    if (!enabled || !generationId || !loading) return

    const interval = setInterval(async () => {
      // Check if we've exceeded max poll time
      if (Date.now() - pollStartTime > maxPollTime) {
        setError('Generation timeout - please check back later')
        setLoading(false)
        return
      }

      await fetchGenerationStatus()
    }, pollInterval)

    return () => clearInterval(interval)
  }, [enabled, generationId, loading, pollInterval, maxPollTime, pollStartTime, fetchGenerationStatus])

  return {
    generation,
    loading,
    error,
    refetch,
  }
}

/**
 * Hook for polling multiple generations
 */
export function useGenerationsList(options?: {
  page?: number
  limit?: number
  status?: string
  type?: string
}) {
  const [generations, setGenerations] = useState<GenerationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Record<string, unknown> | null>(null)

  const fetchGenerations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (options?.page) params.set('page', options.page.toString())
      if (options?.limit) params.set('limit', options.limit.toString())
      if (options?.status) params.set('status', options.status)
      if (options?.type) params.set('type', options.type)

      const response = await fetch(`/api/generations/list?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch generations: ${response.statusText}`)
      }

      const data = await response.json()
      setGenerations(data.generations)
      setPagination(data.pagination)
      setError(null)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [options])

  useEffect(() => {
    fetchGenerations()
  }, [fetchGenerations])

  return {
    generations,
    pagination,
    loading,
    error,
    refetch: fetchGenerations,
  }
}
