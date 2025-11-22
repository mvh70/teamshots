import type { PoseSettings } from '@/types/photo-style'

export interface PoseTemplate {
  pose_id: PoseSettings['type']
  minimum_shot_type?: string
  shot_type?: string
  pose: {
    body_angle: string
    weight_distribution: string
    stance?: string
    shoulders: string
    arms: string
    hand_position?: string
    head_position: string
    chin_technique: string
    expression: string
    posture: string
    description: string
  }
  requires_arms_visible?: boolean
}

export const POSE_TEMPLATES: Record<Exclude<PoseSettings['type'], 'user-choice'>, PoseTemplate> = {
  power_classic: {
    pose_id: 'power_classic',
    minimum_shot_type: 'Medium Shot (Bust)',
    pose: {
      body_angle: '0-15° from camera, mostly square',
      weight_distribution: '50/50 even on both feet, stable',
      stance: 'Feet shoulder-width apart',
      shoulders: 'Both back and down evenly, chest open',
      arms: 'Classic power pose, hands on hips or relaxed at sides',
      head_position: 'Level, facing mostly toward camera',
      chin_technique: 'Level or slightly down for definition',
      expression: 'Confident, serious expression',
      posture: 'Tall, upright, commanding',
      description: 'Executive authority pose with classic power stance'
    },
    requires_arms_visible: true
  },
  power_crossed: {
    pose_id: 'power_crossed',
    minimum_shot_type: 'Medium Shot (Bust)',
    pose: {
      body_angle: '0-15° from camera, mostly square',
      weight_distribution: '50/50 even on both feet, stable',
      stance: 'Feet shoulder-width apart',
      shoulders: 'Both back and down evenly, chest open',
      arms: 'Crossed at mid-chest, hands tucked gently, relaxed',
      head_position: 'Level, facing mostly toward camera',
      chin_technique: 'Level or slightly down for definition',
      expression: 'Confident smile (teeth optional)',
      posture: 'Tall, upright, commanding but approachable',
      description: 'Professional authority pose with arms crossed'
    },
    requires_arms_visible: true
  },
  casual_confident: {
    pose_id: 'casual_confident',
    minimum_shot_type: 'Medium Shot (Bust)',
    pose: {
      body_angle: '25-35° from camera',
      weight_distribution: '70% on back foot, relaxed',
      stance: 'Relaxed, one foot slightly forward',
      shoulders: 'Relaxed, front shoulder dropped naturally',
      arms: 'Hands partially in pockets, thumbs visible, or one hand in pocket',
      head_position: 'Slight tilt toward raised shoulder',
      chin_technique: 'Extended forward and down for definition',
      expression: 'Warm genuine smile',
      posture: 'Tall but relaxed, approachable',
      description: 'Modern professional casual confidence'
    },
    requires_arms_visible: true
  },
  approachable_cross: {
    pose_id: 'approachable_cross',
    minimum_shot_type: 'Medium Shot (Bust)',
    pose: {
      body_angle: '25-35° from camera',
      weight_distribution: '70% on back foot, relaxed',
      stance: 'Relaxed, one foot slightly forward',
      shoulders: 'Relaxed, front shoulder dropped naturally',
      arms: 'Arms crossed loosely at mid-chest, relaxed and approachable',
      head_position: 'Slight tilt toward raised shoulder',
      chin_technique: 'Extended forward and down for definition',
      expression: 'Warm genuine smile',
      posture: 'Tall but relaxed, approachable',
      description: 'Approachable expert with relaxed crossed arms'
    },
    requires_arms_visible: true
  },
  walking_confident: {
    pose_id: 'walking_confident',
    minimum_shot_type: 'Medium Shot (Bust)',
    pose: {
      body_angle: '30-40° from camera',
      weight_distribution: '70% on back foot, dynamic',
      stance: 'Walking stance, one foot forward',
      shoulders: 'Front shoulder dropped, dynamic line',
      arms: 'Natural swing, relaxed at sides',
      head_position: 'Level, facing camera',
      chin_technique: 'Extended forward and down for definition',
      expression: 'Confident, engaged smile',
      posture: 'Dynamic, purposeful, leadership',
      description: 'Dynamic walking pose showing purposeful movement'
    },
    requires_arms_visible: true
  },
  sitting_engaged: {
    pose_id: 'sitting_engaged',
    minimum_shot_type: 'Medium Shot (Bust)',
    pose: {
      body_angle: '20-30° from camera',
      weight_distribution: 'Seated, leaning forward',
      stance: 'Seated, on edge of seat',
      shoulders: 'Front shoulder dropped, engaged',
      arms: 'Forearms on thighs or relaxed, engaged position',
      head_position: 'Slight tilt, attentive',
      chin_technique: 'Extended forward and down for definition',
      expression: 'Warm, attentive smile',
      posture: 'Upright, leaning forward, engaged',
      description: 'Seated forward-leaning engaged pose'
    },
    requires_arms_visible: true
  },
  executive_seated: {
    pose_id: 'executive_seated',
    minimum_shot_type: 'Medium Shot (Bust)',
    pose: {
      body_angle: '20-30° from camera',
      weight_distribution: 'Seated, upright',
      stance: 'Seated, upright position',
      shoulders: 'Both back and level, authoritative',
      arms: 'Hands steepled or crossed, executive position',
      head_position: 'Level, facing camera',
      chin_technique: 'Level or slightly down for definition',
      expression: 'Confident, authoritative smile',
      posture: 'Upright, commanding, executive presence',
      description: 'Seated executive authority pose'
    },
    requires_arms_visible: true
  },
  thinker: {
    pose_id: 'thinker',
    minimum_shot_type: 'Medium Shot (Bust)',
    pose: {
      body_angle: '20-30° from camera',
      weight_distribution: '70% on back foot',
      stance: 'Relaxed, contemplative',
      shoulders: 'Front shoulder dropped',
      arms: 'One hand to chin or temple, thoughtful position',
      head_position: 'Slight tilt, thoughtful',
      chin_technique: 'Extended forward and down for definition',
      expression: 'Thoughtful, contemplative expression',
      posture: 'Upright, thoughtful, strategic',
      description: 'Thoughtful strategic pose with hand to chin'
    },
    requires_arms_visible: true
  }
}

