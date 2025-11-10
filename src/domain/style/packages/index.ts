import { CategoryType, PhotoStyleSettings } from '@/types/photo-style'
import type { StandardPresetConfig } from './standard-presets'
import { headshot1 } from './headshot1'
import { freepackage } from './freepackage'

export interface ClientStylePackage {
  id: string
  label: string
  version: number
  visibleCategories: CategoryType[]
  availableBackgrounds?: string[]
  defaultSettings: PhotoStyleSettings
  defaultPresetId: string
  promptBuilder: (settings: PhotoStyleSettings, ctx?: Record<string, unknown>) => string | Record<string, unknown>
  forPreviewPromptBuilder?: (settings: PhotoStyleSettings, ctx?: Record<string, unknown>) => string | Record<string, unknown>
  persistenceAdapter: {
    serialize: (ui: PhotoStyleSettings) => Record<string, unknown>
    deserialize: (raw: Record<string, unknown>) => PhotoStyleSettings
  }
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
