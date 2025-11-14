'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { jsonFetcher } from '@/lib/fetcher'

interface CreditsContextType {
  credits: {
    individual: number
    team: number
  }
  loading: boolean
  refetch: () => Promise<void>
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined)

interface CreditsProviderProps {
  children: ReactNode
  initialCredits?: {
    individual: number
    team: number
  }
}

export function CreditsProvider({ children, initialCredits }: CreditsProviderProps) {
  const { data: session } = useSession()
  const [credits, setCredits] = useState(initialCredits || { individual: 0, team: 0 })
  const [loading, setLoading] = useState(!initialCredits)

  const fetchCredits = useCallback(async () => {
    if (!session?.user?.id) {
      setCredits({ individual: 0, team: 0 })
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // OPTIMIZATION: Fetch both credit types in a single API call
      // This reduces from 2 HTTP requests + 4+ queries to 1 HTTP request + 2-3 queries
      const creditsData = await jsonFetcher<{ individual: number; team: number }>('/api/credits/balance?type=both')
        .catch(() => ({ individual: 0, team: 0 }))

      setCredits({
        individual: creditsData.individual || 0,
        team: creditsData.team || 0
      })
    } catch (err) {
      console.error('Failed to fetch credits:', err)
      setCredits({ individual: 0, team: 0 })
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id]) // Stable callback - session is checked at runtime, API uses server-side auth

  useEffect(() => {
    // If we have initialCredits from props, use them and skip fetching
    if (initialCredits) {
      setCredits(initialCredits)
      setLoading(false)
      return
    }

    // Check sessionStorage for initial data first (from /api/user/initial-data)
    try {
      const stored = sessionStorage.getItem('teamshots.initialData')
      if (stored) {
        const initialData = JSON.parse(stored)
        if (initialData.credits) {
          setCredits({
            individual: initialData.credits.individual || 0,
            team: initialData.credits.team || 0
          })
          setLoading(false)
          // Only fetch fresh data if data is stale (>5 seconds)
          // This prevents redundant calls immediately after login/registration
          const dataAge = Date.now() - (initialData._timestamp || 0)
          if (dataAge > 5000) {
            // Fetch in background, don't block render
            fetchCredits()
          }
          return
        }
      }
    } catch {
      // Ignore parse errors, fall through to fetch
    }
    
    // Only fetch if we don't have cached data
    fetchCredits()
  }, [fetchCredits, initialCredits])

  return (
    <CreditsContext.Provider value={{ credits, loading, refetch: fetchCredits }}>
      {children}
    </CreditsContext.Provider>
  )
}

export function useCredits() {
  const context = useContext(CreditsContext)
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider')
  }
  return context
}
