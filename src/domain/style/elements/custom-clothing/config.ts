/**
 * Custom Clothing Element Configuration
 */

import { CustomClothingSettings, DEFAULT_CUSTOM_CLOTHING } from './types'
import type { ElementConfig } from '../registry'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { deserializeCustomClothing } from './deserializer'

// Define StyleElementConfig inline since '../types' may not exist
interface StyleElementConfig<T> {
  id: string
  name: string
  description: string
  category: string
  defaultValue: T
  validate: (value: unknown) => value is T
  serialize: (value: T) => string
}

export const customClothingConfig: StyleElementConfig<CustomClothingSettings> = {
  id: 'customClothing',
  name: 'Custom Clothing',
  description: 'Upload an outfit image to match the clothing in generated headshots',
  category: 'appearance',

  defaultValue: DEFAULT_CUSTOM_CLOTHING,

  /**
   * Validate custom clothing settings
   */
  validate: (value: unknown): value is CustomClothingSettings => {
    if (typeof value !== 'object' || value === null) {
      return false
    }

    const settings = value as CustomClothingSettings

    // mode is required
    if (settings.mode !== 'user-choice' && settings.mode !== 'predefined') {
      return false
    }

    // If user-choice with a value, validate the value fields
    if (settings.mode === 'user-choice' && settings.value) {
      const val = settings.value
      // assetId/outfitS3Key are optional - user may set mode to user-choice before uploading
      // If colors are provided, validate structure
      if (val.colors) {
        const { topLayer, bottom } = val.colors
        if (!topLayer || !bottom) {
          return false
        }
        // Validate hex color format
        const hexRegex = /^#[0-9A-Fa-f]{6}$/
        if (!hexRegex.test(topLayer) || !hexRegex.test(bottom)) {
          return false
        }
        if (val.colors.baseLayer && !hexRegex.test(val.colors.baseLayer)) {
          return false
        }
        if (val.colors.shoes && !hexRegex.test(val.colors.shoes)) {
          return false
        }
      }

      // If description is provided, validate it's a string
      if (val.description !== undefined && typeof val.description !== 'string') {
        return false
      }
    }

    return true
  },

  /**
   * Serialize custom clothing settings to JSON
   */
  serialize: (value: CustomClothingSettings): string => {
    return JSON.stringify(value)
  },
}

/**
 * Element registry config for custom clothing
 * Uses the standard { mode, value } pattern
 */
export const customClothingElementConfig: ElementConfig<PhotoStyleSettings['customClothing']> = {
  getDefaultPredefined: () => ({ mode: 'predefined', value: undefined }),
  getDefaultUserChoice: () => ({ mode: 'user-choice', value: undefined }),
  deserialize: (raw) => deserializeCustomClothing(
    typeof raw.customClothing === 'string'
      ? raw.customClothing
      : JSON.stringify(raw.customClothing || DEFAULT_CUSTOM_CLOTHING)
  )
}
