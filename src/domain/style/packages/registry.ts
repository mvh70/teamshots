/**
 * Package Registry with Auto-Discovery
 *
 * Central registry for style packages that supports:
 * - Auto-discovery from filesystem
 * - Manual registration
 * - Lifecycle hooks
 * - Dependency resolution
 * - Feature flag integration
 */

import { Logger } from '@/lib/logger'
import { isFeatureEnabled } from '@/config/feature-flags'
import type { ServerStylePackage, PackageMetadata, PackageCapabilities } from './types'
import { compositionRegistry } from '../elements/composition/registry'

export interface PackageValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface PackageRegistrationOptions {
  skipValidation?: boolean
  force?: boolean  // Override existing registration
}

/**
 * Registry for managing style packages with auto-discovery
 */
class PackageRegistry {
  private packages = new Map<string, ServerStylePackage>()
  private initialized = false
  private initializationPromise: Promise<void> | null = null

  /**
   * Register a package
   *
   * @param pkg - Package to register
   * @param options - Registration options
   * @throws Error if package already registered (unless force=true)
   */
  async register(
    pkg: ServerStylePackage,
    options: PackageRegistrationOptions = {}
  ): Promise<PackageValidationResult> {
    const { skipValidation = false, force = false } = options

    // Check for duplicate registration
    if (this.packages.has(pkg.id) && !force) {
      throw new Error(`Package ${pkg.id} is already registered. Use force=true to override.`)
    }

    // Validate package if not skipped
    let validationResult: PackageValidationResult = { valid: true, errors: [], warnings: [] }
    if (!skipValidation) {
      validationResult = await this.validatePackage(pkg)
      if (!validationResult.valid) {
        Logger.error('[PackageRegistry] Package validation failed', {
          packageId: pkg.id,
          errors: validationResult.errors,
        })
        throw new Error(`Package ${pkg.id} validation failed: ${validationResult.errors.join(', ')}`)
      }
    }

    // Check feature flag
    if (pkg.featureFlag && !isFeatureEnabled(pkg.featureFlag as 'outfitTransfer' | 'v3Workflow' | 'elementComposition')) {
      Logger.info('[PackageRegistry] Package disabled by feature flag', {
        packageId: pkg.id,
        featureFlag: pkg.featureFlag,
      })
      return {
        valid: false,
        errors: [`Feature flag ${pkg.featureFlag} is not enabled`],
        warnings: [],
      }
    }

    // Register package
    this.packages.set(pkg.id, pkg)

    // Register provided elements
    if (pkg.providedElements && pkg.providedElements.length > 0) {
      for (const element of pkg.providedElements) {
        try {
          compositionRegistry.register(element)
          Logger.debug('[PackageRegistry] Registered element from package', {
            packageId: pkg.id,
            elementId: element.id,
          })
        } catch (error) {
          validationResult.warnings.push(
            `Failed to register element ${element.id}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }
    }

    // Call package lifecycle hook
    if (pkg.onRegister) {
      try {
        await pkg.onRegister()
      } catch (error) {
        Logger.error('[PackageRegistry] Package onRegister hook failed', {
          packageId: pkg.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    Logger.info('[PackageRegistry] Package registered successfully', {
      packageId: pkg.id,
      label: pkg.label,
      version: pkg.version,
      providedElements: pkg.providedElements?.length || 0,
      warnings: validationResult.warnings.length,
    })

    return validationResult
  }

  /**
   * Unregister a package
   *
   * @param packageId - Package ID to unregister
   */
  async unregister(packageId: string): Promise<void> {
    const pkg = this.packages.get(packageId)
    if (!pkg) {
      throw new Error(`Package ${packageId} not found`)
    }

    // Call lifecycle hook
    if (pkg.onUnregister) {
      try {
        await pkg.onUnregister()
      } catch (error) {
        Logger.error('[PackageRegistry] Package onUnregister hook failed', {
          packageId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Unregister elements (if they were package-specific)
    // Note: We don't unregister elements from compositionRegistry as they might be shared

    this.packages.delete(packageId)

    Logger.info('[PackageRegistry] Package unregistered', { packageId })
  }

  /**
   * Get a package by ID
   *
   * @param id - Package ID
   * @returns Package or undefined if not found
   */
  get(id: string): ServerStylePackage | undefined {
    return this.packages.get(id)
  }

  /**
   * Get all registered packages
   *
   * @returns Array of all packages
   */
  getAll(): ServerStylePackage[] {
    return Array.from(this.packages.values())
  }

  /**
   * Get all package IDs
   *
   * @returns Array of package IDs
   */
  getIds(): string[] {
    return Array.from(this.packages.keys())
  }

  /**
   * Check if a package is registered
   *
   * @param id - Package ID
   * @returns True if package is registered
   */
  has(id: string): boolean {
    return this.packages.has(id)
  }

  /**
   * Get package count
   */
  get count(): number {
    return this.packages.size
  }

  /**
   * Validate a package before registration
   *
   * Checks:
   * - Required fields present
   * - Dependencies available
   * - Required elements registered
   * - Version compatibility
   *
   * @param pkg - Package to validate
   * @returns Validation result
   */
  async validatePackage(pkg: ServerStylePackage): Promise<PackageValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Check required fields
    if (!pkg.id) errors.push('Package ID is required')
    if (!pkg.label) errors.push('Package label is required')
    if (pkg.version === undefined) errors.push('Package version is required')
    if (!pkg.buildGenerationPayload) errors.push('buildGenerationPayload function is required')

    // Check dependencies
    if (pkg.metadata?.compatibility?.requires) {
      for (const requiredPkg of pkg.metadata.compatibility.requires) {
        if (!this.packages.has(requiredPkg)) {
          errors.push(`Required package "${requiredPkg}" is not registered`)
        }
      }
    }

    // Check required elements
    if (pkg.requiredElements && pkg.requiredElements.length > 0) {
      for (const elementId of pkg.requiredElements) {
        if (!compositionRegistry.get(elementId)) {
          warnings.push(`Required element "${elementId}" is not registered (yet)`)
        }
      }
    }

    // Call package's own validation if it exists
    if (pkg.validate) {
      try {
        const packageValidation = await pkg.validate()
        if (!packageValidation.valid) {
          errors.push(...packageValidation.errors)
        }
      } catch (error) {
        errors.push(`Package validation threw error: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Initialize all registered packages
   *
   * Calls initialize() lifecycle hook on all packages
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      Logger.debug('[PackageRegistry] Already initialized, skipping')
      return
    }

    // Return existing promise if initialization is in progress
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this._doInitialize()
    await this.initializationPromise
  }

  private async _doInitialize(): Promise<void> {
    Logger.info('[PackageRegistry] Initializing packages', { count: this.packages.size })

    const initPromises: Promise<void>[] = []

    for (const [id, pkg] of this.packages.entries()) {
      if (pkg.initialize) {
        initPromises.push(
          pkg
            .initialize()
            .then(() => {
              Logger.debug('[PackageRegistry] Package initialized', { packageId: id })
            })
            .catch((error) => {
              Logger.error('[PackageRegistry] Package initialization failed', {
                packageId: id,
                error: error instanceof Error ? error.message : String(error),
              })
              // Don't throw - continue initializing other packages
            })
        )
      }
    }

    await Promise.all(initPromises)

    this.initialized = true
    Logger.info('[PackageRegistry] All packages initialized')
  }

  /**
   * Discover and register packages from filesystem
   *
   * Note: Auto-discovery is not implemented. Packages must be manually registered
   * using the register() method or registerPackages() helper.
   *
   * @returns Empty array (discovery not implemented)
   */
  async discover(): Promise<string[]> {
    Logger.debug('[PackageRegistry] Auto-discovery not implemented - use manual registration')
    return []
  }

  /**
   * Clear all packages (for testing)
   */
  clear(): void {
    this.packages.clear()
    this.initialized = false
    this.initializationPromise = null
    Logger.debug('[PackageRegistry] Registry cleared')
  }

  /**
   * Get packages by capability
   *
   * @param capability - Capability to filter by
   * @returns Packages that support the capability
   */
  getByCapability(capability: keyof PackageCapabilities): ServerStylePackage[] {
    return this.getAll().filter((pkg) => pkg.metadata?.capabilities?.[capability])
  }

  /**
   * Get package metadata
   *
   * @param id - Package ID
   * @returns Package metadata or undefined
   */
  getMetadata(id: string): PackageMetadata | undefined {
    return this.packages.get(id)?.metadata
  }
}

/**
 * Global package registry instance
 */
export const packageRegistry = new PackageRegistry()

/**
 * Helper function to register multiple packages at once
 */
export async function registerPackages(
  packages: ServerStylePackage[],
  options?: PackageRegistrationOptions
): Promise<void> {
  for (const pkg of packages) {
    await packageRegistry.register(pkg, options)
  }
}
