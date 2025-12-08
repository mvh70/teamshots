/**
 * Custom Clothing Element Configuration
 */

import { CustomClothingSettings, DEFAULT_CUSTOM_CLOTHING } from './types'

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

    // enabled is required
    if (typeof settings.enabled !== 'boolean') {
      return false
    }

    // If enabled, must have assetId or outfitS3Key
    if (settings.enabled) {
      if (!settings.assetId && !settings.outfitS3Key) {
        return false
      }

      // If colors are provided, validate structure
      if (settings.colors) {
        const { topBase, bottom } = settings.colors
        if (!topBase || !bottom) {
          return false
        }
        // Validate hex color format
        const hexRegex = /^#[0-9A-Fa-f]{6}$/
        if (!hexRegex.test(topBase) || !hexRegex.test(bottom)) {
          return false
        }
        if (settings.colors.topCover && !hexRegex.test(settings.colors.topCover)) {
          return false
        }
        if (settings.colors.shoes && !hexRegex.test(settings.colors.shoes)) {
          return false
        }
      }

      // If description is provided, validate it's a string
      if (settings.description !== undefined && typeof settings.description !== 'string') {
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
