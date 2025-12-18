/**
 * Pose Element
 *
 * Contributes body positioning and posture rules to person generation.
 * Handles pose templates and granular pose settings (body angle, arms, weight, etc.).
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'

export class PoseElement extends StyleElement {
  readonly id = 'pose'
  readonly name = 'Pose'
  readonly description = 'Body positioning and posture'

  // Pose only affects person generation
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no pose configured
    if (!settings.pose) {
      return false
    }

    // Skip if user-choice
    if (settings.pose.type === 'user-choice') {
      return false
    }

    // Only contribute to person generation
    return phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const pose = settings.pose!

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      poseType: pose.type,
    }

    // Handle pose templates with predefined instructions
    if (pose.type && pose.type !== 'user-choice') {
      const poseInstructions = this.getPoseTemplateInstructions(pose.type)
      if (poseInstructions) {
        instructions.push(poseInstructions.mainInstruction)
        instructions.push(...poseInstructions.additionalInstructions)
        mustFollow.push(...poseInstructions.rules)
      }
    }

    // Add granular pose settings if specified
    if (pose.bodyAngle && pose.bodyAngle !== 'user-choice') {
      const angleInstructions = this.getBodyAngleInstructions(pose.bodyAngle)
      instructions.push(angleInstructions.instruction)
      mustFollow.push(angleInstructions.rule)
    }

    if (pose.headPosition && pose.headPosition !== 'user-choice') {
      const headInstructions = this.getHeadPositionInstructions(pose.headPosition)
      instructions.push(headInstructions.instruction)
      mustFollow.push(headInstructions.rule)
    }

    if (pose.shoulderPosition && pose.shoulderPosition !== 'user-choice') {
      const shoulderInstructions = this.getShoulderPositionInstructions(pose.shoulderPosition)
      instructions.push(shoulderInstructions.instruction)
      mustFollow.push(shoulderInstructions.rule)
    }

    if (pose.weightDistribution && pose.weightDistribution !== 'user-choice') {
      const weightInstructions = this.getWeightDistributionInstructions(pose.weightDistribution)
      instructions.push(weightInstructions.instruction)
      mustFollow.push(weightInstructions.rule)
    }

    if (pose.armPosition && pose.armPosition !== 'user-choice') {
      const armInstructions = this.getArmPositionInstructions(pose.armPosition)
      instructions.push(armInstructions.instruction)
      mustFollow.push(armInstructions.rule)
    }

    if (pose.sittingPose && pose.sittingPose !== 'user-choice') {
      const sittingInstructions = this.getSittingPoseInstructions(pose.sittingPose)
      instructions.push(sittingInstructions.instruction)
      mustFollow.push(sittingInstructions.rule)
    }

    // Add general pose rules
    mustFollow.push(
      'Body positioning must appear natural and comfortable',
      'Posture should be appropriate for a professional photograph',
      'All body parts must be anatomically correct and proportional'
    )

    // Always include chin technique for better jawline
    instructions.push(
      'Apply chin technique: Extend neck slightly forward, then lower chin a touch to define jawline'
    )

    return {
      instructions,
      mustFollow,
      metadata,
    }
  }

  /**
   * Get instructions for pose templates
   */
  private getPoseTemplateInstructions(poseType: string): {
    mainInstruction: string
    additionalInstructions: string[]
    rules: string[]
  } | null {
    const templates: Record<string, { mainInstruction: string; additionalInstructions: string[]; rules: string[] }> = {
      power_classic: {
        mainInstruction: 'Standard professional headshot pose, square to camera',
        additionalInstructions: [
          'Body square to camera with shoulders parallel',
          'Head level with direct gaze',
          'Shoulders squared and relaxed',
          'Arms relaxed at sides'
        ],
        rules: [
          'Must project strong, direct executive presence',
          'Posture must be confident and authoritative'
        ]
      },
      power_crossed: {
        mainInstruction: 'Subject with arms crossed, projecting confidence and authority',
        additionalInstructions: [
          'Body at slight angle to camera',
          'Head turned toward camera',
          'Arms crossed confidently',
          'Weight on back foot'
        ],
        rules: [
          'Arms must be crossed naturally without appearing defensive',
          'Must project assertive professional stance'
        ]
      },
      casual_confident: {
        mainInstruction: 'Casual business pose, one hand in pocket, relaxed posture',
        additionalInstructions: [
          'Body angled to camera',
          'One hand in pocket',
          'Head tilted slightly',
          'One shoulder dropped'
        ],
        rules: [
          'Must appear relaxed yet professional',
          'Posture should be modern and approachable'
        ]
      },
      approachable_cross: {
        mainInstruction: 'Warm, approachable pose, leaning slightly forward',
        additionalInstructions: [
          'Body open to camera',
          'Leaning forward slightly',
          'Arms loosely crossed or open',
          'Friendly head tilt'
        ],
        rules: [
          'Must project warmth and openness',
          'Posture should be inviting and friendly'
        ]
      },
      walking_confident: {
        mainInstruction: 'Subject walking towards camera or slightly angled, dynamic movement',
        additionalInstructions: [
          'Body captured in motion',
          'Arms in natural walking swing',
          'Looking forward',
          'Mid-stride positioning'
        ],
        rules: [
          'Movement must appear natural and fluid',
          'Must convey confidence and purpose'
        ]
      },
      sitting_engaged: {
        mainInstruction: 'Subject seated, leaning forward slightly, engaged and attentive',
        additionalInstructions: [
          'Seated position leaning forward',
          'Arms on knees or table',
          'Attentive head position',
          'Relaxed shoulders'
        ],
        rules: [
          'Seated posture must appear engaged and attentive',
          'Must project focus and presence'
        ]
      },
      executive_seated: {
        mainInstruction: 'Subject seated comfortably, relaxed and authoritative',
        additionalInstructions: [
          'Seated back in chair',
          'Arms on armrests or lap',
          'Relaxed head position',
          'Open shoulders'
        ],
        rules: [
          'Seated posture must appear comfortable and confident',
          'Must project executive authority'
        ]
      },
      thinker: {
        mainInstruction: 'Subject with hand near chin or face, thoughtful expression',
        additionalInstructions: [
          'Hand to chin or face area',
          'Body angled',
          'Head resting on hand',
          'Relaxed shoulders'
        ],
        rules: [
          'Hand placement must appear natural, not forced',
          'Must convey thoughtfulness and intelligence'
        ]
      },
      jacket_reveal: {
        mainInstruction: 'Subject elegantly opening jacket with both hands to reveal logo underneath',
        additionalInstructions: [
          'Opening jacket partially with both hands',
          'Body slightly angled (15-20°)',
          'Jacket kept open enough to show logo clearly',
          'Back straight, shoulders relaxed'
        ],
        rules: [
          'Jacket must be partially open to reveal shirt/logo underneath',
          'Logo must remain clearly visible',
          'Pose must appear natural and professional'
        ]
      }
    }

    return templates[poseType] || null
  }

  /**
   * Get instructions for body angle
   */
  private getBodyAngleInstructions(angle: string): { instruction: string; rule: string } {
    const angles: Record<string, { instruction: string; rule: string }> = {
      'square': {
        instruction: 'Stand square to camera with shoulders parallel',
        rule: 'Body must be directly facing camera at 0°'
      },
      'slight-angle': {
        instruction: 'Turn torso 20-30° away from camera for a slimming, polished look',
        rule: 'Body angle must be 20-30° from camera'
      },
      'angle-45': {
        instruction: 'Rotate body 45° from camera for editorial dynamic energy',
        rule: 'Body angle must be approximately 45° from camera'
      }
    }
    return angles[angle] || { instruction: 'Natural body positioning', rule: 'Body must be positioned naturally' }
  }

  /**
   * Get instructions for head position
   */
  private getHeadPositionInstructions(position: string): { instruction: string; rule: string } {
    const positions: Record<string, { instruction: string; rule: string }> = {
      'straight-level': {
        instruction: 'Keep head level with eyes directly to camera',
        rule: 'Head must be straight and level'
      },
      'slight-tilt': {
        instruction: 'Tilt head slightly (10-15°) for warmth and approachability',
        rule: 'Head tilt must be subtle and natural'
      },
      'face-turn': {
        instruction: 'Turn face 20-30° toward primary light to define jawline',
        rule: 'Face must be turned toward light source'
      }
    }
    return positions[position] || { instruction: 'Natural head positioning', rule: 'Head must be positioned naturally' }
  }

  /**
   * Get instructions for shoulder position
   */
  private getShoulderPositionInstructions(position: string): { instruction: string; rule: string } {
    const positions: Record<string, { instruction: string; rule: string }> = {
      'front-shoulder-dropped': {
        instruction: 'Lower front shoulder slightly to create flattering diagonal line',
        rule: 'Front shoulder must be slightly lower than back shoulder'
      },
      'both-relaxed': {
        instruction: 'Relax both shoulders downward to lengthen neck and remove tension',
        rule: 'Both shoulders must be relaxed and down'
      },
      'level': {
        instruction: 'Keep shoulders level for neutral formal presentation',
        rule: 'Shoulders must be level and even'
      }
    }
    return positions[position] || { instruction: 'Natural shoulder positioning', rule: 'Shoulders must be positioned naturally' }
  }

  /**
   * Get instructions for weight distribution
   */
  private getWeightDistributionInstructions(distribution: string): { instruction: string; rule: string } {
    const distributions: Record<string, { instruction: string; rule: string }> = {
      'back-foot-70': {
        instruction: 'Shift 70% of weight to back foot with front knee soft',
        rule: 'Weight must be primarily on back foot'
      },
      'even': {
        instruction: 'Distribute weight evenly on both feet for steady stance',
        rule: 'Weight must be balanced evenly'
      },
      'hip-shift': {
        instruction: 'Shift weight to one hip with front knee relaxed',
        rule: 'Hip must be shifted with relaxed stance'
      }
    }
    return distributions[distribution] || { instruction: 'Natural weight distribution', rule: 'Weight must be distributed naturally' }
  }

  /**
   * Get instructions for arm position
   */
  private getArmPositionInstructions(position: string): { instruction: string; rule: string } {
    const positions: Record<string, { instruction: string; rule: string }> = {
      'not-visible': {
        instruction: 'Arms should not be visible in frame (cropped out)',
        rule: 'Arms must be outside of frame'
      },
      'arms-crossed': {
        instruction: 'Cross arms gently with relaxed shoulders',
        rule: 'Arms must be crossed naturally without tension'
      },
      'one-hand-pocket': {
        instruction: 'Place one hand in pocket with thumb hooked',
        rule: 'One hand must be in pocket in relaxed manner'
      },
      'adjusting-jacket': {
        instruction: 'One hand adjusting lapel or cuffs with relaxed fingers',
        rule: 'Hand must be positioned naturally on jacket/cuffs'
      },
      'relaxed-sides': {
        instruction: 'Arms rest at sides with slight bend and relaxed fingers',
        rule: 'Arms must hang naturally at sides'
      }
    }
    return positions[position] || { instruction: 'Natural arm positioning', rule: 'Arms must be positioned naturally' }
  }

  /**
   * Get instructions for sitting pose
   */
  private getSittingPoseInstructions(sitting: string): { instruction: string; rule: string } {
    const sittings: Record<string, { instruction: string; rule: string }> = {
      'upright-lean-forward': {
        instruction: 'Sit tall near front of seat, leaning forward 5-10° for engagement',
        rule: 'Must be seated upright and leaning slightly forward'
      },
      'relaxed-back': {
        instruction: 'Sit back with relaxed posture, chest open',
        rule: 'Must be seated back in relaxed manner'
      },
      'perched-edge': {
        instruction: 'Sit on chair edge with energetic forward momentum',
        rule: 'Must be perched on edge of seat'
      }
    }
    return sittings[sitting] || { instruction: 'Natural seated position', rule: 'Seated posture must be natural' }
  }

  /**
   * Validate pose settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const pose = settings.pose

    if (!pose) {
      return errors
    }

    // Validate pose type
    const validPoseTypes = [
      'power_classic',
      'power_crossed',
      'casual_confident',
      'approachable_cross',
      'walking_confident',
      'sitting_engaged',
      'executive_seated',
      'thinker',
      'jacket_reveal',
      'user-choice'
    ]

    if (pose.type && !validPoseTypes.includes(pose.type)) {
      errors.push(`Unknown pose type: ${pose.type}`)
    }

    return errors
  }

  // High priority - pose is fundamental to the image
  get priority(): number {
    return 35
  }
}

// Export singleton instance
export const poseElement = new PoseElement()
export default poseElement
