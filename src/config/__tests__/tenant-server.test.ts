import { getTenantFromHeaders, getTenantFromRequest } from '@/config/tenant-server'

function makeHeaders(values: Record<string, string>): Headers {
  return new Headers(values)
}

function makeRequestStub(values: Record<string, string>, hostname = 'localhost') {
  return {
    headers: makeHeaders(values),
    nextUrl: { hostname },
  } as Parameters<typeof getTenantFromRequest>[0]
}

describe('getTenantFromHeaders', () => {
  it('prefers host-derived tenant when host and x-tenant-id disagree', () => {
    const tenant = getTenantFromHeaders(
      makeHeaders({
        host: 'portreya.com',
        'x-tenant-id': 'teamshotspro',
      })
    )

    expect(tenant.id).toBe('portreya')
  })

  it('accepts x-tenant-id when host is unavailable/unresolvable', () => {
    const tenant = getTenantFromHeaders(
      makeHeaders({
        host: 'unknown.example',
        'x-tenant-id': 'rightclickfit',
      })
    )

    expect(tenant.id).toBe('rightclickfit')
  })

  it('ignores unrecognized x-tenant-id values', () => {
    const tenant = getTenantFromHeaders(
      makeHeaders({
        host: 'unknown.example',
        'x-tenant-id': 'evil-tenant',
      })
    )

    expect(tenant.id).toBe('teamshotspro')
  })

  it('handles comma-separated forwarded hosts by taking the first value', () => {
    const tenant = getTenantFromHeaders(
      makeHeaders({
        'x-forwarded-host': 'www.portreya.com, edge.internal',
      })
    )

    expect(tenant.id).toBe('portreya')
  })
})

describe('getTenantFromRequest', () => {
  it('falls back to request.nextUrl.hostname when host headers are missing', () => {
    const tenant = getTenantFromRequest(makeRequestStub({}, 'rightclickfit.com'))
    expect(tenant.id).toBe('rightclickfit')
  })
})
