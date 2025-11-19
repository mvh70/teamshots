/**
 * Domain configuration for subscription type restrictions
 *
 * These domains restrict which subscription type users can sign up for:
 * - TEAM_DOMAIN: Only allows team/pro subscription signup
 * - INDIVIDUAL_DOMAIN: Only allows individual subscription signup
 */

// Domains that restrict signup to team subscription
export const TEAM_DOMAIN = 'teamshotspro.com'

// Domains that restrict signup to individual subscription
export const INDIVIDUAL_DOMAIN = 'photoshotspro.com'

// All domains that have signup restrictions
export const RESTRICTED_DOMAINS = [
  TEAM_DOMAIN,
  INDIVIDUAL_DOMAIN,
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
