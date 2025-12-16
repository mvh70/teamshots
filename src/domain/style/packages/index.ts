import { CategoryType, PhotoStyleSettings } from '@/types/photo-style'
import { headshot1 } from './headshot1'
import { outfit1 } from './outfit1'
import { freepackage } from './freepackage'
import { tryitforfree } from './tryitforfree'
import { StandardPresetConfig } from './defaults'
import { isFeatureEnabled } from '@/config/feature-flags'
import { validateAllPackages } from './validation'

// Load element metadata registry
import '@/domain/style/elements'

export type { StandardPresetConfig, StandardPresetDefaults } from './defaults'

export interface ClientStylePackage {
  id: string
  label: string
  version: number
  visibleCategories: CategoryType[]
  /** Categories that belong to "Composition Settings" section (background, branding, pose, shotType) */
  compositionCategories?: CategoryType[]
  /** Categories that belong to "User Style Settings" section (clothing, clothingColors, expression, lighting) */
  userStyleCategories?: CategoryType[]
  availableBackgrounds?: string[]
  availablePoses?: string[]
  availableExpressions?: string[]
  defaultSettings: PhotoStyleSettings
  defaultPresetId: string
  presets?: Record<string, StandardPresetConfig>
  promptBuilder: (settings: PhotoStyleSettings, ctx?: Record<string, unknown>) => string | Record<string, unknown>
  forPreviewPromptBuilder?: (settings: PhotoStyleSettings, ctx?: Record<string, unknown>) => string | Record<string, unknown>
  persistenceAdapter: {
    serialize: (ui: PhotoStyleSettings) => Record<string, unknown>
    deserialize: (raw: Record<string, unknown>) => PhotoStyleSettings
  }
  /** Extract UI settings from raw request data */
  extractUiSettings: (rawStyleSettings: Record<string, unknown>) => PhotoStyleSettings
  resolveStandardPreset?: (
    preset: StandardPresetConfig,
    styleSettings: PhotoStyleSettings
  ) => StandardPresetConfig
}

// Build CLIENT_PACKAGES dynamically based on feature flags
function buildClientPackages(): Record<string, ClientStylePackage> {
  const packages: Record<string, ClientStylePackage> = {
    [headshot1.id]: headshot1,
    [freepackage.id]: freepackage,
    [tryitforfree.id]: tryitforfree
  }

  // Add outfit1 only if feature flag is enabled
  if (isFeatureEnabled('outfitTransfer')) {
    packages[outfit1.id] = outfit1
  }

  return packages
}

export const CLIENT_PACKAGES = buildClientPackages()

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
