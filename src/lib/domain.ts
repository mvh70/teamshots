import { NextRequest } from 'next/server'
import { TEAM_DOMAIN, INDIVIDUAL_DOMAIN, INDIVIDUAL_DOMAIN_2, PORTREYA_DOMAIN, COUPLES_DOMAIN, FAMILY_DOMAIN, EXTENSION_DOMAIN } from '@/config/domain'

/**
 * All individual domains - used for signup type detection
 */
const INDIVIDUAL_DOMAINS = [
  INDIVIDUAL_DOMAIN,      // individualshots.com
  INDIVIDUAL_DOMAIN_2,    // portreya.com
  PORTREYA_DOMAIN,        // portreya.com
  COUPLES_DOMAIN,         // coupleshots.com
  FAMILY_DOMAIN,          // familyshots.com
  EXTENSION_DOMAIN,       // rightclickfit.com
]

/**
 * Get signup type from a domain string
 * Used internally to derive signup type from forced domain
 *
 * Handles both bare domain names (teamshotspro) and full domains (teamshotspro.com)
 */
function getSignupTypeForDomain(domain: string): 'individual' | 'team' | null {
  // Normalize: remove www./app. prefix and lowercase
  const normalized = domain.replace(/^(www\.|app\.)/, '').toLowerCase()

  // Check if domain starts with the known domain name followed by a dot or end of string
  // This handles both 'teamshotspro' and 'teamshotspro.com'
  if (normalized === TEAM_DOMAIN || normalized.startsWith(TEAM_DOMAIN + '.')) {
    return 'team'
  }

  // Check all individual domains
  for (const individualDomain of INDIVIDUAL_DOMAINS) {
    if (normalized === individualDomain || normalized.startsWith(individualDomain + '.')) {
      return 'individual'
    }
  }

  return null
}

/**
 * Get the domain from a Next.js request
 * 
 * Priority order:
 * 1. x-forwarded-host (original client request when behind proxy)
 * 2. host header (direct request or proxy hostname)
 * 3. request.nextUrl.hostname (fallback)
 * 
 * Handles:
 * - Multiple proxy values in x-forwarded-host (takes first/leftmost)
 * - Port removal
 * - www. prefix normalization
 * - localhost with NEXT_PUBLIC_FORCE_DOMAIN override
 */
export function getRequestDomain(request: NextRequest): string | null {
  try {
    // Prioritize x-forwarded-host (original client request) over host (proxy hostname)
    // x-forwarded-host can contain comma-separated values when there are multiple proxies
    // Take the first (leftmost) value as it's the original client request
    let host = request.headers.get('x-forwarded-host')
    if (host) {
      // Handle comma-separated values (take first one)
      host = host.split(',')[0].trim()
    } else {
      // Fallback to host header
      host = request.headers.get('host')
    }
    
    if (host) {
      // Remove port if present and normalize
      const hostname = host.split(':')[0].toLowerCase().trim()
      
      // On localhost, use forced domain if set (for development/testing)
      if (hostname === 'localhost') {
        const forcedDomain = process.env.NEXT_PUBLIC_FORCE_DOMAIN
        if (forcedDomain) {
          return forcedDomain.replace(/^www\./, '').toLowerCase()
        }
      }
      
      // Normalize: remove www. prefix for consistency
      return hostname.replace(/^www\./, '')
    }

    // Fallback to hostname from the request URL
    const hostname = request.nextUrl.hostname
    if (hostname && hostname !== 'localhost') {
      return hostname.toLowerCase().replace(/^www\./, '')
    }

    // If still localhost, check for forced domain
    if (hostname === 'localhost') {
      const forcedDomain = process.env.NEXT_PUBLIC_FORCE_DOMAIN
      if (forcedDomain) {
        return forcedDomain.replace(/^www\./, '').toLowerCase()
      }
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
  const signupType = getSignupTypeForDomain(normalizedDomain)
  if (signupType) return signupType

  // On localhost, derive from NEXT_PUBLIC_FORCE_DOMAIN
  if (normalizedDomain === 'localhost') {
    const forcedDomain = process.env.NEXT_PUBLIC_FORCE_DOMAIN
    if (forcedDomain) {
      return getSignupTypeForDomain(forcedDomain)
    }
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
 * Derives signup type from NEXT_PUBLIC_FORCE_DOMAIN
 */
export function getForcedSignupType(): 'individual' | 'team' | null {
  // Only work on localhost for testing
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    const forcedDomain = process.env.NEXT_PUBLIC_FORCE_DOMAIN
    if (forcedDomain) {
      return getSignupTypeForDomain(forcedDomain)
    }
  }
  return null
}
