import { headers } from 'next/headers'
import { Env } from '@/lib/env'
import { TEAM_DOMAIN, INDIVIDUAL_DOMAIN } from '@/config/domain'

/**
 * All allowed production domains for this application.
 * Used for validation and dynamic URL construction.
 */
export const ALLOWED_DOMAINS = [
  TEAM_DOMAIN,        // teamshotspro.com
  INDIVIDUAL_DOMAIN,  // photoshotspro.com
] as const

/**
 * Get the base URL dynamically from the request.
 * In production, this detects which domain the request came from.
 * In development, falls back to NEXT_PUBLIC_BASE_URL.
 * 
 * @param requestHeaders - Optional headers object (for server components)
 * @returns The base URL (e.g., "https://teamshotspro.com")
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
    const normalizedHost = host.split(':')[0].replace(/^www\./, '')
    
    // Check if it's one of our allowed domains
    if ((ALLOWED_DOMAINS as readonly string[]).includes(normalizedHost)) {
      const protocol = requestHeaders?.get('x-forwarded-proto') || 'https'
      return `${protocol}://${normalizedHost}`
    }
  }
  
  // Fallback to env var
  return Env.string('NEXT_PUBLIC_BASE_URL', 'https://teamshotspro.com')
}

/**
 * Get base URL for server components using Next.js headers().
 * This is the preferred way to get the base URL in server components and API routes.
 */
export async function getServerBaseUrl(): Promise<string> {
  const headersList = await headers()
  return getBaseUrl(headersList)
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
 * Get the NextAuth URL dynamically.
 * This should be used instead of process.env.NEXTAUTH_URL where dynamic detection is needed.
 */
export async function getAuthUrl(): Promise<string> {
  return getServerBaseUrl()
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
    const normalizedDomain = signupDomain.replace(/^www\./, '')
    if ((ALLOWED_DOMAINS as readonly string[]).includes(normalizedDomain)) {
      return `https://${normalizedDomain}`
    }
  }
  
  // Fallback to default domain
  return Env.string('NEXT_PUBLIC_BASE_URL', 'https://teamshotspro.com')
}

