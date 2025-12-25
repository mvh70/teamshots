import { headshot1Server } from './headshot1/server'
import { outfit1Server } from './outfit1/server'
import { freepackageServer } from './freepackage/server'
import { Logger } from '@/lib/logger'

// Import new registry and types
import { packageRegistry } from './registry'
import type { ServerStylePackage } from './types'

// Re-export for backward compatibility
export type { ServerStylePackage } from './types'

/**
 * Register core packages with the package registry
 *
 * This function registers built-in packages. It's called at module load time
 * to ensure packages are available when the system starts.
 */
async function registerCorePackages(): Promise<void> {
  Logger.debug('[ServerPackages] Registering core packages')

  // Register headshot1 (always available)
  try {
    await packageRegistry.register(headshot1Server, { skipValidation: false })
  } catch (error) {
    Logger.error('[ServerPackages] Failed to register headshot1', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Register freepackage (always available)
  try {
    await packageRegistry.register(freepackageServer, { skipValidation: false })
  } catch (error) {
    Logger.error('[ServerPackages] Failed to register freepackage', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Register outfit1 (always available)
  try {
    await packageRegistry.register(outfit1Server, { skipValidation: false })
  } catch (error) {
    Logger.error('[ServerPackages] Failed to register outfit1', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  Logger.info('[ServerPackages] Core packages registered', {
    count: packageRegistry.count,
    packages: packageRegistry.getIds(),
  })
}

// LEGACY: Maintain backward compatibility with existing code
export const SERVER_PACKAGES: Record<string, ServerStylePackage> = {
  [headshot1Server.id]: headshot1Server,
  [freepackageServer.id]: freepackageServer,
  [outfit1Server.id]: outfit1Server,
}

/**
 * Get server package configuration
 *
 * MIGRATION NOTE: This function now uses the package registry as primary source,
 * with fallback to legacy SERVER_PACKAGES for backward compatibility.
 *
 * @param id - Package ID
 * @returns Server package or default (headshot1)
 */
export const getServerPackageConfig = (id?: string): ServerStylePackage => {
  if (!id) {
    // Try registry first, fallback to legacy
    return packageRegistry.get('headshot1') || headshot1Server
  }

  // Try registry first, fallback to legacy SERVER_PACKAGES
  const fromRegistry = packageRegistry.get(id)
  if (fromRegistry) {
    return fromRegistry
  }

  // Fallback to legacy
  return SERVER_PACKAGES[id] || headshot1Server
}

/**
 * Get all available server packages
 *
 * @returns Array of all registered packages
 */
export const getAllServerPackages = (): ServerStylePackage[] => {
  // Use registry if available, fallback to legacy
  if (packageRegistry.count > 0) {
    return packageRegistry.getAll()
  }

  return Object.values(SERVER_PACKAGES)
}

/**
 * Check if a package is available
 *
 * @param packageId - Package ID
 * @returns True if package is registered
 */
export const isPackageAvailable = (packageId: string): boolean => {
  return packageRegistry.has(packageId) || packageId in SERVER_PACKAGES
}

// Auto-register core packages on module load
// This is non-blocking to avoid delaying module initialization
registerCorePackages().catch((error) => {
  Logger.error('[ServerPackages] Core package registration failed', {
    error: error instanceof Error ? error.message : String(error),
  })
})

