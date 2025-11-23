import type {
  ArmPositionSetting,
  BodyAngleSetting,
  HeadPositionSetting,
  ShoulderPositionSetting,
  SittingPoseSetting,
  WeightDistributionSetting,
  PoseSettings,
  ExpressionSettings,
  PhotoStyleSettings
} from '@/types/photo-style'
import { getExpressionLabel } from '../expression/config'

export { getExpressionLabel }

export const CHIN_TECHNIQUE_NOTE =
  'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.'

// Color mapping for pose categories
export const POSE_COLORS = {
  power: 'from-blue-600 to-indigo-600',
  approachable: 'from-green-500 to-emerald-500',
  dynamic: 'from-orange-500 to-red-500',
  seated: 'from-amber-500 to-yellow-500',
  thoughtful: 'from-violet-500 to-purple-600'
} as const

export interface PoseTemplate {
  id: PoseSettings['type']
  label: string
  description: string
  category: keyof typeof POSE_COLORS
  icon: string
  pose: {
    body_angle: string
    head_position: string
    shoulders: string
    weight_distribution: string
    arms: string
    description: string
  }
  prompt_instructions: string
}

export const JACKET_REVEAL_POSE: PoseTemplate = {
  id: 'power_classic', // Use existing ID or new one if needed
  label: 'Jacket Reveal',
  description: 'Confident pose revealing clothing details',
  category: 'power',
  icon: '👔',
  pose: {
    body_angle: 'Slightly angled to camera (15-20 degrees)',
    head_position: 'Turned towards camera, chin slightly down',
    shoulders: 'Relaxed, back straight',
    weight_distribution: 'Balanced on both feet',
    arms: 'One hand adjusting jacket/lapel, one relaxed',
    description: 'Professional pose highlighting attire'
  },
  prompt_instructions: 'Subject is adjusting their jacket with one hand, creating a natural and professional look that showcases the outfit.'
}

// Define all pose templates
export const POSE_TEMPLATES: Record<string, PoseTemplate> = {
  power_classic: {
    id: 'power_classic',
    label: 'Classic Power',
    description: 'Traditional executive stance',
    category: 'power',
    icon: '👔',
    pose: {
      body_angle: 'Square to camera',
      head_position: 'Level, direct gaze',
      shoulders: 'Squared and relaxed',
      weight_distribution: 'Even',
      arms: 'Relaxed at sides',
      description: 'Strong, direct executive presence'
    },
    prompt_instructions: 'Standard professional headshot pose, square to camera.'
  },
  power_crossed: {
    id: 'power_crossed',
    label: 'Arms Crossed',
    description: 'Confident authority',
    category: 'power',
    icon: '💪',
    pose: {
      body_angle: 'Slight angle',
      head_position: 'Turned to camera',
      shoulders: 'Relaxed',
      weight_distribution: 'Back foot',
      arms: 'Crossed confidently',
      description: 'Assertive professional stance'
    },
    prompt_instructions: 'Subject with arms crossed, projecting confidence and authority.'
  },
  casual_confident: {
    id: 'casual_confident',
    label: 'Casual Confident',
    description: 'Relaxed professional',
    category: 'approachable',
    icon: '😎',
    pose: {
      body_angle: 'Angled',
      head_position: 'Tilted slightly',
      shoulders: 'One dropped',
      weight_distribution: 'Relaxed',
      arms: 'One hand in pocket',
      description: 'Relaxed, modern professional look'
    },
    prompt_instructions: 'Casual business pose, one hand in pocket, relaxed posture.'
  },
  approachable_cross: {
    id: 'approachable_cross',
    label: 'Approachable',
    description: 'Warm and welcoming',
    category: 'approachable',
    icon: '🤝',
    pose: {
      body_angle: 'Open',
      head_position: 'Friendly tilt',
      shoulders: 'Relaxed',
      weight_distribution: 'Forward lean',
      arms: 'Loosely crossed or open',
      description: 'Friendly and open stance'
    },
    prompt_instructions: 'Warm, approachable pose, leaning slightly forward.'
  },
  walking_confident: {
    id: 'walking_confident',
    label: 'Walking',
    description: 'Dynamic movement',
    category: 'dynamic',
    icon: '🚶',
    pose: {
      body_angle: 'In motion',
      head_position: 'Looking forward',
      shoulders: 'Natural movement',
      weight_distribution: 'Mid-stride',
      arms: 'Natural swing',
      description: 'Captured in motion'
    },
    prompt_instructions: 'Subject walking towards camera or slightly angled, dynamic movement.'
  },
  sitting_engaged: {
    id: 'sitting_engaged',
    label: 'Sitting Engaged',
    description: 'Active listening',
    category: 'seated',
    icon: '🪑',
    pose: {
      body_angle: 'Seated, leaning forward',
      head_position: 'Attentive',
      shoulders: 'Relaxed',
      weight_distribution: 'Seated',
      arms: 'On knees or table',
      description: 'Engaged seated posture'
    },
    prompt_instructions: 'Subject seated, leaning forward slightly, engaged and attentive.'
  },
  executive_seated: {
    id: 'executive_seated',
    label: 'Executive Seated',
    description: 'Relaxed authority',
    category: 'seated',
    icon: '🛋️',
    pose: {
      body_angle: 'Seated back',
      head_position: 'Relaxed',
      shoulders: 'Open',
      weight_distribution: 'Seated',
      arms: 'On armrests or lap',
      description: 'Comfortable executive seating'
    },
    prompt_instructions: 'Subject seated comfortably, relaxed and authoritative.'
  },
  thinker: {
    id: 'thinker',
    label: 'The Thinker',
    description: 'Contemplative',
    category: 'thoughtful',
    icon: '🤔',
    pose: {
      body_angle: 'Angled',
      head_position: 'Resting on hand',
      shoulders: 'Relaxed',
      weight_distribution: 'Leaning',
      arms: 'Hand to chin/face',
      description: 'Thoughtful pose with hand near face'
    },
    prompt_instructions: 'Subject with hand near chin or face, thoughtful expression.'
  }
}

