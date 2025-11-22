import type {
  BodyAngleSetting,
  WeightDistributionSetting,
  ArmPositionSetting,
  ExpressionSettings,
  HeadPositionSetting,
  SittingPoseSetting,
  PoseSettings,
  PhotoStyleSettings
} from '@/types/photo-style'

export interface PosePresetConfig {
  bodyAngle?: BodyAngleSetting
  weightDistribution?: WeightDistributionSetting
  armPosition?: ArmPositionSetting
  expression?: ExpressionSettings['type']
  headPosition?: HeadPositionSetting
  sittingPose?: SittingPoseSetting
}

/**
 * Maps pose preset types to their corresponding individual pose settings
 */
export function getPosePresetConfig(poseType: PoseSettings['type']): PosePresetConfig | null {
  if (poseType === 'user-choice') {
    return null
  }

  const poseMap: Record<Exclude<PoseSettings['type'], 'user-choice'>, PosePresetConfig> = {
    power_classic: {
      bodyAngle: 'slight-angle', // body_angle: 10 -> slight-angle
      weightDistribution: 'even', // weight: "even_50_50" -> even
      armPosition: 'arms-crossed', // arms: "hands_on_hips" -> arms-crossed (closest match)
      expression: 'serious', // expression: "confident_serious" -> serious
      headPosition: 'straight-level'
    },
    power_crossed: {
      bodyAngle: 'slight-angle', // body_angle: 15 -> slight-angle
      weightDistribution: 'even', // weight: "even_50_50" -> even
      armPosition: 'arms-crossed', // arms: "crossed_confident" -> arms-crossed
      expression: 'confident', // expression: "confident_slight_smile" -> confident
      headPosition: 'straight-level'
    },
    casual_confident: {
      bodyAngle: 'angle-45', // body_angle: 30 -> angle-45 (closest match)
      weightDistribution: 'back-foot-70', // weight: "70_back_foot" -> back-foot-70
      armPosition: 'one-hand-pocket', // arms: "hands_in_pockets" -> one-hand-pocket
      expression: 'friendly', // expression: "warm_genuine_smile" -> friendly
      headPosition: 'slight-tilt'
    },
    approachable_cross: {
      bodyAngle: 'angle-45', // body_angle: 30 -> angle-45
      weightDistribution: 'back-foot-70', // weight: "70_back_foot" -> back-foot-70
      armPosition: 'arms-crossed', // arms: "loose_cross_low" -> arms-crossed
      expression: 'friendly', // expression: "warm_smile" -> friendly
      headPosition: 'slight-tilt' // head_tilt: 8 -> slight-tilt
    },
    walking_confident: {
      bodyAngle: 'angle-45', // body_angle: 35 -> angle-45
      armPosition: 'relaxed-sides', // arms: "natural_swing" -> relaxed-sides
      expression: 'confident', // expression: "confident_engaged" -> confident
      headPosition: 'straight-level'
    },
    sitting_engaged: {
      sittingPose: 'upright-lean-forward', // position: "seated_front_edge", posture: "leaning_forward_10" -> upright-lean-forward
      armPosition: 'relaxed-sides', // arms: "forearms_on_thighs" -> relaxed-sides (closest match)
      expression: 'friendly', // expression: "warm_attentive" -> friendly
      headPosition: 'slight-tilt'
    },
    executive_seated: {
      sittingPose: 'upright-lean-forward', // position: "seated_upright" -> upright-lean-forward
      armPosition: 'arms-crossed', // arms: "hands_steepled" -> arms-crossed (closest match)
      expression: 'confident', // expression: "confident_authority" -> confident
      headPosition: 'straight-level'
    },
    thinker: {
      bodyAngle: 'slight-angle', // body_angle: 25 -> slight-angle
      armPosition: 'relaxed-sides', // hand_position: "hand_to_chin" -> relaxed-sides (closest match)
      expression: 'thoughtful', // expression: "contemplative" -> thoughtful
      headPosition: 'slight-tilt' // gaze: "thoughtful_direct" -> slight-tilt
    }
  }

  return poseMap[poseType] || null
}

/**
 * Applies pose preset configuration to PhotoStyleSettings
 */
export function applyPosePresetToSettings(
  settings: PhotoStyleSettings,
  poseType: PoseSettings['type']
): PhotoStyleSettings {
  if (poseType === 'user-choice') {
    return settings
  }

  const poseConfig = getPosePresetConfig(poseType)
  if (!poseConfig) {
    return settings
  }

  const updatedSettings: PhotoStyleSettings = { ...settings }

  // Update pose setting
  updatedSettings.pose = { type: poseType }

  // Apply individual pose component settings
  if (poseConfig.bodyAngle) {
    updatedSettings.bodyAngle = poseConfig.bodyAngle
  }
  if (poseConfig.weightDistribution) {
    updatedSettings.weightDistribution = poseConfig.weightDistribution
  }
  if (poseConfig.armPosition) {
    updatedSettings.armPosition = poseConfig.armPosition
  }
  if (poseConfig.expression) {
    updatedSettings.expression = { type: poseConfig.expression }
  }
  if (poseConfig.headPosition) {
    updatedSettings.headPosition = poseConfig.headPosition
  }
  if (poseConfig.sittingPose) {
    updatedSettings.sittingPose = poseConfig.sittingPose
  }

  return updatedSettings
}

