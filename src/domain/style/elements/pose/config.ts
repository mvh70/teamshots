import type { PoseType, PoseSettings, PoseValue } from './types'
import type { ElementConfig } from '../registry'
import { predefined, userChoice } from '../base/element-types'

export interface PoseTemplate {
  id: PoseType
  // Label and description handled via translation keys:
  // pose.template.[id].label
  // pose.template.[id].description
  icon: string
  pose: {
    body_angle: string
    head_position: string
    chin_technique: string
    shoulders: string
    weight_distribution: string
    arms: string
    description: string
    sitting_position?: string
  }
  prompt_instructions: string
}

export const ALL_POSE_IDS: PoseType[] = [
  'power_classic',
  'classic_corporate',
  'power_cross',
  'casual_confident',
  'approachable_cross',
  'approachable_lean',
  'walking_confident',
  'executive_seated',
  'thinker',
  'slimming_three_quarter',
  'candid_over_shoulder',
  'seated_engagement',
  'jacket_reveal',
  'thumbs_up'
]

export const POSE_TEMPLATES: Record<string, PoseTemplate> = {
  power_classic: {
    id: 'power_classic',
    icon: '👔',
    pose: {
      body_angle: 'Square to camera',
      head_position: 'Level, direct gaze',
      chin_technique: 'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.',
      shoulders: 'Squared and relaxed',
      weight_distribution: 'Even',
      arms: 'Relaxed at sides',
      description: 'Strong, direct executive presence'
    },
    prompt_instructions: 'Standard professional headshot pose, square to camera.'
  },
  classic_corporate: {
    id: 'classic_corporate',
    icon: '🏢',
    pose: {
      body_angle: 'Slight angle (10-15 degrees) toward camera',
      head_position: 'Facing camera directly',
      chin_technique:
        'Chin forward and down: push the forehead slightly toward the lens to tighten the jawline.',
      shoulders: 'Even, relaxed, and lowered away from ears',
      weight_distribution: 'Even on both feet',
      arms: 'Relaxed at sides',
      description: 'Trustworthy and direct standard professional headshot'
    },
    prompt_instructions:
      'Classic corporate headshot: subject stands with a subtle 10-15° body angle, head facing camera, shoulders relaxed and level, and a direct trustworthy gaze.'
  },
  power_cross: {
    id: 'power_cross',
    icon: '💼',
    pose: {
      body_angle: 'Slight angle (10-20 degrees)',
      head_position: 'Straight to camera',
      chin_technique: 'Chin neutral for a confident and composed look',
      shoulders: 'Broad and pulled back',
      weight_distribution: 'Back foot',
      arms: 'Arms crossed at mid-chest level with relaxed hands tucked naturally',
      description: 'Assertive professional stance conveying authority'
    },
    prompt_instructions:
      'Assertive professional pose with a slight angle to camera, shoulders broad and pulled back, and arms crossed at mid-chest level (not high on the neck).'
  },
  casual_confident: {
    id: 'casual_confident',
    icon: '😎',
    pose: {
      body_angle: 'Angled 15-20 degrees toward camera',
      head_position: 'Slight 10-degree tilt toward the front shoulder',
      chin_technique: 'Chin forward and down to define the jawline clearly.',
      shoulders: 'Front shoulder dropped slightly lower than the back shoulder',
      weight_distribution: 'Relaxed',
      arms: 'One hand in pocket',
      description: 'Relaxed, modern professional look'
    },
    prompt_instructions: 'Casual business pose: body angled 15-20° toward camera, slight head tilt toward the front shoulder, and one hand in pocket.'
  },
  approachable_cross: {
    id: 'approachable_cross',
    icon: '🤝',
    pose: {
      body_angle: 'Open 10-15 degrees toward camera',
      head_position: 'Friendly 8-degree head tilt',
      chin_technique: 'Chin forward and down with gentle neck extension.',
      shoulders: 'Relaxed',
      weight_distribution: 'Forward lean',
      arms: 'Arms loosely crossed at low chest level with hands visible',
      description: 'Friendly and open stance'
    },
    prompt_instructions: 'Warm approachable pose with a slight forward lean, relaxed shoulders, and arms loosely crossed at low chest level.'
  },
  approachable_lean: {
    id: 'approachable_lean',
    icon: '🙂',
    pose: {
      body_angle: 'Leaning forward from the waist by about 10 degrees',
      head_position: 'Engaged with neutral head alignment',
      chin_technique: 'Chin level, neck elongated',
      shoulders: 'Rolled gently forward to create connection',
      weight_distribution: 'Front foot (leaning in)',
      arms: 'Hands loosely clasped together at waist level',
      description:
        'Engaging and friendly posture, ideal for creative or client-facing professional roles'
    },
    prompt_instructions:
      'Approachable professional lean while standing: hinge forward from the waist about 10°, keep neck elongated, and place hands loosely clasped at waist level.'
  },
  walking_confident: {
    id: 'walking_confident',
    icon: '🚶',
    pose: {
      body_angle: 'In motion',
      head_position: 'Looking forward',
      chin_technique: 'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.',
      shoulders: 'Natural movement',
      weight_distribution: 'Mid-stride',
      arms: 'Natural swing',
      description: 'Captured in motion'
    },
    prompt_instructions: 'Subject walking in mid-stride at a 15° angle toward camera with natural arm swing and dynamic movement.'
  },
  slimming_three_quarter: {
    id: 'slimming_three_quarter',
    icon: '📐',
    pose: {
      body_angle: 'Angled 45 degrees away from camera',
      head_position: 'Turned back toward camera',
      chin_technique: 'Chin slightly up and over the front shoulder',
      shoulders: 'Front shoulder dipped slightly lower than the back',
      weight_distribution: 'Back foot',
      arms: 'Front arm relaxed with forearm lightly bent near waistline; back arm relaxed at side',
      description: 'Dynamic and slimming three-quarter turn favored for LinkedIn profiles'
    },
    prompt_instructions:
      'Three-quarter slimming turn: body angled 45° away from camera, head turned back toward camera, chin slightly up over the front shoulder, front forearm lightly bent near the waistline, and back arm relaxed.'
  },
  executive_seated: {
    id: 'executive_seated',
    icon: '🛋️',
    pose: {
      body_angle: 'Seated back',
      head_position: 'Relaxed',
      chin_technique: 'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.',
      shoulders: 'Open',
      weight_distribution: 'Seated',
      arms: 'Hands resting naturally on lap',
      description: 'Comfortable executive seating',
      sitting_position: 'Seated back comfortably, weight resting against chair back'
    },
    prompt_instructions: 'Subject seated comfortably, relaxed and authoritative.'
  },
  thinker: {
    id: 'thinker',
    icon: '🤔',
    pose: {
      body_angle: 'Angled',
      head_position: 'Resting on hand',
      chin_technique: 'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.',
      shoulders: 'Relaxed',
      weight_distribution: 'Leaning',
      arms: 'Dominant hand resting lightly under the chin, non-dominant arm relaxed',
      description: 'Thoughtful pose with hand near face'
    },
    prompt_instructions: 'Subject in a thoughtful pose with dominant hand lightly under the chin and relaxed shoulders.'
  },
  candid_over_shoulder: {
    id: 'candid_over_shoulder',
    icon: '🧍‍♂️',
    pose: {
      body_angle: 'Turned 60-75 degrees away from camera',
      head_position: 'Turned back toward camera over the front shoulder',
      chin_technique: 'Chin neutral with a slight forward extension',
      shoulders: 'Back shoulder slightly higher, front shoulder relaxed down',
      weight_distribution: 'Even',
      arms: 'Arms relaxed at sides with natural bend at elbows',
      description: 'Modern, relaxed candid pose looking back over the shoulder'
    },
    prompt_instructions:
      'Candid over-shoulder pose: subject turned 60-75° away from camera with head turned back over the front shoulder, neutral chin, relaxed shoulders, and arms resting naturally at the sides.'
  },
  seated_engagement: {
    id: 'seated_engagement',
    icon: '🪑',
    pose: {
      body_angle: 'Seated and hinged forward from hips about 12 degrees',
      head_position: 'Level and engaged, slightly forward to avoid neck bunching',
      chin_technique: 'Chin slightly down with alert eyes',
      shoulders: 'Relaxed down while maintaining a slight forward engagement',
      weight_distribution: 'Centered on chair with subtle forward engagement',
      arms: 'Elbows close to torso with forearms angled toward lap and hands loosely clasped',
      description: 'Warm and attentive seated pose, implying active listening across a desk',
      sitting_position:
        'Seated upright, hinged forward from hips about 12 degrees, feet grounded'
    },
    prompt_instructions:
      'Seated engagement pose: subject seated upright and hinged forward from the hips about 10-15°, head level and engaged, elbows near torso, forearms angled toward lap, and hands loosely clasped. Keep the chest area clear so logos remain visible when branding is present.'
  },
  jacket_reveal: {
    id: 'jacket_reveal',
    icon: '👔',
    pose: {
      body_angle: 'Slightly angled to camera (15-20 degrees)',
      head_position: 'Turned toward camera with chin slightly down',
      chin_technique: 'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.',
      shoulders: 'Relaxed, back straight',
      weight_distribution: 'Balanced on both feet',
      arms: 'Both hands opening the jacket evenly to reveal the base layer logo',
      description: 'Professional pose highlighting attire'
    },
    prompt_instructions: 'Subject opens the jacket evenly with both hands to reveal the logo on the shirt underneath; keep jacket opening consistent so the logo stays clearly visible.'
  },
  thumbs_up: {
    id: 'thumbs_up',
    icon: '👍',
    pose: {
      body_angle: 'Slight angle (15-20 degrees)',
      head_position: 'Turned toward camera with genuine smile',
      chin_technique: 'Chin slightly up for an open, positive expression',
      shoulders: 'Relaxed and open',
      weight_distribution: 'Even',
      arms: 'One arm raised with thumb up gesture, other arm relaxed at side',
      description: 'Enthusiastic and approachable pose with thumbs up gesture'
    },
    prompt_instructions: 'Subject gives a confident thumbs-up with one hand raised at chest level, thumb clearly visible and pointing upward; the other arm stays relaxed at the side with a warm genuine smile.'
  }
}

