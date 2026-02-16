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
          detailed_instructions: poseResult.detailedInstructions,
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

    return {
      payload,
      metadata,
    }
  }

  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const pose = settings.pose

    if (!pose) {
      return errors
    }

    const validPoseTypes = [
      'power_classic', 'classic_corporate', 'power_cross',
      'casual_confident', 'approachable_cross', 'approachable_lean',
      'walking_confident', 'executive_seated', 'thinker',
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
