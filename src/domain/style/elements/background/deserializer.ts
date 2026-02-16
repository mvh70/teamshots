import type { BackgroundSettings, BackgroundValue, BackgroundType } from './types'
import { predefined, userChoice } from '../base/element-types'

/**
 * Deserializes background settings from raw data
 *
 * Supports two formats:
 * 1. New format: { mode: 'predefined'|'user-choice', value?: BackgroundValue }
 * 2. Legacy format: { type: 'office'|'user-choice'|..., key?, color?, ... }
 */
const ALLOWED_TYPES = [
  'office', 'neutral', 'gradient', 'custom', 'tropical-beach', 'busy-city',
  'cafe', 'outdoor', 'solid', 'urban', 'stage', 'dark_studio', 'team_bright', 'lifestyle',
] as const satisfies readonly BackgroundType[]

function isValidBackgroundType(type: unknown): type is BackgroundType {
  return typeof type === 'string' && (ALLOWED_TYPES as readonly string[]).includes(type)
}

function extractBackgroundValue(bgObj: Record<string, unknown>): BackgroundValue {
  const typeValue = isValidBackgroundType(bgObj.type) ? bgObj.type : 'office'

  return {
    type: typeValue,
    key: typeof bgObj.key === 'string' ? bgObj.key : undefined,
    assetId: typeof bgObj.assetId === 'string' ? bgObj.assetId : undefined,
    prompt: typeof bgObj.prompt === 'string' ? bgObj.prompt : undefined,
    color: typeof bgObj.color === 'string' ? bgObj.color : undefined,
    modifier: typeof bgObj.modifier === 'string' ? bgObj.modifier : undefined,
  }
}

export function deserialize(raw: Record<string, unknown>, defaults?: BackgroundSettings): BackgroundSettings {
  const rawBg = raw.background as Record<string, unknown> | string | undefined

  if (!rawBg) {
    return defaults || userChoice()
  }

  // Handle object format
  if (typeof rawBg === 'object') {
    const bgObj = rawBg as Record<string, unknown>

    // Detect new format (has 'mode' field)
    if ('mode' in bgObj && typeof bgObj.mode === 'string') {
      const mode = bgObj.mode
      if (mode !== 'predefined' && mode !== 'user-choice') {
        return defaults || userChoice()
      }
      const rawValue = bgObj.value
      if (mode === 'predefined' && !rawValue) {
        return defaults || predefined({ type: 'office' })
      }
      if (typeof rawValue === 'object' && rawValue !== null) {
        return { mode: mode as 'predefined' | 'user-choice', value: extractBackgroundValue(rawValue as Record<string, unknown>) }
      }
      // user-choice with no value, or predefined with non-object value
      return { mode: mode as 'predefined' | 'user-choice', value: undefined }
    }

    // Migrate from legacy format (has 'type' field)
    if ('type' in bgObj && typeof bgObj.type === 'string') {
      const legacyType = bgObj.type as string

      // Legacy user-choice
      if (legacyType === 'user-choice') {
        return userChoice()
      }

      // Extract value from legacy format
      const value = extractBackgroundValue(bgObj)
      return predefined(value)
    }

    // Unknown object format - return defaults
    return defaults || userChoice()
  }

  return defaults || userChoice()
}