// Re-export from legacy for now to maintain compatibility
// In a future refactor, these definitions should move here fully
export function getPoseTemplate(id: string): PoseTemplate | undefined {
  // Safe access to POSE_TEMPLATES to avoid undefined errors if id is not in the record
  return POSE_TEMPLATES[id as keyof typeof POSE_TEMPLATES]
}

export function getPoseUIInfo() {
  return ALL_POSE_IDS.map(id => {
    const template = POSE_TEMPLATES[id]
    return {
      value: id,
      icon: template?.icon || '❓'
    }
  })
}

export function generatePoseInstructions(template: PoseTemplate): string {
  return template.prompt_instructions
}

import { deserialize } from './deserializer'

function isPoseType(value: unknown): value is PoseType {
  return typeof value === 'string' && (ALL_POSE_IDS as string[]).includes(value)
}

/**
 * Element registry config for pose
 */
export const poseElementConfig: ElementConfig<PoseSettings> = {
  getDefaultPredefined: () => predefined({ type: 'classic_corporate' }),
  getDefaultUserChoice: () => userChoice(),
  deserialize,
  mergePredefinedFromSession: ({ savedValue }) => {
    if (typeof savedValue !== 'object' || savedValue === null) return undefined
    const savedType = (savedValue as { type?: unknown }).type
    if (!isPoseType(savedType)) return undefined
    return predefined<PoseValue>({ type: savedType })
  },
}
