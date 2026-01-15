import { headshot1 } from './headshot1'
import { outfit1 } from './outfit1'
import { freepackage } from './freepackage'
import { industryHeadshot } from './industry-headshot'
import { validateAllPackages } from './validation'

// Load element metadata registry
import '@/domain/style/elements'

// Re-export types from centralized types file
export type { StandardPresetConfig, StandardPresetDefaults } from './defaults'
export type {
  ClientStylePackage,
  ServerStylePackage,
  PackageMetadata,
  PackageCapabilities,
  PackageValidationResult,
  PackagePreparedAssets,
} from './types'
export { isServerPackage, canPrepareAssets } from './types'

// Re-export registry
export { packageRegistry, registerPackages } from './registry'
export type { PackageRegistrationOptions } from './registry'

// For backward compatibility, still export from old location
import type { ClientStylePackage } from './types'

// CLIENT_PACKAGES - All client-side packages
export const CLIENT_PACKAGES: Record<string, ClientStylePackage> = {
  [headshot1.id]: headshot1,
  [freepackage.id]: freepackage,
  [outfit1.id]: outfit1,
  [industryHeadshot.id]: industryHeadshot,
}

// Validate all packages at module load time (only in Node.js environment)
if (typeof window === 'undefined') {
  try {
    validateAllPackages(CLIENT_PACKAGES)
  } catch (error) {
    // Log error but don't crash the app - validation errors are logged
    console.error('Package validation failed:', error)
  }
}

export const getPackageConfig = (id?: string): ClientStylePackage => {
  if (!id) return headshot1
  return CLIENT_PACKAGES[id] || headshot1
}

/**
 * Check if a package is available (exists and enabled via feature flags)
 */
export function isPackageAvailable(packageId: string): boolean {
  return packageId in CLIENT_PACKAGES
}
