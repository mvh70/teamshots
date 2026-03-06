import { shouldBypassLocaleDetection } from '@/lib/locale-routing'

describe('shouldBypassLocaleDetection', () => {
  it('returns true for unprefixed blog post paths', () => {
    expect(shouldBypassLocaleDetection('/blog/remote-team-headshots')).toBe(true)
    expect(shouldBypassLocaleDetection('/blog/remote-team-headshots/')).toBe(true)
  })

  it('returns false for the blog index and non-blog routes', () => {
    expect(shouldBypassLocaleDetection('/blog')).toBe(false)
    expect(shouldBypassLocaleDetection('/es/blog/remote-team-headshots')).toBe(false)
    expect(shouldBypassLocaleDetection('/pricing')).toBe(false)
  })
})
