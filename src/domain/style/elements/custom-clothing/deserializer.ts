/**
 * Custom Clothing Deserializer
 *
 * Converts JSON strings to CustomClothingSettings objects
 * Handles migration from old format (type field) to new format (mode + value)
 */

import { CustomClothingSettings, CustomClothingValue, CustomClothingColors, DEFAULT_CUSTOM_CLOTHING } from './types'
import { customClothingConfig } from './config'
import { Logger } from '@/lib/logger'

/**
 * Migrate color field names from old format
 */
function migrateColors(colors: Record<string, unknown>): Record<string, unknown> {
  const migrated = { ...colors }
  if ('topBase' in migrated && !('baseLayer' in migrated)) {
    migrated.baseLayer = migrated.topBase
    delete migrated.topBase
  }
  if ('topCover' in migrated && !('topLayer' in migrated)) {
    migrated.topLayer = migrated.topCover
    delete migrated.topCover
  }
  return migrated
}

/**
 * Deserialize custom clothing settings from JSON string
 * Handles backward compatibility with old format
 */
export function deserializeCustomClothing(json: string | null | undefined): CustomClothingSettings {
  if (!json) {
    return DEFAULT_CUSTOM_CLOTHING
  }

  try {
    const parsed = JSON.parse(json)

    // Already in new format (has mode field)
    if ('mode' in parsed && (parsed.mode === 'predefined' || parsed.mode === 'user-choice')) {
      // Migrate colors if present in value
      if (parsed.value?.colors) {
        parsed.value.colors = migrateColors(parsed.value.colors)
      }
      
      // Validate and return
      if (customClothingConfig.validate(parsed)) {
        return parsed
      }
      Logger.warn('Invalid custom clothing settings (new format), using default', { parsed })
      return DEFAULT_CUSTOM_CLOTHING
    }

    // Migrate old format: { enabled: false } -> { mode: 'predefined' }
    if ('enabled' in parsed && typeof parsed.enabled === 'boolean') {
      return DEFAULT_CUSTOM_CLOTHING
    }

    // Migrate old format: { type: 'predefined' | 'user-choice', ...data }
    if ('type' in parsed && (parsed.type === 'predefined' || parsed.type === 'user-choice')) {
      const mode = parsed.type as 'predefined' | 'user-choice'
      
      // Extract value fields from old flat structure
      const value: CustomClothingValue = {}
      if (parsed.outfitS3Key) value.outfitS3Key = parsed.outfitS3Key
      if (parsed.assetId) value.assetId = parsed.assetId
      if (parsed.collageS3Key) value.collageS3Key = parsed.collageS3Key
      if (parsed.colors) value.colors = migrateColors(parsed.colors as Record<string, unknown>) as unknown as CustomClothingColors
      if (parsed.description) value.description = parsed.description
      if (parsed.uploadedAt) value.uploadedAt = parsed.uploadedAt

      // Only include value if there's actual data
      const hasValue = Object.keys(value).length > 0
      
      const migrated: CustomClothingSettings = {
        mode,
        value: hasValue ? value : undefined
      }

      Logger.debug('Migrated custom clothing from old format', { old: parsed, new: migrated })
      return migrated
    }

    Logger.warn('Unrecognized custom clothing format, using default', { parsed })
    return DEFAULT_CUSTOM_CLOTHING
  } catch (error) {
    Logger.error('Failed to parse custom clothing JSON', { error: error instanceof Error ? error.message : String(error), json })
    return DEFAULT_CUSTOM_CLOTHING
  }
}
