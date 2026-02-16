import type { ElementSetting } from '../base/element-types'

/**
 * Available pose template types
 */
export type PoseType =
  | 'power_classic'
  | 'classic_corporate'
  | 'power_cross'
  | 'casual_confident'
  | 'approachable_cross'
  | 'approachable_lean'
  | 'walking_confident'
  | 'executive_seated'
  | 'thinker'
  | 'slimming_three_quarter'
  | 'candid_over_shoulder'
  | 'seated_engagement'
  | 'jacket_reveal'
  | 'thumbs_up'

/**
 * Pose value - the actual pose configuration (no 'user-choice')
 */
export interface PoseValue {
  type: PoseType
}

/**
 * Pose settings with mode wrapper
 *
 * @example
 * // Admin predefined
 * { mode: 'predefined', value: { type: 'classic_corporate' } }
 *
 * // User choice (not yet selected)
 * { mode: 'user-choice', value: undefined }
 */
export type PoseSettings = ElementSetting<PoseValue>

/**
 * Legacy format for migration support
 * @deprecated Use PoseSettings instead
 */
export interface LegacyPoseSettings {
  type:
    | 'user-choice'
    | 'power_classic'
    | 'classic_corporate'
    | 'power_cross'
    | 'casual_confident'
    | 'approachable_cross'
    | 'approachable_lean'
    | 'walking_confident'
    | 'executive_seated'
    | 'thinker'
    | 'slimming_three_quarter'
    | 'candid_over_shoulder'
    | 'seated_engagement'
    | 'jacket_reveal'
    | 'thumbs_up'
}
