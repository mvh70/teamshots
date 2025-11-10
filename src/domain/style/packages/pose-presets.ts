import type {
  ArmPositionSetting,
  BodyAngleSetting,
  ExpressionSettings,
  HeadPositionSetting,
  ShoulderPositionSetting,
  SittingPoseSetting,
  WeightDistributionSetting
} from '@/types/photo-style'

export const CHIN_TECHNIQUE_NOTE =
  'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.'

interface PoseConfig<T extends string> {
  id: T
  label: string
  description: string
  notes?: string[]
}

export const DEFAULT_BODY_ANGLE: BodyAngleSetting = 'slight-angle'

const BODY_ANGLE_CONFIGS: Record<BodyAngleSetting, PoseConfig<BodyAngleSetting>> = {
  'square': {
    id: 'square',
    label: 'Straight/Square (0°)',
    description: 'Stand square to camera with shoulders parallel. Projects confidence and power.'
  },
  'slight-angle': {
    id: 'slight-angle',
    label: 'Slight Angle (20-30°)',
    description: 'Turn torso 20-30° away from camera. Slimming, polished, and professional.',
    notes: ['Shift hips slightly away from camera to reinforce the slimming line.']
  },
  'angle-45': {
    id: 'angle-45',
    label: '45° Angle',
    description: 'Rotate 45° from camera. Creates editorial slimming lines and dynamic energy.'
  },
  'user-choice': {
    id: 'user-choice',
    label: 'User Choice',
    description: 'Use photographer-selected body angle.'
  }
}

export function resolveBodyAngle(input?: string): PoseConfig<BodyAngleSetting> {
  if (!input) return BODY_ANGLE_CONFIGS[DEFAULT_BODY_ANGLE]
  const config = BODY_ANGLE_CONFIGS[input as BodyAngleSetting]
  return config ?? BODY_ANGLE_CONFIGS[DEFAULT_BODY_ANGLE]
}

export const DEFAULT_HEAD_POSITION: HeadPositionSetting = 'straight-level'

const HEAD_POSITION_CONFIGS: Record<HeadPositionSetting, PoseConfig<HeadPositionSetting>> = {
  'straight-level': {
    id: 'straight-level',
    label: 'Straight/Level',
    description: 'Head level, eyes to camera. Neutral, executive presence.'
  },
  'slight-tilt': {
    id: 'slight-tilt',
    label: 'Slight Tilt (10-15°)',
    description: 'Micro tilt for warmth and approachability.'
  },
  'face-turn': {
    id: 'face-turn',
    label: 'Face Turn (Toward Light)',
    description: 'Turn face 20-30° toward primary light to define jawline and cheekbones.'
  },
  'user-choice': {
    id: 'user-choice',
    label: 'User Choice',
    description: 'Use photographer-selected head position.'
  }
}

export function resolveHeadPosition(input?: string): PoseConfig<HeadPositionSetting> {
  if (!input) return HEAD_POSITION_CONFIGS[DEFAULT_HEAD_POSITION]
  const config = HEAD_POSITION_CONFIGS[input as HeadPositionSetting]
  return config ?? HEAD_POSITION_CONFIGS[DEFAULT_HEAD_POSITION]
}

export const DEFAULT_SHOULDER_POSITION: ShoulderPositionSetting = 'front-shoulder-dropped'

const SHOULDER_POSITION_CONFIGS: Record<
  ShoulderPositionSetting,
  PoseConfig<ShoulderPositionSetting>
> = {
  'front-shoulder-dropped': {
    id: 'front-shoulder-dropped',
    label: 'Front Shoulder Dropped',
    description: 'Lower the front shoulder slightly to create a flattering diagonal line.',
    notes: ['Keep back shoulder relaxed to avoid tension.']
  },
  'both-relaxed': {
    id: 'both-relaxed',
    label: 'Both Shoulders Relaxed Down',
    description: 'Relax both shoulders downward to lengthen the neck and remove tension.'
  },
  'level': {
    id: 'level',
    label: 'Level Shoulders',
    description: 'Neutral shoulder position for a safe, formal presentation.'
  },
  'user-choice': {
    id: 'user-choice',
    label: 'User Choice',
    description: 'Use photographer-selected shoulder positioning.'
  }
}

export function resolveShoulderPosition(input?: string): PoseConfig<ShoulderPositionSetting> {
  if (!input) return SHOULDER_POSITION_CONFIGS[DEFAULT_SHOULDER_POSITION]
  const config = SHOULDER_POSITION_CONFIGS[input as ShoulderPositionSetting]
  return config ?? SHOULDER_POSITION_CONFIGS[DEFAULT_SHOULDER_POSITION]
}

export const DEFAULT_WEIGHT_DISTRIBUTION: WeightDistributionSetting = 'back-foot-70'

const WEIGHT_DISTRIBUTION_CONFIGS: Record<
  WeightDistributionSetting,
  PoseConfig<WeightDistributionSetting>
> = {
  'back-foot-70': {
    id: 'back-foot-70',
    label: '70% Weight on Back Foot',
    description: 'Shift 70% of weight to rear foot, front knee soft. Creates relaxed, natural stance.'
  },
  'even': {
    id: 'even',
    label: 'Even Weight (50/50)',
    description: 'Distribute weight evenly for a steady, formal stance.'
  },
  'hip-shift': {
    id: 'hip-shift',
    label: 'Weight Shifted to One Hip',
    description: 'Pop back hip with front knee relaxed for casual curve and energy.'
  },
  'user-choice': {
    id: 'user-choice',
    label: 'User Choice',
    description: 'Use photographer-selected weight distribution.'
  }
}

