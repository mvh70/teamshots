/**
 * Domain configuration for subscription type restrictions
 *
 * These domains restrict which subscription type users can sign up for:
 * - TEAM_DOMAIN: Only allows team/pro subscription signup
 * - INDIVIDUAL_DOMAIN: Only allows individual subscription signup
 * - COUPLES_DOMAIN: Targeted at couples
 * - FAMILY_DOMAIN: Targeted at families
 */

// Domains that restrict signup to team subscription
export const TEAM_DOMAIN = 'teamshotspro.com'

// Domains that restrict signup to individual subscription
export const INDIVIDUAL_DOMAIN = 'individualshots.com'
export const INDIVIDUAL_DOMAIN_2 = 'portreya.com'
export const PORTREYA_DOMAIN = 'portreya.com'

// New vertical domains
export const COUPLES_DOMAIN = 'coupleshots.com'
export const FAMILY_DOMAIN = 'familyshots.com'
export const EXTENSION_DOMAIN = 'rightclickfit.com'

// All domains that have signup restrictions or specific landing pages
export const RESTRICTED_DOMAINS = [
  TEAM_DOMAIN,
  INDIVIDUAL_DOMAIN,
  INDIVIDUAL_DOMAIN_2,
  PORTREYA_DOMAIN,
  COUPLES_DOMAIN,
  FAMILY_DOMAIN,
  EXTENSION_DOMAIN,
] as const

// Helper to check if a domain has signup restrictions
export function isRestrictedDomain(domain: string): boolean {
  const normalizedDomain = domain.replace(/^www\./, '')
  return (RESTRICTED_DOMAINS as readonly string[]).includes(normalizedDomain)
}

// Helper to get all variants of a domain (with/without www)
export function getDomainVariants(domain: string): string[] {
  return [domain, `www.${domain}`]
}

/**
 * Client-side brand info for use in React components.
 * This is the single source of truth for client-side brand detection.
 *
 * For server-side brand detection, use getBrand() from @/config/brand instead.
 */
export interface ClientBrandInfo {
  brandName: string
  isIndividual: boolean
}

/**
 * Get brand info on the client side based on current hostname.
 * Handles localhost with NEXT_PUBLIC_FORCE_DOMAIN for development.
 */
export function getClientBrandInfo(): ClientBrandInfo {
  if (typeof window === 'undefined') {
    return { brandName: 'TeamShotsPro', isIndividual: false }
  }

  let hostname = window.location.hostname.replace(/^www\./, '').toLowerCase()

  // On localhost, check for forced domain override
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const forcedDomain = process.env.NEXT_PUBLIC_FORCE_DOMAIN
    if (forcedDomain) {
      hostname = forcedDomain.replace(/^www\./, '').toLowerCase()
    }
  }

  // Helper to match domain with or without .com (for local dev)
  const matchesDomain = (domain: string) =>
    hostname === domain || hostname === domain.replace(/\.com$/, '')

  // Individual domains
  if (matchesDomain(INDIVIDUAL_DOMAIN)) {
    return { brandName: 'IndividualShots', isIndividual: true }
  }
  if (matchesDomain(INDIVIDUAL_DOMAIN_2)) {
    return { brandName: 'Portreya', isIndividual: true }
  }
  if (matchesDomain(PORTREYA_DOMAIN)) {
    return { brandName: 'Portreya', isIndividual: true }
  }
  if (matchesDomain(COUPLES_DOMAIN)) {
    return { brandName: 'CoupleShots', isIndividual: true }
  }
  if (matchesDomain(FAMILY_DOMAIN)) {
    return { brandName: 'FamilyShots', isIndividual: true }
  }
  if (matchesDomain(EXTENSION_DOMAIN)) {
    return { brandName: 'RightClickFit', isIndividual: true }
  }

  // Team domain
  if (matchesDomain(TEAM_DOMAIN)) {
    return { brandName: 'TeamShotsPro', isIndividual: false }
  }

  // Default to team domain
  return { brandName: 'TeamShotsPro', isIndividual: false }
}
