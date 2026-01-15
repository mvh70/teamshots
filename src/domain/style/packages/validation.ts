/**
 * Package Configuration Validation
 *
 * Validates package configurations at startup to catch errors early.
 */

import type { ClientStylePackage } from './index'
import type { CategoryType } from '@/types/photo-style'
import { Logger } from '@/lib/logger'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const VALID_CATEGORIES: Set<CategoryType> = new Set([
  'background',
  'branding',
  'clothing',
  'clothingColors',
  'customClothing',
  'pose',
  'expression',
  'shotType',
  'lighting',
  'industry'
])

/**
 * Validate a single package configuration
 */
export function validatePackageConfig(
  id: string,
  config: ClientStylePackage
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!config.id) {
    errors.push('Missing id')
  } else if (config.id !== id) {
    errors.push(`Package id mismatch: expected '${id}', got '${config.id}'`)
  }

  if (!config.label) {
    errors.push('Missing label')
  }

  if (!config.defaultSettings) {
    errors.push('Missing defaultSettings')
  }

  if (!config.visibleCategories) {
    errors.push('Missing visibleCategories')
  }

  if (!config.promptBuilder) {
    errors.push('Missing promptBuilder function')
  }

  if (!config.extractUiSettings) {
    errors.push('Missing extractUiSettings function')
  }

  if (!config.persistenceAdapter) {
    errors.push('Missing persistenceAdapter')
  } else {
    if (!config.persistenceAdapter.serialize) {
      errors.push('Missing persistenceAdapter.serialize')
    }
    if (!config.persistenceAdapter.deserialize) {
      errors.push('Missing persistenceAdapter.deserialize')
    }
  }

  // Validate visibleCategories are valid CategoryType values
  if (config.visibleCategories) {
    for (const cat of config.visibleCategories) {
      if (!VALID_CATEGORIES.has(cat)) {
        errors.push(`Invalid category in visibleCategories: '${cat}'`)
      }
    }
  }

  // Check defaultSettings has shotType (critical for most packages)
  if (config.defaultSettings && !config.defaultSettings.shotType) {
    warnings.push('Missing defaultSettings.shotType - may cause runtime errors')
  }

  // Check if package has version field
  if (typeof config.version !== 'number') {
    warnings.push('Missing or invalid version number')
  }

  // Check if defaultPresetId is set
  if (!config.defaultPresetId) {
    warnings.push('Missing defaultPresetId')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate all packages in the registry
 */
export function validateAllPackages(
  packages: Record<string, ClientStylePackage>
): void {
  let hasErrors = false

  for (const [id, config] of Object.entries(packages)) {
    const result = validatePackageConfig(id, config)

    if (!result.valid) {
      hasErrors = true
      Logger.error(`Package '${id}' validation failed`, {
        errors: result.errors
      })
    }

    if (result.warnings.length > 0) {
      Logger.warn(`Package '${id}' has warnings`, {
        warnings: result.warnings
      })
    }
  }

  if (hasErrors) {
    throw new Error('One or more packages failed validation. Check logs for details.')
  }

  Logger.info('All packages validated successfully', {
    packageCount: Object.keys(packages).length
  })
}
