import {
  DEFAULT_TENANT_ID,
  DOMAIN_TO_TENANT,
  TENANT_ALLOWED_DOMAINS,
  getTenantByDomain,
  getTenantById,
  resolveTenantId,
} from '@/config/tenant'

function withEnv(name: string, value: string | undefined, fn: () => void) {
  const previous = process.env[name]
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }

  try {
    fn()
  } finally {
    if (previous === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = previous
    }
  }
}

describe('tenant registry', () => {
  it('exposes expected defaults and domain map entries', () => {
    expect(DEFAULT_TENANT_ID).toBe('teamshotspro')
    expect(DOMAIN_TO_TENANT['teamshotspro.com']).toBe('teamshotspro')
    expect(DOMAIN_TO_TENANT['portreya.com']).toBe('portreya')
  })

  it('keeps teamshotspro, portreya, and rightclickfit in allowed domains', () => {
    expect(TENANT_ALLOWED_DOMAINS).toContain('teamshotspro.com')
    expect(TENANT_ALLOWED_DOMAINS).toContain('portreya.com')
    expect(TENANT_ALLOWED_DOMAINS).toContain('rightclickfit.com')
  })
})

describe('resolveTenantId', () => {
  it('resolves plain production domains', () => {
    expect(resolveTenantId('teamshotspro.com')).toBe('teamshotspro')
    expect(resolveTenantId('portreya.com')).toBe('portreya')
    expect(resolveTenantId('rightclickfit.com')).toBe('rightclickfit')
  })

  it('normalizes www and :port suffixes', () => {
    expect(resolveTenantId('www.portreya.com:443')).toBe('portreya')
    expect(resolveTenantId('www.teamshotspro.com:8443')).toBe('teamshotspro')
  })

  it('uses the first value from comma-separated host values', () => {
    expect(resolveTenantId('www.portreya.com, internal.proxy')).toBe('portreya')
  })

  it('supports local short aliases without .com suffix', () => {
    expect(resolveTenantId('teamshotspro')).toBe('teamshotspro')
    expect(resolveTenantId('portreya')).toBe('portreya')
  })

  it('uses NEXT_PUBLIC_FORCE_DOMAIN for localhost', () => {
    withEnv('NEXT_PUBLIC_FORCE_DOMAIN', 'portreya.com', () => {
      expect(resolveTenantId('localhost:3000')).toBe('portreya')
    })
  })

  it('returns null for unknown domains', () => {
    expect(resolveTenantId('unknown.example')).toBeNull()
  })
})

describe('tenant lookups', () => {
  it('returns tenant config by id', () => {
    const tenant = getTenantById('portreya')
    expect(tenant.domain).toBe('portreya.com')
    expect(tenant.messageFile).toBe('individualshots')
  })

  it('returns tenant config by domain', () => {
    const tenant = getTenantByDomain('www.teamshotspro.com:443')
    expect(tenant?.id).toBe('teamshotspro')
    expect(tenant?.hasTeamFeatures).toBe(true)
  })
})
