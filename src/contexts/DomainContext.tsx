'use client'

import { createContext, useContext, type ReactNode } from 'react'

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
  return (
    <DomainContext.Provider value={{ isIndividualDomain, brandName }}>
      {children}
    </DomainContext.Provider>
  )
}

export function useDomain(): DomainContextValue {
  return useContext(DomainContext)
}

