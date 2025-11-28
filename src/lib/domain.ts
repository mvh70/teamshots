import { NextRequest } from 'next/server'

/**
 * Get the domain from a Next.js request
 */
export function getRequestDomain(request: NextRequest): string | null {
  try {
    // Try to get hostname from the request URL
    const hostname = request.nextUrl.hostname
    if (hostname) {
      return hostname.toLowerCase()
    }

    // Fallback to host header
    const host = request.headers.get('host')
    if (host) {
      // Remove port if present
      const hostname = host.split(':')[0]
      return hostname.toLowerCase()
    }

    return null
  } catch (error) {
    console.error('Error extracting domain from request:', error)
    return null
  }
}

/**
 * Get the signup type restriction based on domain
 * Returns the subscription type that users can sign up for on this domain,
 * or null if no restriction (allows selection UI)
 */
export function getSignupTypeFromDomain(domain: string | null): 'individual' | 'team' | null {
  if (!domain) return null

  // Normalize domain (handle www. and app. prefixes)
  const normalizedDomain = domain.replace(/^(www\.|app\.)/, '')

  // Check known domains
  switch (normalizedDomain) {
    case 'teamshotspro.com':
      return 'team'
    case 'photoshotspro.com':
      return 'individual'
  }

  // Fallback to forced domain override from environment
  const forcedType = process.env.FORCE_DOMAIN_SIGNUP_TYPE
  if (forcedType === 'team' || forcedType === 'individual') {
    return forcedType
  }

  return null // Allow selection UI if no override set
}

/**
 * Get the current domain on the client side
 * Returns null on server side or if unable to determine
 */
export function getClientDomain(): string | null {
  // Only available on client side
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.location.hostname.toLowerCase()
  } catch (error) {
    console.error('Error getting client domain:', error)
    return null
  }
}

/**
 * Get the forced signup type from environment variables (client-side, localhost only)
 * Returns the forced type if set and on localhost, otherwise null
 */
export function getForcedSignupType(): 'individual' | 'team' | null {
  // Only work on localhost for testing
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    const forcedType = process.env.NEXT_PUBLIC_FORCE_DOMAIN_SIGNUP_TYPE
    if (forcedType === 'team' || forcedType === 'individual') {
      return forcedType
    }
  }
  return null
}
