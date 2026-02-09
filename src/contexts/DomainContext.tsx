'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

interface DomainContextValue {
  /** If true, this is an individual-only domain (portreya.com) - no team features */
  isIndividualDomain: boolean
  /** Brand name from server-side detection (authoritative) */
  brandName: string
}

const DomainContext = createContext<DomainContextValue>({
  isIndividualDomain: false,
  brandName: 'TeamShotsPro',
})

interface DomainProviderProps {
  children: ReactNode
  isIndividualDomain: boolean
  brandName: string
}

export function DomainProvider({ children, isIndividualDomain, brandName }: DomainProviderProps) {
  const value = useMemo(() => ({ isIndividualDomain, brandName }), [isIndividualDomain, brandName])
  return (
    <DomainContext.Provider value={value}>
      {children}
    </DomainContext.Provider>
  )
}

export function useDomain(): DomainContextValue {
  return useContext(DomainContext)
}

