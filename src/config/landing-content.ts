/**
 * Landing Page Content Configuration
 * 
 * Defines domain-specific landing page configuration and available
 * photo style packages for each domain.
 * 
 * Note: Each landing page component (TeamShotsLanding, PhotoShotsLanding)
 * controls its own section visibility and layout directly.
 */

import { TEAM_DOMAIN, INDIVIDUAL_DOMAIN } from './domain'
import type { PackageId } from './packages'

/**
 * Landing page variant identifiers - matches domain names without .com
 */
export type LandingVariant = 'teamshotspro' | 'photoshotspro' | 'coupleshotspro'

/**
 * Section visibility configuration for landing pages.
 * Used by shared components (e.g., TrustIndicators) to conditionally render sections.
 * Each landing page defines its own visibility settings.
 */
export interface LandingSections {
  /** Show team management features (Team Command Center) */
  showTeamCommandCenter: boolean
  /** Show industry-specific templates */
  showIndustryTemplates: boolean
  /** Show team-oriented how it works flow */
  showTeamFlow: boolean
  /** Show individual-oriented how it works flow */
  showIndividualFlow: boolean
}

/**
 * Package configuration for a domain
 */
export interface LandingPackages {
  /** Which packages users can choose on this domain */
  available: PackageId[]
  /** Default package pre-selected for this domain */
  default: PackageId
}

/**
 * Landing page configuration for a domain.
 * Section visibility is handled by each landing page component directly.
 */
export interface LandingConfig {
  /** Variant identifier (matches domain name without .com) */
  variant: LandingVariant
  /** Translation namespace for this domain's content */
  contentNamespace: string
  /** Available packages and default selection */
  packages: LandingPackages
}

/**
 * Domain-specific landing configurations
 */
const LANDING_CONFIGS: Record<string, LandingConfig> = {
  [TEAM_DOMAIN]: {
    variant: 'teamshotspro',
    contentNamespace: 'landing.teamshotspro',
    packages: {
      available: ['headshot1', 'freepackage', 'tryitforfree'],
      default: 'headshot1',
    },
  },
  [INDIVIDUAL_DOMAIN]: {
    variant: 'photoshotspro',
    contentNamespace: 'landing.photoshotspro',
    packages: {
      available: ['linkedin', 'dating', 'casual', 'freepackage'],
      default: 'linkedin',
    },
  },
  // Future: coupleshotspro.com
  // 'coupleshotspro.com': {
  //   variant: 'coupleshotspro',
  //   contentNamespace: 'landing.coupleshotspro',
  //   packages: {
  //     available: ['couple', 'casual', 'freepackage'],
  //     default: 'couple',
  //   },
  // },
}

/**
 * Default configuration (teamshotspro) for fallback
 */
const DEFAULT_LANDING_CONFIG = LANDING_CONFIGS[TEAM_DOMAIN]

/**
 * Get the current domain from browser or normalize a provided domain.
 * On localhost, respects NEXT_PUBLIC_FORCE_DOMAIN env var for testing different domains.
 */
function normalizeDomain(domain?: string): string | null {
  // Check for forced domain override (localhost development only)
  const forcedDomain = process.env.NEXT_PUBLIC_FORCE_DOMAIN
  
  if (domain) {
    const normalized = domain.replace(/^www\./, '').toLowerCase()
    // On localhost, use forced domain if set
    if (normalized === 'localhost' && forcedDomain) {
      return forcedDomain.replace(/^www\./, '').toLowerCase()
    }
    return normalized
  }
  
  // Client-side detection
  if (typeof window !== 'undefined') {
    try {
      const hostname = window.location.hostname.replace(/^www\./, '').toLowerCase()
      // On localhost, use forced domain if set
      if (hostname === 'localhost' && forcedDomain) {
        return forcedDomain.replace(/^www\./, '').toLowerCase()
      }
      return hostname
    } catch {
      return null
    }
  }
  
  return null
}

/**
 * Get landing page configuration for a domain.
 * 
 * @param domain - Optional domain to get config for. If not provided,
 *                 attempts to detect from window.location (client-side only)
 * @returns Landing configuration for the domain, or default (teamshotspro) if not found
 */
export function getLandingConfig(domain?: string): LandingConfig {
  const normalizedDomain = normalizeDomain(domain)
  
  if (normalizedDomain && LANDING_CONFIGS[normalizedDomain]) {
    return LANDING_CONFIGS[normalizedDomain]
  }
  
  return DEFAULT_LANDING_CONFIG
}

/**
 * Get landing variant name for a domain
 */
export function getLandingVariant(domain?: string): LandingVariant {
  return getLandingConfig(domain).variant
}

/**
 * Get available packages for a domain
 */
export function getAvailablePackages(domain?: string): PackageId[] {
  return getLandingConfig(domain).packages.available
}

/**
 * Get default package for a domain
 */
export function getDefaultPackage(domain?: string): PackageId {
  return getLandingConfig(domain).packages.default
}

