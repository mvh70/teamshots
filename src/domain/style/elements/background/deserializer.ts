import type { BackgroundSettings, BackgroundValue, BackgroundType, BackgroundEnvironment, BackgroundModifier } from './types'
import { predefined, userChoice } from '../base/element-types'

/**
 * Deserializes background settings from raw data
 *
 * Supports three formats:
 * 1. New format: { mode: 'predefined'|'user-choice', value?: BackgroundValue }
 * 2. Legacy format: { type: 'office'|'user-choice'|..., key?, color?, ... }
 * 3. Simple string format: 'office', 'gradient', etc.
 */
const ALLOWED_TYPES: readonly string[] = [
  'office',
  'neutral',
  'gradient',
  'custom',
  'tropical-beach',
  'busy-city'
]

function isValidBackgroundType(type: unknown): type is BackgroundType {
  return typeof type === 'string' && ALLOWED_TYPES.includes(type)
}

function extractBackgroundValue(bgObj: Record<string, unknown>): BackgroundValue {
  const typeValue = isValidBackgroundType(bgObj.type) ? bgObj.type : 'office'

  return {
    type: typeValue,
    key: typeof bgObj.key === 'string' ? bgObj.key : undefined,
    assetId: typeof bgObj.assetId === 'string' ? bgObj.assetId : undefined,
    prompt: typeof bgObj.prompt === 'string' ? bgObj.prompt : undefined,
    color: typeof bgObj.color === 'string' ? bgObj.color : undefined,
    environment: typeof bgObj.environment === 'string' ? (bgObj.environment as BackgroundEnvironment) : undefined,
    modifier: typeof bgObj.modifier === 'string' ? (bgObj.modifier as BackgroundModifier) : undefined
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
      const mode = bgObj.mode as 'predefined' | 'user-choice'
      const value = bgObj.value as BackgroundValue | undefined
      return { mode, value }
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

  // Handle simple string format (e.g., 'office', 'gradient')
  if (typeof rawBg === 'string') {
    if (rawBg === 'user-choice') {
      return userChoice()
    }

    if (isValidBackgroundType(rawBg)) {
      return predefined({
        type: rawBg,
        prompt: typeof raw['backgroundPrompt'] === 'string' ? raw['backgroundPrompt'] : undefined
      })
    }
  }

  return defaults || userChoice()
}

/**
 * Resolves background assetId from settings
 * Returns assetId if present, otherwise returns undefined (caller can use key)
 */
export function getBackgroundAssetId(background?: BackgroundSettings): string | undefined {
  if (!background || !background.value) return undefined
  return background.value.assetId
}

/**
 * Gets the effective background key (prefers assetId, falls back to key)
 * Use this when you need an identifier for the background image
 */
export function getBackgroundIdentifier(background?: BackgroundSettings): string | undefined {
  if (!background || !background.value) return undefined
  return background.value.assetId ?? background.value.key
}

