'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { TenantId } from '@/config/tenant'

interface TenantContextValue {
  tenantId: TenantId
  brandName: string
  hasTeamFeatures: boolean
  isIndividualDomain: boolean
}

const TenantContext = createContext<TenantContextValue>({
  tenantId: 'teamshotspro',
  brandName: 'TeamShotsPro',
  hasTeamFeatures: true,
  isIndividualDomain: false,
})

interface TenantProviderProps {
  children: ReactNode
  tenantId: TenantId
  brandName: string
  hasTeamFeatures: boolean
}

export function TenantProvider({
  children,
  tenantId,
  brandName,
  hasTeamFeatures,
}: TenantProviderProps) {
  const value = useMemo(
    () => ({
      tenantId,
      brandName,
      hasTeamFeatures,
      isIndividualDomain: !hasTeamFeatures,
    }),
    [tenantId, brandName, hasTeamFeatures]
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext)
}

/**
 * Backward-compatible hook shape while consumers migrate to useTenant().
 */
export function useDomain(): Pick<TenantContextValue, 'brandName' | 'isIndividualDomain'> {
  const { brandName, isIndividualDomain } = useTenant()
  return { brandName, isIndividualDomain }
}

interface LegacyDomainProviderProps {
  children: ReactNode
  isIndividualDomain: boolean
  brandName: string
}

/**
 * Backward-compatible provider while imports migrate from DomainContext.
 */
export function DomainProvider({
  children,
  isIndividualDomain,
  brandName,
}: LegacyDomainProviderProps) {
  const hasTeamFeatures = !isIndividualDomain
  const tenantId: TenantId = hasTeamFeatures ? 'teamshotspro' : 'portreya'

  return (
    <TenantProvider
      tenantId={tenantId}
      brandName={brandName}
      hasTeamFeatures={hasTeamFeatures}
    >
      {children}
    </TenantProvider>
  )
}
