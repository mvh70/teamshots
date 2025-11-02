import { CategoryType, PhotoStyleSettings } from '@/types/photo-style'
import { headshot1 } from './headshot1'
import { freepackage } from './freepackage'

export interface StylePackage {
  id: string
  label: string
  version: number
  visibleCategories: CategoryType[]
  availableBackgrounds?: string[] // Optional: list of background IDs this package supports
  defaultSettings: PhotoStyleSettings
  promptBuilder: (settings: PhotoStyleSettings, ctx?: Record<string, unknown>) => string | Record<string, unknown>
  persistenceAdapter: {
    serialize: (ui: PhotoStyleSettings) => Record<string, unknown>
    deserialize: (raw: Record<string, unknown>) => PhotoStyleSettings
  }
}

export const PACKAGES: Record<string, StylePackage> = {
  [headshot1.id]: headshot1,
  [freepackage.id]: freepackage
}

export const getPackageConfig = (id?: string): StylePackage => {
  if (!id) return headshot1
  return PACKAGES[id] || headshot1
}


