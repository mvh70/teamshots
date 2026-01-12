import type { ShotTypeSettings, ShotTypeValue, LegacyShotTypeSettings } from './types'
import { predefined, userChoice } from '../base/element-types'

/**
 * Deserializes shot type settings from raw data
 * Supports both legacy format and new mode/value format
 */
export function deserialize(
  raw: Record<string, unknown>,
  defaults?: ShotTypeSettings
): ShotTypeSettings {
  const rawShotType = raw.shotType

  if (rawShotType === null || rawShotType === undefined || !('shotType' in raw)) {
    return defaults || userChoice()
  }

  const shotTypeObj = rawShotType as Record<string, unknown>

  // Detect new format (has 'mode' field)
  if ('mode' in shotTypeObj && typeof shotTypeObj.mode === 'string') {
    const mode = shotTypeObj.mode as 'predefined' | 'user-choice'
    const value = shotTypeObj.value as { type: ShotTypeValue } | undefined
    return { mode, value }
  }

  // Legacy format detection
  const legacy = shotTypeObj as unknown as LegacyShotTypeSettings

  if (legacy.type === 'user-choice') {
    return userChoice()
  }

  // Has a valid shot type value
  if (legacy.type) {
    return predefined({ type: legacy.type })
  }

  return defaults || userChoice()
}

