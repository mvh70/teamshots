import { PhotoStyleSettings } from '@/types/photo-style'
import { getPackageConfig } from './packages'

// Clone deep utility
const cloneDeep = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/**
 * Extracts package ID from raw settings object (handles both old and new formats)
 * Centralized utility to avoid duplication across codebase
 */
export function extractPackageId(input: Record<string, unknown> | null | undefined): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }

  // NEW format: package at root
  if ('package' in input && typeof input.package === 'string') {
    return input.package
  }

  // NEW format: packageName at root
  if ('packageName' in input && typeof input.packageName === 'string') {
    return input.packageName
  }

  // OLD format: packageId at root
  if ('packageId' in input && typeof input.packageId === 'string') {
    return input.packageId
  }

  return undefined
}

/**
 * Resolves final style settings with correct priority:
 * 1. Package defaults (standards)
 * 2. Photo style/context settings (completely replace package defaults)
 * 3. User modifications (overlay specific fields)
 */
export function resolvePhotoStyleSettings(
  packageId: string,
  contextSettings?: PhotoStyleSettings | null,
  userModifications?: Partial<PhotoStyleSettings> | null
): PhotoStyleSettings {
  // Get package config and defaults
  const packageConfig = getPackageConfig(packageId)
  const packageDefaults = cloneDeep(packageConfig.defaultSettings)

  // If context settings exist, they completely replace package defaults
  const baseSettings = contextSettings ? cloneDeep(contextSettings) : packageDefaults

  // Apply user modifications as overlay (if provided)
  if (userModifications) {
    return mergeUserModifications(baseSettings, userModifications)
  }

  return baseSettings
}

/**
 * Merges user modifications onto base settings.
 * Only applies non-null/undefined values from modifications.
 */
function mergeUserModifications(
  base: PhotoStyleSettings,
  modifications: Partial<PhotoStyleSettings>
): PhotoStyleSettings {
  const result = { ...base }

  // Helper to merge nested objects (like background, branding, etc.)
  const mergeNested = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === undefined) continue
      if (typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        // Deep merge for nested objects
        mergeNested(target[key] as Record<string, unknown>, value as Record<string, unknown>)
      } else {
        // Direct assignment for primitive values and arrays
        target[key] = value
      }
    }
  }

  // Apply modifications to result
  mergeNested(result, modifications)

  return result
}