// Re-export from legacy for now to maintain compatibility
// In a future refactor, these definitions should move here fully
export function getPoseTemplate(id: string): PoseTemplate | undefined {
  return POSE_TEMPLATES[id]
}

export function getPoseUIInfo() {
  return Object.values(POSE_TEMPLATES).map(t => ({
    value: t.id,
    label: t.label,
    description: t.description,
    icon: t.icon,
    category: t.category
  }))
}

export function generatePoseInstructions(template: PoseTemplate): string {
  return template.prompt_instructions
}

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

export interface GranularPoseSettings {
  bodyAngle?: BodyAngleSetting
  weightDistribution?: WeightDistributionSetting
  armPosition?: ArmPositionSetting
  expression?: ExpressionSettings['type']
  headPosition?: HeadPositionSetting
  shoulderPosition?: ShoulderPositionSetting
  sittingPose?: SittingPoseSetting
}

export const POSE_PRESET_MAP: Record<string, GranularPoseSettings> = {
  power_classic: {
    bodyAngle: 'square',
    headPosition: 'straight-level',
    shoulderPosition: 'level',
    weightDistribution: 'even',
    armPosition: 'relaxed-sides',
    expression: 'confident'
  },
  power_crossed: {
    bodyAngle: 'slight-angle',
    headPosition: 'face-turn',
    weightDistribution: 'back-foot-70',
    armPosition: 'arms-crossed',
    expression: 'confident'
  },
  casual_confident: {
    bodyAngle: 'slight-angle',
    headPosition: 'slight-tilt',
    shoulderPosition: 'front-shoulder-dropped',
    weightDistribution: 'hip-shift',
    armPosition: 'one-hand-pocket',
    expression: 'genuine_smile'
  },
  approachable_cross: {
    bodyAngle: 'slight-angle',
    headPosition: 'slight-tilt',
    weightDistribution: 'hip-shift',
    armPosition: 'arms-crossed',
    expression: 'soft_smile'
  },
  walking_confident: {
    bodyAngle: 'slight-angle',
    headPosition: 'straight-level',
    weightDistribution: 'back-foot-70',
    armPosition: 'relaxed-sides',
    expression: 'confident'
  },
  sitting_engaged: {
    sittingPose: 'upright-lean-forward',
    headPosition: 'slight-tilt',
    expression: 'soft_smile'
  },
  executive_seated: {
    sittingPose: 'relaxed-back',
    headPosition: 'straight-level',
    expression: 'confident'
  },
  thinker: {
    headPosition: 'slight-tilt',
    expression: 'contemplative'
  }
}

export function getPoseSettings(id: string): GranularPoseSettings | undefined {
  return POSE_PRESET_MAP[id]
}

/**
 * Alias for getPoseSettings to match legacy mapper interface
 */
export function getPosePresetConfig(poseType: PoseSettings['type']): GranularPoseSettings | null {
  return getPoseSettings(poseType) || null
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

  const poseConfig = getPoseSettings(poseType)
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
  if (poseConfig.shoulderPosition) {
    updatedSettings.shoulderPosition = poseConfig.shoulderPosition
  }
  if (poseConfig.sittingPose) {
    updatedSettings.sittingPose = poseConfig.sittingPose
  }

  return updatedSettings
}
