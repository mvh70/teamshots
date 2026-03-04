import {
  DEFAULT_TENANT_ID,
  TENANTS,
  getTenantById,
  resolveTenantId,
  type TenantId,
} from '@/config/tenant'

export interface ClientTenantInfo {
  tenantId: TenantId
  brandName: string
  hasTeamFeatures: boolean
  isIndividualDomain: boolean
}

function parseTenantId(rawTenantId: string | null | undefined): TenantId | null {
  if (!rawTenantId) return null

  const normalized = rawTenantId.trim().toLowerCase()
  if (!normalized) return null

  if (normalized in TENANTS) {
    return normalized as TenantId
  }

  return null
}

function getMetaTenantId(): TenantId | null {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="x-tenant-id"]')
  return parseTenantId(meta?.content)
}

function getAuthLayoutTenantId(): TenantId | null {
  const authTenantEl = document.querySelector<HTMLElement>('[data-tenant-id]')
  return parseTenantId(authTenantEl?.dataset.tenantId)
}

function getHostnameTenantId(): TenantId | null {
  return resolveTenantId(window.location.hostname)
}

function getResolvedTenantId(): TenantId {
  return (
    getMetaTenantId() ||
    getAuthLayoutTenantId() ||
    getHostnameTenantId() ||
    DEFAULT_TENANT_ID
  )
}

export function getClientTenantInfo(): ClientTenantInfo {
  if (typeof window === 'undefined') {
    const tenant = getTenantById(DEFAULT_TENANT_ID)
    return {
      tenantId: tenant.id,
      brandName: tenant.brandName,
      hasTeamFeatures: tenant.hasTeamFeatures,
      isIndividualDomain: !tenant.hasTeamFeatures,
    }
  }

  const tenant = getTenantById(getResolvedTenantId())
  const authTenantEl = document.querySelector<HTMLElement>('[data-tenant-id]')
  const explicitBrandName = authTenantEl?.dataset.brandName
  const explicitHasTeamFeatures = authTenantEl?.dataset.hasTeamFeatures

  const hasTeamFeatures =
    explicitHasTeamFeatures != null
      ? explicitHasTeamFeatures === 'true'
      : tenant.hasTeamFeatures

  return {
    tenantId: tenant.id,
    brandName: explicitBrandName || tenant.brandName,
    hasTeamFeatures,
    isIndividualDomain: !hasTeamFeatures,
  }
}
