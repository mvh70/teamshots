'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface CreditsContextType {
  credits: {
    individual: number
    company: number
  }
  loading: boolean
  refetch: () => Promise<void>
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined)

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [credits, setCredits] = useState({ individual: 0, company: 0 })
  const [loading, setLoading] = useState(true)

  const fetchCredits = useCallback(async () => {
    if (!session?.user?.id) {
      setCredits({ individual: 0, company: 0 })
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Fetch both credit types in parallel
      const [individualResponse, companyResponse] = await Promise.all([
        fetch('/api/credits/balance?type=individual'),
        fetch('/api/credits/balance?type=company')
      ])

      const individualCredits = individualResponse.ok ? await individualResponse.json() : { balance: 0 }
      const companyCredits = companyResponse.ok ? await companyResponse.json() : { balance: 0 }

      setCredits({
        individual: individualCredits.balance || 0,
        company: companyCredits.balance || 0
      })
    } catch (err) {
      console.error('Failed to fetch credits:', err)
      setCredits({ individual: 0, company: 0 })
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    fetchCredits()
  }, [session?.user?.id, fetchCredits])

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
