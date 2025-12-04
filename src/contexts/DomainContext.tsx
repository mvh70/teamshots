'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface DomainContextValue {
  /** If true, this is an individual-only domain (photoshotspro.com) - no team features */
  isIndividualDomain: boolean
}

const DomainContext = createContext<DomainContextValue>({
  isIndividualDomain: false,
})

interface DomainProviderProps {
  children: ReactNode
  isIndividualDomain: boolean
}

export function DomainProvider({ children, isIndividualDomain }: DomainProviderProps) {
  return (
    <DomainContext.Provider value={{ isIndividualDomain }}>
      {children}
    </DomainContext.Provider>
  )
}

export function useDomain(): DomainContextValue {
  return useContext(DomainContext)
}

