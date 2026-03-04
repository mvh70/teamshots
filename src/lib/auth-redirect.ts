import { ALLOWED_DOMAINS } from '@/lib/url'

const isCrossDomainRedirectEnabled = () =>
  process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_CROSS_DOMAIN_REDIRECT === 'true'

/**
 * Builds a safe cross-domain redirect URL for auth flows.
 * Returns null when redirect should not happen.
 */
export function buildCrossDomainRedirectUrl(
  signupDomain: string | null | undefined,
  path: string
): string | null {
  if (typeof window === 'undefined') return null
  if (!signupDomain) return null

  const normalizedSignupDomain = signupDomain.replace(/^www\./, '').toLowerCase()

  // Legacy development users can access from any domain.
  if (normalizedSignupDomain === 'localhost') {
    return null
  }

  const currentDomain = window.location.hostname.replace(/^www\./, '').toLowerCase()
  if (currentDomain === normalizedSignupDomain) {
    return null
  }

  if (!(ALLOWED_DOMAINS as readonly string[]).includes(normalizedSignupDomain)) {
    return null
  }

  if (!isCrossDomainRedirectEnabled()) {
    return null
  }

  const safePath = path.startsWith('/') ? path : `/${path}`
  return `${window.location.protocol}//${normalizedSignupDomain}${safePath}`
}
