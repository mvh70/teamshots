import { CategoryType, PhotoStyleSettings } from '@/types/photo-style'
import { headshot1 } from './headshot1'
import { freepackage } from './freepackage'
import { StandardPresetConfig } from './defaults'

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

export const CLIENT_PACKAGES: Record<string, ClientStylePackage> = {
  [headshot1.id]: headshot1,
  [freepackage.id]: freepackage
}

export const getPackageConfig = (id?: string): ClientStylePackage => {
  if (!id) return headshot1
  return CLIENT_PACKAGES[id] || headshot1
}
