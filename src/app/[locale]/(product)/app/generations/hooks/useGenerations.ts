'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { GenerationListItem } from '../components/GenerationCard'
import { useGenerationFilters } from '@/hooks/useGenerationFilters'
import { useSWR, swrFetcher, mutate } from '@/lib/swr'

const noStoreRequestInit = {
  cache: 'no-store' as RequestCache,
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache'
  }
}

interface GenerationsApiResponse {
  generations?: Record<string, unknown>[]
  items?: Record<string, unknown>[]
  pagination?: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

interface TeamMembersResponse {
  users: { id: string; name: string }[]
}

function mapGeneration(g: Record<string, unknown>): GenerationListItem {
  return {
    id: g.id,
    uploadedKey: g.uploadedKey,
    acceptedKey: g.acceptedKey,
    selfieKey: g.selfieKey,
    generatedKey: g.generatedKey,
    inputSelfieUrls: g.inputSelfieUrls as string[] | undefined,
    status: g.status,
    createdAt: g.createdAt,
    contextName: (g.context as Record<string, unknown>)?.name as string,
    contextId: (g.context as Record<string, unknown>)?.id as string,
    costCredits: (g.creditsUsed as number) ?? 0,
    isOwnGeneration: g.isOwnGeneration,
    generationType: g.generationType,
    maxRegenerations: g.maxRegenerations,
    remainingRegenerations: g.remainingRegenerations,
    isOriginal: g.isOriginal,
    personId: (g.person as Record<string, unknown>)?.id as string,
    personFirstName: (g.person as Record<string, unknown>)?.firstName as string,
    personUserId: (g.person as Record<string, unknown>)?.userId as string,
    jobStatus: g.jobStatus as GenerationListItem['jobStatus'],
  } as GenerationListItem
}

export function useGenerations(
  currentUserId?: string,
  isTeamAdmin?: boolean,
  currentUserName?: string,
  currentPersonId?: string,
  scope: 'personal' | 'team' = 'personal',
  teamView?: 'mine' | 'team',
  selectedUserId: string = 'all',
  onGenerationFailed?: (details: { id: string; errorMessage?: string }) => void
) {
  const [page, setPage] = useState(1)
  const previousGenerationsRef = useRef<GenerationListItem[]>([])
  const previousKeyRef = useRef<string | null>(null)
  const notifiedFailuresRef = useRef<Set<string>>(new Set())

  const effectiveTeamView = teamView || 'mine'

  // Build SWR key for generations
  const generationsKey = useMemo(() => {
    const url = new URL('/api/generations/list', 'http://localhost')
    url.searchParams.set('page', page.toString())
    url.searchParams.set('limit', '50')

    if (scope === 'team') {
      url.searchParams.set('teamView', effectiveTeamView)
      if (isTeamAdmin && selectedUserId && selectedUserId !== 'all') {
        url.searchParams.set('userId', selectedUserId)
      }
    }

    return url.pathname + url.search
  }, [page, scope, effectiveTeamView, isTeamAdmin, selectedUserId])

  // Fetch team members for admin
  const { data: teamMembersData } = useSWR<TeamMembersResponse>(
    isTeamAdmin ? '/api/team/members' : null,
    swrFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  const teamUsers = teamMembersData?.users || [
    { id: currentPersonId || currentUserId || 'u_current', name: currentUserName || 'Me' }
  ]

  // Fetch generations with smart polling
  const { data: generationsData, isLoading } = useSWR<GenerationsApiResponse>(
    generationsKey,
    (url: string) => swrFetcher<GenerationsApiResponse>(url, noStoreRequestInit),
    {
      revalidateOnFocus: false,
      dedupingInterval: 1000,
      refreshInterval: (latestData) => {
        const items = latestData?.generations || latestData?.items || []
        const hasActiveGenerations = items.some(
          g => g.status === 'pending' || g.status === 'processing'
        )
        // Poll every 2s when active, 30s otherwise
        return hasActiveGenerations ? 2000 : 30000
      },
    }
  )

  // Map raw data to GenerationListItem
  const rawItems = generationsData?.generations || generationsData?.items || []
  const generated = useMemo(() => rawItems.map(mapGeneration), [rawItems])
  const pagination = generationsData?.pagination || null

  useEffect(() => {
    // Reset baseline whenever the list key changes (page, scope, team view, user filter)
    // so removals from a previous view are not treated as failures in the new view.
    if (previousKeyRef.current !== generationsKey) {
      previousGenerationsRef.current = generated
      previousKeyRef.current = generationsKey
      return
    }

    if (!onGenerationFailed || previousGenerationsRef.current.length === 0) {
      previousGenerationsRef.current = generated
      return
    }

    const previousProcessingIds = previousGenerationsRef.current
      .filter(g => g.status === 'processing' || g.status === 'pending')
      .map(g => g.id)
    const currentIds = new Set(generated.map(g => g.id))
    const removedProcessingIds = previousProcessingIds.filter(id => !currentIds.has(id))

    if (removedProcessingIds.length === 0) {
      previousGenerationsRef.current = generated
      return
    }

    let cancelled = false

    const notifyRemovedFailures = async () => {
      await Promise.all(
        removedProcessingIds
          .filter(id => !notifiedFailuresRef.current.has(id))
          .map(async (id) => {
            try {
              const detail = await swrFetcher<{ status: string; errorMessage?: string }>(
                `/api/generations/${id}`,
                {
                  cache: 'no-store',
                  headers: {
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache'
                  }
                }
              )
              if (!cancelled && detail.status === 'failed') {
                notifiedFailuresRef.current.add(id)
                onGenerationFailed({ id, errorMessage: detail.errorMessage })
              }
            } catch {
              // Ignore fetch errors for removed generations
            }
          })
      )
      if (!cancelled) {
        previousGenerationsRef.current = generated
      }
    }

    void notifyRemovedFailures()

    return () => {
      cancelled = true
    }
  }, [generated, onGenerationFailed, generationsKey])

  // Reset to page 1 when filters change
  useEffect(() => {
    queueMicrotask(() => {
      setPage(1)
    })
  }, [scope, effectiveTeamView, selectedUserId])

  const loadMore = useCallback(() => {
    if (pagination?.hasNextPage && !isLoading) {
      setPage(prev => prev + 1)
    }
  }, [pagination?.hasNextPage, isLoading])

  const loadGenerations = useCallback(async () => {
    await mutate(generationsKey)
  }, [generationsKey])

  return { generated, teamUsers, pagination, loading: isLoading, loadMore, loadGenerations }
}

export { useGenerationFilters }
