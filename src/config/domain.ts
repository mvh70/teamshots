/**
 * Domain configuration for subscription type restrictions
 *
 * These domains restrict which subscription type users can sign up for:
 * - TEAM_DOMAIN: Only allows team/pro subscription signup
 * - PORTREYA_DOMAIN: Allows individual subscription signup
 * - COUPLES_DOMAIN: Targeted at couples
 * - FAMILY_DOMAIN: Targeted at families
 */

// Domains that restrict signup to team subscription
export const TEAM_DOMAIN = 'teamshotspro.com'

// Domains that restrict signup to individual subscription
export const PORTREYA_DOMAIN = 'portreya.com'

// New vertical domains
export const COUPLES_DOMAIN = 'coupleshots.com'
export const FAMILY_DOMAIN = 'familyshots.com'
export const EXTENSION_DOMAIN = 'rightclickfit.com'

// Client-side tenant/brand resolution moved to `src/lib/tenant-client.ts`.
