/**
 * Pose Element
 *
 * Contributes body positioning and posture rules to person generation.
 * Handles pose templates.
 */

import { StyleElement, ElementContext, ElementContribution } from '../base/StyleElement'
import { generatePosePrompt } from './prompt'
import { hasValue } from '../base/element-types'
import { autoRegisterElement } from '../composition/registry'

export class PoseElement extends StyleElement {
  readonly id = 'pose'
  readonly name = 'Pose'
  readonly description = 'Body positioning and posture'

  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    if (!settings.pose || !hasValue(settings.pose)) {
      return false
    }

    return phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const pose = settings.pose!
    const poseValue = pose.value!

    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      poseType: poseValue.type,
    }

    // Generate pose prompt result for payload
    const poseResult = generatePosePrompt(settings)

    // Build payload structure
    const payload: Record<string, unknown> = {
      subject: {
        pose: {
          description: poseResult.description,
          body_angle: poseResult.bodyAngle,
          head_position: poseResult.headPosition,
          chin_technique: poseResult.chinTechnique,
          shoulder_position: poseResult.shoulderPosition,
          weight_distribution: poseResult.weightDistribution,
          arms: poseResult.arms,
        },
      },
    }

    // Add sitting position if present
    if (poseResult.sittingPosition) {
      (payload.subject as Record<string, unknown>).pose = {
        ...(payload.subject as Record<string, unknown>).pose as Record<string, unknown>,
        sitting_position: poseResult.sittingPosition,
      }
    }

    // Add pose quality constraints
    if (poseValue.type) {
      const poseRules = this.getPoseQualityRules(poseValue.type)
      if (poseRules.length > 0) {
        mustFollow.push(...poseRules)
      }
    }

    // General pose rules
    mustFollow.push(
      'Body positioning must appear natural and comfortable',
      'Posture should be appropriate for a professional photograph',
      'All body parts must be anatomically correct and proportional'
    )

    return {
      mustFollow,
      payload,
      metadata,
    }
  }

  private getPoseQualityRules(poseType: string): string[] {
    const qualityRules: Record<string, string[]> = {
      power_classic: [
        'Must project strong, direct executive presence',
        'Posture must be confident and authoritative'
      ],
      classic_corporate: [
        'Must project a trustworthy, polished corporate presence',
        'Expression should be calm, confident, and professional'
      ],
      power_crossed: [
        'Arms must be crossed naturally without appearing defensive',
        'Must project assertive professional stance'
      ],
      power_cross: [
        'Crossed arms must appear confident rather than closed-off',
        'Overall stance should communicate authority and leadership'
      ],
      casual_confident: [
        'Must appear relaxed yet professional',
        'Posture should be modern and approachable'
      ],
      approachable_cross: [
        'Must project warmth and openness',
        'Posture should be inviting and friendly'
      ],
      approachable_lean: [
        'Forward lean must feel inviting, never aggressive',
        'Must project friendly, client-facing approachability'
      ],
      walking_confident: [
        'Movement must appear natural and fluid',
        'Must convey confidence and purpose'
      ],
      sitting_engaged: [
        'Seated posture must appear engaged and attentive',
        'Must project focus and presence'
      ],
      executive_seated: [
        'Seated posture must appear comfortable and confident',
        'Must project executive authority'
      ],
      thinker: [
        'Hand placement must appear natural, not forced',
        'Must convey thoughtfulness and intelligence'
      ],
      slimming_three_quarter: [
        'Pose must feel dynamic and flattering without exaggeration',
        'Overall look should feel editorial yet appropriate for professional profiles'
      ],
      jacket_reveal: [
        'Jacket must be partially open to reveal shirt/logo underneath',
        'Logo must remain clearly visible',
        'Pose must appear natural and professional'
      ],
      candid_over_shoulder: [
        'Over-shoulder glance must feel candid and unforced',
        'Must remain professional even with a relaxed, modern feel'
      ],
      seated_engagement: [
        'Seated posture must appear warm, attentive, and actively engaged',
        'Forward lean should create connection without appearing aggressive',
        'Must convey active listening and professional warmth'
      ],
      thumbs_up: [
        'Thumbs up gesture must appear natural and confident',
        'Must convey enthusiasm and positive energy',
        'Expression should be warm and genuine with friendly smile'
      ]
    }

    return qualityRules[poseType] || []
  }

  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const pose = settings.pose

    if (!pose) {
      return errors
    }

    const validPoseTypes = [
      'power_classic', 'classic_corporate', 'power_crossed', 'power_cross',
      'casual_confident', 'approachable_cross', 'approachable_lean',
      'walking_confident', 'sitting_engaged', 'executive_seated', 'thinker',
      'slimming_three_quarter', 'candid_over_shoulder', 'seated_engagement',
      'jacket_reveal', 'thumbs_up'
    ]

    if (hasValue(pose) && !validPoseTypes.includes(pose.value.type)) {
      errors.push(`Unknown pose type: ${pose.value.type}`)
    }

    return errors
  }

  get priority(): number {
    return 35
  }
}

export const poseElement = new PoseElement()
export default poseElement

// Auto-register on import
autoRegisterElement(poseElement)
