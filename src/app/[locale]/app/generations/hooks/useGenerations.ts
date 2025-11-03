'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { GenerationListItem } from '../components/GenerationCard'
import { jsonFetcher } from '@/lib/fetcher'

export function useGenerations(
  currentUserId?: string,
  isTeamAdmin?: boolean,
  currentUserName?: string,
  scope: 'personal' | 'team' = 'personal',
  teamView?: 'mine' | 'team',
  selectedUserId: string = 'all',
  onGenerationFailed?: (details: { id: string; errorMessage?: string }) => void
) {
  // Mock data; replace with real fetch later
  const [generated, setGenerated] = useState<GenerationListItem[]>([])
  const [pagination, setPagination] = useState<{
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const previousGenerationsRef = useRef<GenerationListItem[]>([])
  const notifiedFailuresRef = useRef<Set<string>>(new Set())

  // Mock team users (current + teammate). Replace with real team members later
  const [teamUsers, setTeamUsers] = useState<{id:string; name:string}[]>([
    { id: currentUserId || 'u_current', name: currentUserName || 'Me' }
  ])
  useEffect(() => {
    const load = async () => {
      try {
        const data = await jsonFetcher<{ users: { id: string; name: string }[] }>('/api/team/members')
        if (Array.isArray(data.users)) setTeamUsers(data.users)
      } catch {}
    }
    if (isTeamAdmin) load()
  }, [isTeamAdmin])

  // Determine effective scope and teamView
  const effectiveScope = scope
  const effectiveTeamView = teamView || 'mine'

  // Load from API
  const loadGenerations = useCallback(async (page: number = 1, append: boolean = false) => {
    setLoading(true)
    try {
      const url = new URL('/api/generations/list', window.location.origin)
      url.searchParams.set('page', page.toString())
      url.searchParams.set('limit', '50') // Increase limit to 50
      url.searchParams.set('scope', effectiveScope)
      
      if (effectiveScope === 'team') {
        if (effectiveTeamView) {
          url.searchParams.set('teamView', effectiveTeamView)
        }
        if (isTeamAdmin && selectedUserId && selectedUserId !== 'all') {
          url.searchParams.set('userId', selectedUserId)
        }
      }
      
      const data = await jsonFetcher<{ generations: Record<string, unknown>[]; pagination?: Record<string, unknown>; items?: Record<string, unknown>[] }>(url.toString())
      // New API returns { generations, pagination }
      if (Array.isArray(data.generations)) {
          const mapped = data.generations.map((g: Record<string, unknown>) => ({
            id: g.id,
            uploadedKey: g.uploadedKey,
            acceptedKey: g.acceptedKey,
            selfieKey: g.selfieKey,
            generatedKey: g.generatedKey,
            status: g.status,
            createdAt: g.createdAt,
            contextName: (g.context as Record<string, unknown>)?.name as string,
            contextId: (g.context as Record<string, unknown>)?.id as string,
            costCredits: (g.creditsUsed as number) ?? 0,
            isOwnGeneration: g.isOwnGeneration,
            generationType: g.generationType,
            adminApproved: g.adminApproved,
            maxRegenerations: g.maxRegenerations,
            remainingRegenerations: g.remainingRegenerations,
            isOriginal: g.isOriginal,
            personFirstName: (g.person as Record<string, unknown>)?.firstName as string,
            personUserId: (g.person as Record<string, unknown>)?.userId as string,
            jobStatus: g.jobStatus as GenerationListItem['jobStatus'],
          })) as GenerationListItem[]
          if (append) {
            setGenerated(prev => {
              const merged = [...prev, ...mapped]
              previousGenerationsRef.current = merged
              return merged
            })
          } else {
            if (onGenerationFailed && previousGenerationsRef.current.length > 0) {
              const previousProcessingIds = previousGenerationsRef.current
                .filter(g => g.status === 'processing' || g.status === 'pending')
                .map(g => g.id)
              const currentIds = new Set(mapped.map(g => g.id))
              const removedProcessingIds = previousProcessingIds.filter(id => !currentIds.has(id))

              if (removedProcessingIds.length > 0) {
                await Promise.all(
                  removedProcessingIds
                    .filter(id => !notifiedFailuresRef.current.has(id))
                    .map(async (id) => {
                      try {
                        const detail = await jsonFetcher<{ status: string; errorMessage?: string }>(`/api/generations/${id}`)
                        if (detail.status === 'failed') {
                          notifiedFailuresRef.current.add(id)
                          onGenerationFailed({ id, errorMessage: detail.errorMessage })
                        }
                      } catch {
                        // Ignore fetch errors for removed generations
                      }
                    })
                )
              }
            }

            setGenerated(mapped)
            previousGenerationsRef.current = mapped
          }

          if (data.pagination) {
            setPagination(data.pagination as {
              page: number
              limit: number
              totalCount: number
              totalPages: number
              hasNextPage: boolean
              hasPrevPage: boolean
            })
          }
        } else if (Array.isArray(data.items)) {
          // Backward compatibility
          const mappedItems = data.items.map((g: Record<string, unknown>) => ({
            id: g.id,
            uploadedKey: g.uploadedKey,
            acceptedKey: g.acceptedKey,
            selfieKey: g.selfieKey,
            generatedKey: g.generatedKey,
            status: g.status,
            createdAt: g.createdAt,
            contextName: (g.context as Record<string, unknown>)?.name as string,
            contextId: (g.context as Record<string, unknown>)?.id as string,
            costCredits: (g.creditsUsed as number) ?? 0,
            isOwnGeneration: g.isOwnGeneration,
            generationType: g.generationType,
            adminApproved: g.adminApproved,
            maxRegenerations: g.maxRegenerations,
            remainingRegenerations: g.remainingRegenerations,
            isOriginal: g.isOriginal,
            personFirstName: (g.person as Record<string, unknown>)?.firstName as string,
            personUserId: (g.person as Record<string, unknown>)?.userId as string,
            jobStatus: g.jobStatus as GenerationListItem['jobStatus'],
          })) as GenerationListItem[]
          if (append) {
            setGenerated(prev => {
              const merged = [...prev, ...mappedItems]
              previousGenerationsRef.current = merged
              return merged
            })
          } else {
            if (onGenerationFailed && previousGenerationsRef.current.length > 0) {
              const previousProcessingIds = previousGenerationsRef.current
                .filter(g => g.status === 'processing' || g.status === 'pending')
                .map(g => g.id)
              const currentIds = new Set(mappedItems.map(g => g.id))
              const removedProcessingIds = previousProcessingIds.filter(id => !currentIds.has(id))

              if (removedProcessingIds.length > 0) {
                await Promise.all(
                  removedProcessingIds
                    .filter(id => !notifiedFailuresRef.current.has(id))
                    .map(async (id) => {
                      try {
                        const detail = await jsonFetcher<{ status: string; errorMessage?: string }>(`/api/generations/${id}`)
                        if (detail.status === 'failed') {
                          notifiedFailuresRef.current.add(id)
                          onGenerationFailed({ id, errorMessage: detail.errorMessage })
                        }
                      } catch {
                        // Ignore fetch errors for removed generations
                      }
                    })
                )
              }
            }

            setGenerated(mappedItems)
            previousGenerationsRef.current = mappedItems
          }
        }
    } catch {}
    setLoading(false)
  }, [effectiveScope, effectiveTeamView, isTeamAdmin, selectedUserId, onGenerationFailed])

  useEffect(() => {
    loadGenerations(1, false)
  }, [effectiveScope, effectiveTeamView, selectedUserId, loadGenerations])

  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Only poll if we're not currently loading and not on a paginated view
      if (!loading && (!pagination || pagination.page === 1)) {
        loadGenerations(1, false)
      }
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [loading, pagination, loadGenerations])

  const loadMore = () => {
    if (pagination?.hasNextPage && !loading) {
      loadGenerations((pagination.page || 1) + 1, true)
    }
  }

  return { generated, teamUsers, pagination, loading, loadMore }
}

export function useGenerationFilters() {
  const [timeframe, setTimeframe] = useState<'all'|'7d'|'30d'>('all')
  const [context, setContext] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('me')
  const [selectedUserId, setSelectedUserId] = useState<string>('all')

  const filterGenerated = (items: GenerationListItem[]) => {
    const now = Date.now()
    const inTimeframe = (date: string) => {
      if (timeframe === 'all') return true
      const diff = now - new Date(date).getTime()
      return timeframe === '7d' ? diff <= 7*86400000 : diff <= 30*86400000
    }
    return items.filter(i =>
      inTimeframe(i.createdAt) &&
      (context === 'all' || (i.contextName || 'Freestyle') === context)
    )
  }

  return { timeframe, context, userFilter, selectedUserId, setTimeframe, setContext, setUserFilter, setSelectedUserId, filterGenerated }
}


