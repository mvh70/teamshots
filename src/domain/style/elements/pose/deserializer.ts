import type { PoseSettings, LegacyPoseSettings, PoseValue, PoseType } from './types'
import { predefined, userChoice } from '../base/element-types'

/**
 * Deserializes pose settings from raw data
 * Supports both legacy format (type: 'user-choice' | 'pose_type')
 * and new format (mode: 'predefined' | 'user-choice', value?: PoseValue)
 */
export function deserialize(
  raw: Record<string, unknown>,
  defaults?: PoseSettings
): PoseSettings {
  const rawPose = raw.pose as Record<string, unknown> | undefined

  if (!rawPose) {
    return defaults || userChoice()
  }

  // Detect new format (has 'mode' field)
  if ('mode' in rawPose && typeof rawPose.mode === 'string') {
    const mode = rawPose.mode as 'predefined' | 'user-choice'
    const value = rawPose.value as PoseValue | undefined
    return { mode, value }
  }

  // Migrate from legacy format
  if ('type' in rawPose && typeof rawPose.type === 'string') {
    const legacyType = rawPose.type as string
    if (legacyType === 'user-choice') {
      return userChoice()
    }
    // Legacy format with actual pose type
    return predefined({ type: legacyType as PoseType })
  }

  return defaults || userChoice()
}
