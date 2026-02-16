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
      body_angle: 'Square to camera',
      head_position: 'Straight forward',
      chin_technique:
        'Chin forward and down: push the forehead slightly toward the lens to tighten the jawline.',
      shoulders: 'Even and relaxed',
      weight_distribution: 'Even on both feet',
      arms: 'Relaxed at sides',
      description: 'Trustworthy and direct standard professional headshot'
    },
    prompt_instructions:
      'Classic corporate headshot: subject stands square to camera with even, relaxed shoulders and a direct, trustworthy gaze.'
  },
  power_cross: {
    id: 'power_cross',
    icon: '💼',
    pose: {
      body_angle: 'Slight angle (10-20 degrees)',
      head_position: 'Straight to camera',
      chin_technique: 'Chin neutral or slightly lifted for confidence',
      shoulders: 'Broad and pulled back',
      weight_distribution: 'Back foot',
      arms: 'Arms crossed confidently high on the chest',
      description: 'Assertive professional stance conveying authority'
    },
    prompt_instructions:
      'Assertive professional pose with a slight angle to camera, shoulders broad and pulled back, and arms crossed confidently high on the chest.'
  },
  casual_confident: {
    id: 'casual_confident',
    icon: '😎',
    pose: {
      body_angle: 'Angled',
      head_position: 'Tilted slightly',
      chin_technique: 'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.',
      shoulders: 'One dropped',
      weight_distribution: 'Relaxed',
      arms: 'One hand in pocket',
      description: 'Relaxed, modern professional look'
    },
    prompt_instructions: 'Casual business pose, one hand in pocket, relaxed posture.'
  },
  approachable_cross: {
    id: 'approachable_cross',
    icon: '🤝',
    pose: {
      body_angle: 'Open',
      head_position: 'Friendly tilt',
      chin_technique: 'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.',
      shoulders: 'Relaxed',
      weight_distribution: 'Forward lean',
      arms: 'Loosely crossed or open',
      description: 'Friendly and open stance'
    },
    prompt_instructions: 'Warm, approachable pose, leaning slightly forward.'
  },
  approachable_lean: {
    id: 'approachable_lean',
    icon: '🙂',
    pose: {
      body_angle: 'Leaning slightly forward from the waist',
      head_position: 'Engaged, eyes slightly wider',
      chin_technique: 'Chin level, neck elongated',
      shoulders: 'Rolled slightly forward to create a connection',
      weight_distribution: 'Front foot (leaning in)',
      arms: 'Relaxed at sides or loosely clasped together at waist level',
      description:
        'Engaging and friendly posture, ideal for creative or client-facing professional roles'
    },
    prompt_instructions:
      'Approachable professional lean with a slight forward lean from the waist while standing, engaged eyes, and hands relaxed at sides or loosely clasped together at waist level. The person is STANDING, not sitting.'
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
    prompt_instructions: 'Subject walking towards camera or slightly angled, dynamic movement.'
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
      arms: 'Relaxed at sides or one hand in pocket',
      description: 'Dynamic and slimming three-quarter turn favored for LinkedIn profiles'
    },
    prompt_instructions:
      'Three-quarter slimming turn: body angled 45° away from camera, head turned back toward camera with chin slightly up and over the front shoulder for a dynamic, slimming profile-ready look.'
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
      arms: 'On armrests or lap',
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
      arms: 'Hand to chin/face',
      description: 'Thoughtful pose with hand near face'
    },
    prompt_instructions: 'Subject with hand near chin or face, thoughtful expression.'
  },
  candid_over_shoulder: {
    id: 'candid_over_shoulder',
    icon: '🧍‍♂️',
    pose: {
      body_angle: 'Turned 90 degrees away from camera',
      head_position: 'Turned completely back over the shoulder',
      chin_technique: 'Tucked slightly toward the shoulder',
      shoulders: 'Raised slightly to meet the chin line',
      weight_distribution: 'Even',
      arms: 'Relaxed/Invisible',
      description: 'Modern, relaxed candid pose looking back over the shoulder'
    },
    prompt_instructions:
      'Candid over-shoulder pose: subject turned away from camera with head turned fully back over the shoulder, creating a modern, relaxed, less rigid professional portrait.'
  },
  seated_engagement: {
    id: 'seated_engagement',
    icon: '🪑',
    pose: {
      body_angle: 'Hinged forward from hips (approx. 15 degrees)',
      head_position: 'Level and engaged, slightly pushed forward (turtle technique) to avoid neck bunching',
      chin_technique: 'Chin neutral or slightly down, eyes alert',
      shoulders: 'Relaxed down, but leaning forward to create a smaller gap between subject and lens',
      weight_distribution: 'Centered on chair, upper body weight leaning on forearms/thighs',
      arms: 'Forearms resting on thighs, hands loosely clasped',
      description: 'Warm and attentive seated pose, implying active listening across a desk',
      sitting_position:
        'Seated upright, hinged forward from hips approximately 15 degrees, weight on forearms/thighs'
    },
    prompt_instructions:
      'Seated engagement pose: subject seated, hinged forward from hips approximately 15 degrees, with forearms resting on thighs or a table surface and hands loosely clasped. Head level and engaged, slightly pushed forward (turtle technique) to avoid neck bunching. Ensure arms do not cross high enough to block any logo if branding is present. This creates a warm, attentive pose that implies active listening across a desk.'
  },
  jacket_reveal: {
    id: 'jacket_reveal',
    icon: '👔',
    pose: {
      body_angle: 'Slightly angled to camera (15-20 degrees)',
      head_position: 'Turned towards camera, chin slightly down',
      chin_technique: 'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.',
      shoulders: 'Relaxed, back straight',
      weight_distribution: 'Balanced on both feet',
      arms: 'if the subject is male, opening the jacket widely with both hands. If the subject is female, elegantly opening the jacket with both hands',
      description: 'Professional pose highlighting attire'
    },
    prompt_instructions: 'Subject is elegantly opening their jacket with both hands, opening it partially to reveal the logo on the shirt underneath. Keep the jacket partially open so the logo remains clearly visible. This creates a natural and professional look that showcases the outfit and prominently displays the branding.'
  },
  thumbs_up: {
    id: 'thumbs_up',
    icon: '👍',
    pose: {
      body_angle: 'Slight angle (15-20 degrees)',
      head_position: 'Turned towards camera with genuine smile',
      chin_technique: 'Chin slightly up for an open, positive expression',
      shoulders: 'Relaxed and open',
      weight_distribution: 'Even or slightly back',
      arms: 'One arm raised with thumb up gesture, other arm relaxed at side or hand in pocket',
      description: 'Enthusiastic and approachable pose with thumbs up gesture'
    },
    prompt_instructions: 'Subject giving a confident thumbs up gesture with one hand raised at chest or shoulder level, thumb clearly visible and pointing upward. The other arm is relaxed at their side or hand casually in pocket. Expression is warm and genuine with a friendly smile. This creates an approachable, positive, and energetic professional portrait.'
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

/**
 * Element registry config for pose
 */
export const poseElementConfig: ElementConfig<PoseSettings> = {
  getDefaultPredefined: () => predefined({ type: 'classic_corporate' }),
  getDefaultUserChoice: () => userChoice(),
  deserialize
}
