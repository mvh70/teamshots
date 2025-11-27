'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { GenerationListItem } from '@/app/[locale]/app/generations/components/GenerationCard'
import { transformInvitedGeneration } from './utils'

const COMPLETION_REFRESH_WINDOW_MS = 4000

export function useInvitedGenerations(token: string) {
  const [generations, setGenerations] = useState<GenerationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previousGenerationsRef = useRef<GenerationListItem[]>([])
  const [isCompletionRefreshActive, setIsCompletionRefreshActive] = useState(false)
  const completionRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previouslyProcessingRef = useRef(false)

  const fetchGenerations = useCallback(async () => {
    try {
      // Only show the full-page loading state on the first load to avoid flashing during auto-refresh
      if (!initialLoadDone) {
        setLoading(true)
      }
      const response = await fetch(`/api/team/member/generations?token=${token}`)
      
      if (response.ok) {
        const data = await response.json()
        const transformed = data.generations.map(transformInvitedGeneration)
        setGenerations(transformed)
        previousGenerationsRef.current = transformed
        setError(null)
      } else {
        setError('Failed to fetch generations')
      }
    } catch (err) {
      setError('Failed to fetch generations')
      console.error('Error fetching invited generations:', err)
    } finally {
      setLoading(false)
      if (!initialLoadDone) {
        setInitialLoadDone(true)
      }
    }
  }, [token, initialLoadDone])

  useEffect(() => {
    fetchGenerations()
  }, [fetchGenerations])

  const hasProcessingGenerations = useMemo(() => (
    generations.some(gen => gen.status === 'processing' || gen.status === 'pending')
  ), [generations])

  // Keep refreshing briefly after the last generation completes to ensure we fetch generated keys
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
      completionRefreshTimeoutRef.current = setTimeout(() => {
        setIsCompletionRefreshActive(false)
        completionRefreshTimeoutRef.current = null
      }, COMPLETION_REFRESH_WINDOW_MS)

      // Force an immediate refresh to pick up the generated photo keys before the tour runs
      fetchGenerations()
    }
  }, [hasProcessingGenerations, fetchGenerations])

  // Auto-refresh when there are processing generations or we're inside the completion refresh window
  useEffect(() => {
    if (!hasProcessingGenerations && !isCompletionRefreshActive) {
      return
    }

    const interval = setInterval(() => {
      fetchGenerations()
    }, 3000) // Check every 3 seconds

    return () => {
      clearInterval(interval)
    }
  }, [hasProcessingGenerations, isCompletionRefreshActive, fetchGenerations])

  useEffect(() => {
    return () => {
      if (completionRefreshTimeoutRef.current) {
        clearTimeout(completionRefreshTimeoutRef.current)
      }
    }
  }, [])

  return { generations, loading, error, refetch: fetchGenerations }
}

