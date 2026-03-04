import {
  TEAM_DOMAIN,
  PORTREYA_DOMAIN,
  EXTENSION_DOMAIN,
  COUPLES_DOMAIN,
  FAMILY_DOMAIN,
} from './domain'

export type TenantId = 'teamshotspro' | 'portreya' | 'rightclickfit' | 'coupleshots' | 'familyshots'
export type TenantSignupType = 'team' | 'individual'
export type TenantLandingVariant =
  | 'teamshotspro'
  | 'portreya'
  | 'rightclickfit'
  | 'coupleshots'
  | 'familyshots'

export interface TenantConfig {
  id: TenantId
  domain: string
  signupType: TenantSignupType
  hasTeamFeatures: boolean
  cmsBrandId: string
  messageFile: string
  landingVariant: TenantLandingVariant
  brandName: string
  features: {
    blog: boolean
    solutions: boolean
  }
  isExecutionCritical: boolean
}

export const DEFAULT_TENANT_ID: TenantId = 'teamshotspro'

export const TENANTS: Record<TenantId, TenantConfig> = {
  teamshotspro: {
    id: 'teamshotspro',
    domain: TEAM_DOMAIN,
    signupType: 'team',
    hasTeamFeatures: true,
    cmsBrandId: 'teamshotspro',
    messageFile: 'teamshotspro',
    landingVariant: 'teamshotspro',
    brandName: 'TeamShotsPro',
    features: {
      blog: true,
      solutions: true,
    },
    isExecutionCritical: true,
  },
  portreya: {
    id: 'portreya',
    domain: PORTREYA_DOMAIN,
    signupType: 'individual',
    hasTeamFeatures: false,
    cmsBrandId: 'portreya',
    messageFile: 'individualshots',
    landingVariant: 'portreya',
    brandName: 'Portreya',
    features: {
      blog: false,
      solutions: false,
    },
    isExecutionCritical: true,
  },
  rightclickfit: {
    id: 'rightclickfit',
    domain: EXTENSION_DOMAIN,
    signupType: 'individual',
    hasTeamFeatures: false,
    cmsBrandId: 'rightclick-fit',
    messageFile: 'rightclickfit',
    landingVariant: 'rightclickfit',
    brandName: 'RightClickFit',
    features: {
      blog: false,
      solutions: false,
    },
    isExecutionCritical: true,
  },
  coupleshots: {
    id: 'coupleshots',
    domain: COUPLES_DOMAIN,
    signupType: 'individual',
    hasTeamFeatures: false,
    cmsBrandId: 'duo-snaps',
    messageFile: 'coupleshotspro',
    landingVariant: 'coupleshots',
    brandName: 'CoupleShots',
    features: {
      blog: false,
      solutions: false,
    },
    isExecutionCritical: false,
  },
  familyshots: {
    id: 'familyshots',
    domain: FAMILY_DOMAIN,
    signupType: 'individual',
    hasTeamFeatures: false,
    cmsBrandId: 'kin-frame',
    messageFile: 'familyshotspro',
    landingVariant: 'familyshots',
    brandName: 'FamilyShots',
    features: {
      blog: false,
      solutions: false,
    },
    isExecutionCritical: false,
  },
}

export const DOMAIN_TO_TENANT: Record<string, TenantId> = {
  [TEAM_DOMAIN]: 'teamshotspro',
  [PORTREYA_DOMAIN]: 'portreya',
  [EXTENSION_DOMAIN]: 'rightclickfit',
  [COUPLES_DOMAIN]: 'coupleshots',
  [FAMILY_DOMAIN]: 'familyshots',
}

export const TENANT_ALLOWED_DOMAINS = [
  TEAM_DOMAIN,
  PORTREYA_DOMAIN,
  EXTENSION_DOMAIN,
  COUPLES_DOMAIN,
  FAMILY_DOMAIN,
] as const

function normalizeHostLikeInput(value: string | null | undefined): string | null {
  if (!value) return null

  const firstValue = value.split(',')[0]?.trim().toLowerCase()
  if (!firstValue) return null

  // IPv6 values can look like [::1]:3000.
  if (firstValue.startsWith('[')) {
    const end = firstValue.indexOf(']')
    if (end >= 0) {
      return firstValue.slice(0, end + 1)
    }
    return firstValue
  }

  return firstValue.split(':')[0].replace(/^www\./, '')
}

function resolveLocalhostOverride(domain: string): string | null {
  if (domain !== 'localhost' && domain !== '127.0.0.1') {
    return domain
  }

  const forced = normalizeHostLikeInput(process.env.NEXT_PUBLIC_FORCE_DOMAIN)
  return forced
}

export function resolveTenantId(domainOrHost?: string | null): TenantId | null {
  const normalized = normalizeHostLikeInput(domainOrHost)
  if (!normalized) return null

  const resolvedDomain = resolveLocalhostOverride(normalized)
  if (!resolvedDomain) return null

  if (DOMAIN_TO_TENANT[resolvedDomain]) {
    return DOMAIN_TO_TENANT[resolvedDomain]
  }

  if (!resolvedDomain.includes('.')) {
    const withCom = `${resolvedDomain}.com`
    if (DOMAIN_TO_TENANT[withCom]) {
      return DOMAIN_TO_TENANT[withCom]
    }
  }

  return null
}

export function getTenantById(tenantId: TenantId): TenantConfig {
  return TENANTS[tenantId]
}

export function getTenantByDomain(domainOrHost?: string | null): TenantConfig | null {
  const tenantId = resolveTenantId(domainOrHost)
  if (!tenantId) return null
  return getTenantById(tenantId)
}

export function getPersonalSignupTenantId(currentTenantId: TenantId): TenantId {
  const currentTenant = getTenantById(currentTenantId)
  if (currentTenant.signupType === 'individual') {
    return currentTenant.id
  }

  const preferred = Object.values(TENANTS).find(
    tenant => tenant.signupType === 'individual' && tenant.isExecutionCritical
  )
  if (preferred) {
    return preferred.id
  }

  const fallback = Object.values(TENANTS).find(tenant => tenant.signupType === 'individual')
  return fallback?.id ?? DEFAULT_TENANT_ID
}
