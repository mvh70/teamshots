/**
 * Custom Clothing Deserializer
 *
 * Converts JSON strings to CustomClothingSettings objects
 */

import { CustomClothingSettings, DEFAULT_CUSTOM_CLOTHING } from './types'
import { customClothingConfig } from './config'
import { Logger } from '@/lib/logger'

/**
 * Deserialize custom clothing settings from JSON string
 */
export function deserializeCustomClothing(json: string | null | undefined): CustomClothingSettings {
  if (!json) {
    return DEFAULT_CUSTOM_CLOTHING
  }

  try {
    const parsed = JSON.parse(json)

    // Migrate old format: { enabled: false } -> { type: 'predefined' }
    if ('enabled' in parsed && typeof parsed.enabled === 'boolean') {
      return DEFAULT_CUSTOM_CLOTHING
    }

    // Validate the parsed object
    if (!customClothingConfig.validate(parsed)) {
      Logger.warn('Invalid custom clothing settings, using default', { parsed })
      return DEFAULT_CUSTOM_CLOTHING
    }

    return parsed
  } catch (error) {
    Logger.error('Failed to parse custom clothing JSON', { error: error instanceof Error ? error.message : String(error), json })
    return DEFAULT_CUSTOM_CLOTHING
  }
}
