'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  getLandingConfig,
  getLandingVariant,
  type LandingConfig,
  type LandingVariant,
} from '@/config/landing-content'
import { PACKAGES_CONFIG, type PackageId, type PackageMetadata } from '@/config/packages'

/**
 * Return type for useLandingContent hook
 */
export interface LandingContentResult {
  /** Current landing variant (e.g., 'teamshotspro', 'photoshotspro') */
  variant: LandingVariant
  /** Full landing configuration */
  config: LandingConfig
  /** Translation namespace for current domain */
  contentNamespace: string
  /** Available packages for current domain */
  availablePackages: PackageMetadata[]
  /** Default package for current domain */
  defaultPackage: PackageMetadata
  /** Check if a package is available on current domain */
  isPackageAvailable: (packageId: PackageId) => boolean
  /** Whether content is loaded (for hydration-safe rendering) */
  isReady: boolean
}

/**
 * Hook for accessing domain-aware landing page content.
 * 
 * Automatically detects the current domain and returns the appropriate
 * landing configuration, available packages, and translation namespace.
 * 
 * Note: Section visibility is now handled directly by each landing page
 * component (TeamShotsLanding, PhotoShotsLanding).
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const { variant, availablePackages } = useLandingContent()
 *   const t = useTranslations(`landing.${variant}.hero`)
 *   
 *   return <h1>{t('title')}</h1>
 * }
 * ```
 */
export function useLandingContent(): LandingContentResult {
  // Start with default config for SSR, then detect domain on client
  const [domain, setDomain] = useState<string | undefined>(undefined)
  const [isReady, setIsReady] = useState(false)

  // Detect domain on client side after hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname.replace(/^www\./, '').toLowerCase()
      setDomain(hostname)
      setIsReady(true)
    }
  }, [])

  // Get configuration based on detected domain
  const config = useMemo(() => getLandingConfig(domain), [domain])
  const variant = useMemo(() => getLandingVariant(domain), [domain])

  // Get available packages with full metadata
  const availablePackages = useMemo(() => {
    return config.packages.available
      .map((id) => PACKAGES_CONFIG.active[id])
      .filter((pkg): pkg is PackageMetadata => pkg !== undefined)
  }, [config.packages.available])

  // Get default package with full metadata
  const defaultPackage = useMemo(() => {
    return PACKAGES_CONFIG.active[config.packages.default]
  }, [config.packages.default])

  // Helper to check package availability
  const isPackageAvailable = (packageId: PackageId): boolean => {
    return config.packages.available.includes(packageId)
  }

  return {
    variant,
    config,
    contentNamespace: config.contentNamespace,
    availablePackages,
    defaultPackage,
    isPackageAvailable,
    isReady,
  }
}

/**
 * Hook for getting domain-specific translations.
 * Combines useLandingContent with useTranslations for convenient access.
 * 
 * @param section - The section within the landing namespace (e.g., 'hero', 'trust')
 * @returns Translation function scoped to the domain's landing content
 * 
 * @example
 * ```tsx
 * function HeroSection() {
 *   const t = useLandingTranslations('hero')
 *   return <h1>{t('title')}</h1>
 * }
 * ```
 */
export function useLandingTranslations(section: string) {
  const { variant } = useLandingContent()
  return useTranslations(`landing.${variant}.${section}`)
}

/**
 * Server-side helper to get landing config from headers.
 * Use this in server components or API routes.
 * 
 * @param headers - Request headers containing host information
 * @returns Landing configuration for the request's domain
 */
export function getLandingConfigFromHeaders(headers: Headers): LandingConfig {
  const host = headers.get('host') || headers.get('x-forwarded-host')
  if (host) {
    const domain = host.split(':')[0].replace(/^www\./, '').toLowerCase()
    return getLandingConfig(domain)
  }
  return getLandingConfig()
}

