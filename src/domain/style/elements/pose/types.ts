export type BodyAngleSetting = 'square' | 'slight-angle' | 'angle-45' | 'user-choice'
export type HeadPositionSetting = 'straight-level' | 'slight-tilt' | 'face-turn' | 'user-choice'
export type ShoulderPositionSetting = 'front-shoulder-dropped' | 'both-relaxed' | 'level' | 'user-choice'
export type WeightDistributionSetting = 'back-foot-70' | 'even' | 'hip-shift' | 'user-choice'
export type ArmPositionSetting =
  | 'not-visible'
  | 'arms-crossed'
  | 'one-hand-pocket'
  | 'adjusting-jacket'
  | 'relaxed-sides'
  | 'user-choice'
export type SittingPoseSetting = 'upright-lean-forward' | 'relaxed-back' | 'perched-edge' | 'user-choice'

export interface PoseDetails {
  bodyAngle?: BodyAngleSetting
  weightDistribution?: WeightDistributionSetting
  armPosition?: ArmPositionSetting
  // NOTE: expression removed - it's a separate PhotoStyleSettings field, not part of pose
  headPosition?: HeadPositionSetting
  shoulderPosition?: ShoulderPositionSetting
  sittingPose?: SittingPoseSetting
}

export interface PoseSettings extends PoseDetails {
  type:
    | 'power_classic'
    | 'power_crossed'
    | 'casual_confident'
    | 'approachable_cross'
    | 'walking_confident'
    | 'sitting_engaged'
    | 'executive_seated'
    | 'thinker'
    | 'jacket_reveal'
    | 'user-choice'
}
