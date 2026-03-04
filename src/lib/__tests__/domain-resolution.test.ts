import { getBrandByDomain } from '@/config/brand'
import { resolveTenantId } from '@/config/tenant'

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

describe('domain resolution edge cases', () => {
  it('normalizes www prefix and port from host header', () => {
    expect(resolveTenantId('www.teamshotspro.com:443')).toBe('teamshotspro')
  })

  it('uses first value for comma-separated x-forwarded-host', () => {
    expect(resolveTenantId('www.portreya.com, edge.internal')).toBe('portreya')
  })

  it('resolves localhost requests via NEXT_PUBLIC_FORCE_DOMAIN', () => {
    withEnv('NEXT_PUBLIC_FORCE_DOMAIN', 'portreya.com', () => {
      expect(resolveTenantId('localhost:3000')).toBe('portreya')
    })
  })

  it('returns null signup type for unknown domains', () => {
    expect(resolveTenantId('unknown.example')).toBeNull()
  })

  it('falls back to TeamShotsPro brand for unknown domains', () => {
    expect(getBrandByDomain('unknown.example').name).toBe('TeamShotsPro')
  })
})
