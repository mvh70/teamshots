'use client'

import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import type { GenerationListItem } from '@/app/[locale]/(product)/app/generations/components/GenerationCard'
import { transformInvitedGeneration } from './utils'
import { useSWR, mutate } from '@/lib/swr'

const COMPLETION_REFRESH_WINDOW_MS = 4000

interface InvitedGeneration {
  id: string
  selfieKey: string
  selfieUrl: string
  inputSelfieUrls?: string[]
  generatedPhotos: Array<{
    id: string
    url: string
    style: string
  }>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  generationType: 'personal' | 'team'
  creditsUsed: number
  maxRegenerations: number
  remainingRegenerations: number
  isOriginal: boolean
  jobStatus?: {
    id: string
    progress: number
    message?: string
    attemptsMade: number
    processedOn?: number
    finishedOn?: number
    failedReason?: string
  }
}

interface InvitedGenerationsResponse {
  generations: InvitedGeneration[]
}

export function useInvitedGenerations(token: string) {
  const [isCompletionRefreshActive, setIsCompletionRefreshActive] = useState(false)
  const completionRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previouslyProcessingRef = useRef(false)

  const key = token ? `/api/team/member/generations?token=${token}` : null

  const fetcher = useCallback(async (url: string): Promise<InvitedGenerationsResponse> => {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    })
    if (!response.ok) {
      throw new Error('Failed to fetch generations')
    }
    return response.json()
  }, [])

  const { data, error, isLoading } = useSWR<InvitedGenerationsResponse>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 1000,
      refreshInterval: (latestData) => {
        const items = latestData?.generations || []
        const hasProcessing = items.some(
          g => g.status === 'processing' || g.status === 'pending'
        )
        // Poll every 3s when processing or in completion refresh window
        return (hasProcessing || isCompletionRefreshActive) ? 3000 : 0
      },
    }
  )

  const generations: GenerationListItem[] = useMemo(() => {
    return (data?.generations || []).map(transformInvitedGeneration)
  }, [data?.generations])

  const hasProcessingGenerations = useMemo(
    () => generations.some(gen => gen.status === 'processing' || gen.status === 'pending'),
    [generations]
  )

  // Handle completion refresh window
  useEffect(() => {
    if (hasProcessingGenerations) {
      previouslyProcessingRef.current = true
      if (completionRefreshTimeoutRef.current) {
        clearTimeout(completionRefreshTimeoutRef.current)
        completionRefreshTimeoutRef.current = null
      }
      setIsCompletionRefreshActive(false)
      return
    }

    if (previouslyProcessingRef.current && !hasProcessingGenerations) {
      previouslyProcessingRef.current = false
      if (completionRefreshTimeoutRef.current) {
        clearTimeout(completionRefreshTimeoutRef.current)
      }
      setIsCompletionRefreshActive(true)

      // Force immediate refresh to pick up generated photo keys
      if (key) {
        mutate(key)
      }

      completionRefreshTimeoutRef.current = setTimeout(() => {
        setIsCompletionRefreshActive(false)
        completionRefreshTimeoutRef.current = null
      }, COMPLETION_REFRESH_WINDOW_MS)
    }
  }, [hasProcessingGenerations, key])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (completionRefreshTimeoutRef.current) {
        clearTimeout(completionRefreshTimeoutRef.current)
      }
    }
  }, [])

  const refetch = useCallback(async () => {
    if (key) {
      await mutate(key)
    }
  }, [key])

  return {
    generations,
    loading: isLoading,
    error: error ? 'Failed to fetch generations' : null,
    refetch,
  }
}
