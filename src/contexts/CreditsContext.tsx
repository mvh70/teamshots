'use client'

import React, { createContext, useContext, ReactNode, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSWR, swrFetcher, mutate } from '@/lib/swr'

interface CreditsData {
  individual: number
  team: number
  person: number
}

interface CreditsContextType {
  credits: CreditsData
  loading: boolean
  refetch: () => Promise<void>
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined)

const CREDITS_KEY = '/api/credits/balance?type=both'
const defaultCredits: CreditsData = { individual: 0, team: 0, person: 0 }

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
  const userId = session?.user?.id

  const fallbackData = initialCredits
    ? {
        individual: initialCredits.individual,
        team: initialCredits.team,
        person: initialCredits.person || 0
      }
    : undefined

  const { data, isLoading } = useSWR<CreditsData>(
    userId ? CREDITS_KEY : null,
    swrFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      focusThrottleInterval: 5000, // Prevent focus storms
      fallbackData,
    }
  )

  const refetch = useCallback(async () => {
    if (userId) {
      await mutate(CREDITS_KEY)
    }
  }, [userId])

  const credits = data || defaultCredits

  return (
    <CreditsContext.Provider value={{ credits, loading: isLoading, refetch }}>
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
