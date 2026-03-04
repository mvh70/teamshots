import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import {
  DEFAULT_TENANT_ID,
  TENANTS,
  getTenantById,
  resolveTenantId,
  type TenantConfig,
  type TenantId,
  type TenantSignupType,
} from './tenant'

function parseTrustedTenantId(rawTenantId: string | null): TenantId | null {
  if (!rawTenantId) return null
  const normalized = rawTenantId.trim().toLowerCase()
  if (!normalized) return null

  if (normalized in TENANTS) {
    return normalized as TenantId
  }

  return null
}

function resolveTenantFromHostAndHeader(
  hostLikeValue: string | null | undefined,
  tenantHeaderValue: string | null
): TenantConfig {
  const hostTenantId = resolveTenantId(hostLikeValue)
  const headerTenantId = parseTrustedTenantId(tenantHeaderValue)

  // Host remains authoritative when both host and header are available and differ.
  if (hostTenantId) {
    return getTenantById(hostTenantId)
  }

  if (headerTenantId) {
    return getTenantById(headerTenantId)
  }

  return getTenantById(DEFAULT_TENANT_ID)
}

export async function getTenant(): Promise<TenantConfig> {
  const headerStore = await headers()
  return getTenantFromHeaders(headerStore)
}

export function getTenantFromHeaders(requestHeaders: Headers): TenantConfig {
  const hostLikeValue = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
  const tenantHeaderValue = requestHeaders.get('x-tenant-id')

  return resolveTenantFromHostAndHeader(hostLikeValue, tenantHeaderValue)
}

export function getTenantFromRequest(request: NextRequest): TenantConfig {
  const hostLikeValue =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    request.nextUrl.hostname
  const tenantHeaderValue = request.headers.get('x-tenant-id')

  return resolveTenantFromHostAndHeader(hostLikeValue, tenantHeaderValue)
}

export function getSignupTypeFromTenant(tenant: TenantConfig): TenantSignupType {
  return tenant.signupType
}