/**
 * Special pose template for jacket reveal (freepackage branding)
 * This is not a user-selectable pose, but used automatically when branding is included
 */
export const JACKET_REVEAL_POSE: PoseTemplate = {
  pose_id: 'power_crossed', // Use power_crossed as base, but override arms
  minimum_shot_type: 'Medium Shot (Bust)',
  pose: {
    body_angle: '30-40° from camera',
    weight_distribution: '70% on back foot',
    stance: 'Relaxed, dynamic',
    shoulders: 'Front shoulder dropped, asymmetrical',
    arms: 'Opening jacket to reveal logo on shirt beneath',
    hand_position: 'Both hands on jacket lapels, pulling open elegantly',
    head_position: 'Slight tilt, confident',
    chin_technique: 'Extended forward and down',
    expression: 'Confident smile, proud of brand',
    posture: 'Dynamic, engaged, showing off logo',
    description: 'Elegantly opening jacket to reveal brand logo'
  },
  requires_arms_visible: true
}

/**
 * Gets a pose template by pose type
 */
export function getPoseTemplate(poseType: PoseSettings['type']): PoseTemplate | null {
  if (poseType === 'user-choice') {
    return null
  }
  return POSE_TEMPLATES[poseType] || null
}

/**
 * Generates detailed pose instructions from a template
 */
export function generatePoseInstructions(template: PoseTemplate): string {
  const parts: string[] = []
  
  parts.push(`Body angle: ${template.pose.body_angle}`)
  parts.push(`Weight distribution: ${template.pose.weight_distribution}`)
  if (template.pose.stance) {
    parts.push(`Stance: ${template.pose.stance}`)
  }
  parts.push(`Shoulders: ${template.pose.shoulders}`)
  parts.push(`Arms: ${template.pose.arms}`)
  if (template.pose.hand_position) {
    parts.push(`Hand position: ${template.pose.hand_position}`)
  }
  parts.push(`Head position: ${template.pose.head_position}`)
  parts.push(`Chin technique: ${template.pose.chin_technique}`)
  parts.push(`Expression: ${template.pose.expression}`)
  parts.push(`Posture: ${template.pose.posture}`)
  
  return parts.join('. ')
}

