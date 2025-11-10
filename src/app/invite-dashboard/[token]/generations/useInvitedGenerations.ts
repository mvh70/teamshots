'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { GenerationListItem } from '@/app/[locale]/app/generations/components/GenerationCard'
import { transformInvitedGeneration } from './utils'

export function useInvitedGenerations(token: string) {
  const [generations, setGenerations] = useState<GenerationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previousGenerationsRef = useRef<GenerationListItem[]>([])

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

  // Auto-refresh when there are processing generations
  useEffect(() => {
    const hasProcessingGenerations = generations.some(
      gen => gen.status === 'processing' || gen.status === 'pending'
    )

    if (!hasProcessingGenerations) {
      return
    }

    const interval = setInterval(() => {
      fetchGenerations()
    }, 3000) // Check every 3 seconds

    return () => {
      clearInterval(interval)
    }
  }, [generations, fetchGenerations])

  return { generations, loading, error, refetch: fetchGenerations }
}