export function resolveWeightDistribution(input?: string): PoseConfig<WeightDistributionSetting> {
  if (!input) return WEIGHT_DISTRIBUTION_CONFIGS[DEFAULT_WEIGHT_DISTRIBUTION]
  const config = WEIGHT_DISTRIBUTION_CONFIGS[input as WeightDistributionSetting]
  return config ?? WEIGHT_DISTRIBUTION_CONFIGS[DEFAULT_WEIGHT_DISTRIBUTION]
}

export const DEFAULT_ARM_POSITION: ArmPositionSetting = 'not-visible'

const ARM_POSITION_CONFIGS: Record<ArmPositionSetting, PoseConfig<ArmPositionSetting>> = {
  'not-visible': {
    id: 'not-visible',
    label: 'Arms Not Visible',
    description: 'Crop arms out of frame. Ideal for headshots and tight portraits.',
    notes: ['Maintain small gap between upper arm and torso when arms appear at frame edge.']
  },
  'arms-crossed': {
    id: 'arms-crossed',
    label: 'Arms Crossed',
    description: 'Arms crossed gently, shoulders relaxed—projects confident executive presence.',
    notes: ['Show hands lightly gripping biceps without squeezing.']
  },
  'one-hand-pocket': {
    id: 'one-hand-pocket',
    label: 'One Hand in Pocket',
    description: 'Place one hand in pocket, thumb hooked. Casual yet confident.',
    notes: ['Keep other hand relaxed with a visible edge, never flat to camera.']
  },
  'adjusting-jacket': {
    id: 'adjusting-jacket',
    label: 'Adjusting Jacket/Cuffs',
    description: 'One hand adjusting lapel or cuffs for polished movement.',
    notes: ['Fingers relaxed, wrists soft; avoid covering the logo if branding is included.']
  },
  'relaxed-sides': {
    id: 'relaxed-sides',
    label: 'Relaxed at Sides',
    description: 'Arms rest at sides with slight bend and relaxed fingers.',
    notes: [
      'Maintain small daylight between arm and body for slimming effect.',
      'Show the edge of hands rather than back of hands.'
    ]
  },
  'user-choice': {
    id: 'user-choice',
    label: 'User Choice',
    description: 'Use photographer-selected arm positioning.'
  }
}

export function resolveArmPosition(input?: string): PoseConfig<ArmPositionSetting> {
  if (!input) return ARM_POSITION_CONFIGS[DEFAULT_ARM_POSITION]
  const config = ARM_POSITION_CONFIGS[input as ArmPositionSetting]
  return config ?? ARM_POSITION_CONFIGS[DEFAULT_ARM_POSITION]
}

const EXPRESSION_LABELS: Record<NonNullable<ExpressionSettings['type']>, string> = {
  professional: 'professional, composed expression',
  friendly: 'friendly warm smile',
  serious: 'serious neutral expression',
  confident: 'confident poised look',
  happy: 'genuine warm smile',
  sad: 'subtle contemplative expression',
  neutral: 'neutral relaxed expression',
  thoughtful: 'thoughtful engaged expression',
  'user-choice': 'use photographer-selected expression'
}

export function getExpressionLabel(type?: ExpressionSettings['type'] | null): string {
  if (!type) return EXPRESSION_LABELS.neutral
  const expressionType = type as NonNullable<ExpressionSettings['type']>
  return EXPRESSION_LABELS[expressionType] ?? EXPRESSION_LABELS.neutral
}

export const DEFAULT_SITTING_POSE: SittingPoseSetting = 'upright-lean-forward'

const SITTING_POSE_CONFIGS: Record<SittingPoseSetting, PoseConfig<SittingPoseSetting>> = {
  'upright-lean-forward': {
    id: 'upright-lean-forward',
    label: 'Sitting Upright, Leaning Forward Slightly',
    description: 'Sit tall near front of seat, lean forward 5-10° for engagement.',
    notes: ['Angle knees 20° off-center. Keep feet flat or ankles gently crossed.']
  },
  'relaxed-back': {
    id: 'relaxed-back',
    label: 'Relaxed Back',
    description: 'Sit back with relaxed posture for casual portrait.',
    notes: ['Maintain open chest by rolling shoulders back.']
  },
  'perched-edge': {
    id: 'perched-edge',
    label: 'Perched on Edge',
    description: 'Sit on chair edge for energetic posture with forward momentum.',
    notes: ['Legs angled to side; avoid pointing knees straight to camera.']
  },
  'user-choice': {
    id: 'user-choice',
    label: 'User Choice',
    description: 'Use photographer-selected seated pose.'
  }
}

export function resolveSittingPose(input?: string): PoseConfig<SittingPoseSetting> {
  if (!input) return SITTING_POSE_CONFIGS[DEFAULT_SITTING_POSE]
  const config = SITTING_POSE_CONFIGS[input as SittingPoseSetting]
  return config ?? SITTING_POSE_CONFIGS[DEFAULT_SITTING_POSE]
}

