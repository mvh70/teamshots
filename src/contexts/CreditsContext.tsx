'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { jsonFetcher } from '@/lib/fetcher'

interface CreditsContextType {
  credits: {
    individual: number
    team: number
    person: number
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
    person?: number
  }
}

export function CreditsProvider({ children, initialCredits }: CreditsProviderProps) {
  const { data: session } = useSession()
  
  // Initialize credits state: try sessionStorage first, then props, then defaults
  const [credits, setCredits] = useState(() => {
    // Props take precedence
    if (initialCredits) {
      return {
        individual: initialCredits.individual,
        team: initialCredits.team,
        person: initialCredits.person || 0
      }
    }
    // Check sessionStorage for cached data (SSR-safe with function initializer)
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('teamshots.initialData')
        if (stored) {
          const initialData = JSON.parse(stored)
          if (initialData.credits) {
            return {
              individual: initialData.credits.individual || 0,
              team: initialData.credits.team || 0,
              person: initialData.credits.person || 0
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
    return { individual: 0, team: 0, person: 0 }
  })
  const [loading, setLoading] = useState(!initialCredits)

  const fetchCredits = useCallback(async () => {
    if (!session?.user?.id) {
      setCredits({ individual: 0, team: 0, person: 0 })
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // OPTIMIZATION: Fetch both credit types in a single API call
      // This reduces from 2 HTTP requests + 4+ queries to 1 HTTP request + 2-3 queries
      // Add timestamp to prevent caching
      const creditsData = await jsonFetcher<{ individual: number; team: number; person: number }>(`/api/credits/balance?type=both&_t=${Date.now()}`)
        .catch(() => ({ individual: 0, team: 0, person: 0 }))

      setCredits({
        individual: creditsData.individual || 0,
        team: creditsData.team || 0,
        person: creditsData.person || 0
      })
    } catch (err) {
      console.error('Failed to fetch credits:', err)
      setCredits({ individual: 0, team: 0, person: 0 })
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id]) // Stable callback - session is checked at runtime, API uses server-side auth

  useEffect(() => {
    // Skip fetching if we have initial credits from props
    if (initialCredits) {
      setLoading(false)
      return
    }

    // Check if we have cached data and if it's fresh enough
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('teamshots.initialData')
        if (stored) {
          const initialData = JSON.parse(stored)
          if (initialData.credits) {
            // Data already loaded in useState initializer
            setLoading(false)
            // Only fetch fresh data if data is stale (>5 seconds)
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
