import { Env } from '@/lib/env'
import { TEAM_DOMAIN, INDIVIDUAL_DOMAIN, INDIVIDUAL_DOMAIN_2, COUPLES_DOMAIN, FAMILY_DOMAIN, EXTENSION_DOMAIN } from '@/config/domain'

/**
 * All allowed production domains for this application.
 * Used for validation and dynamic URL construction.
 */
export const ALLOWED_DOMAINS = [
  TEAM_DOMAIN,        // teamshotspro.com
  INDIVIDUAL_DOMAIN,  // individualshots.com
  INDIVIDUAL_DOMAIN_2, // portreya.com
  COUPLES_DOMAIN,     // coupleshots.com
  FAMILY_DOMAIN,      // familyshots.com
  EXTENSION_DOMAIN,   // rightclickfit.com
] as const

function toCanonicalHost(normalizedHost: string): string {
  // TeamShotsPro uses www as canonical host in production (robots/sitemap and edge redirects).
  if (normalizedHost === TEAM_DOMAIN) {
    return `www.${TEAM_DOMAIN}`
  }
  return normalizedHost
}

/**
 * Get the base URL dynamically from the request.
 * In production, this detects which domain the request came from.
 * In development, falls back to NEXT_PUBLIC_BASE_URL.
 *
 * @param requestHeaders - Optional headers object (for server components)
 * @returns The base URL (e.g., "https://www.teamshotspro.com")
 */
export function getBaseUrl(requestHeaders?: Headers): string {
  // In development, always use the env var
  if (Env.string('NODE_ENV') !== 'production') {
    return Env.string('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
  }

  // Try to detect from request headers
  const host = requestHeaders?.get('host') || requestHeaders?.get('x-forwarded-host')

  if (host) {
    // Normalize: remove port and www prefix
    const normalizedHost = host.split(':')[0].toLowerCase().replace(/^www\./, '')

    // Check if it's one of our allowed domains
    if ((ALLOWED_DOMAINS as readonly string[]).includes(normalizedHost)) {
      const protocol = requestHeaders?.get('x-forwarded-proto') || 'https'
      return `${protocol}://${toCanonicalHost(normalizedHost)}`
    }
  }

  // Fallback to env var
  return Env.string('NEXT_PUBLIC_BASE_URL', 'https://teamshotspro.com')
}

/**
 * Get base URL for client components.
 * Uses window.location.origin when available, falls back to env var.
 */
export function getClientBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return Env.string('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
}

/**
 * Get a clean base URL for client components without default ports.
 *
 * This fixes an issue where reverse proxies forward x-forwarded-port: 80,
 * causing window.location.origin to return URLs like https://domain.com:80/
 * which breaks HTTPS connections.
 *
 * @returns Base URL without default ports (80 for http, 443 for https), but keeps non-default ports like 3000
 */
export function getCleanClientBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location
    // Only strip default ports (80 for http, 443 for https)
    // Keep non-default ports like 3000 for development
    const isDefaultPort = 
      (protocol === 'http:' && port === '80') ||
      (protocol === 'https:' && port === '443') ||
      port === '' // Empty port means default was used
    
    if (isDefaultPort) {
      return `${protocol}//${hostname}`
    }
    return `${protocol}//${hostname}:${port}`
  }
  return Env.string('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
}

export function normalizeBaseUrlForSeo(url: string): string {
  const cleanUrl = url.replace(/\/$/, '')

  try {
    const parsed = new URL(cleanUrl)
    const normalizedHost = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if ((ALLOWED_DOMAINS as readonly string[]).includes(normalizedHost)) {
      parsed.protocol = 'https:'
      parsed.hostname = toCanonicalHost(normalizedHost)
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return cleanUrl
  }
}

/**
 * Get the base URL for a specific user based on their signup domain.
 * Used for emails and notifications to ensure links point to the domain they signed up on.
 *
 * @param signupDomain - The domain the user signed up from (stored in User.signupDomain)
 * @returns The base URL for that domain (e.g., "https://teamshotspro.com")
 */
export function getBaseUrlForUser(signupDomain: string | null | undefined): string {
  // In development, always use the env var
  if (Env.string('NODE_ENV') !== 'production') {
    return Env.string('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
  }

  // If user has a stored signup domain, use it
  if (signupDomain) {
    const normalizedDomain = signupDomain.toLowerCase().replace(/^www\./, '')
    if ((ALLOWED_DOMAINS as readonly string[]).includes(normalizedDomain)) {
      return `https://${toCanonicalHost(normalizedDomain)}`
    }
  }

  // Fallback to default domain
  return Env.string('NEXT_PUBLIC_BASE_URL', 'https://teamshotspro.com')
}
