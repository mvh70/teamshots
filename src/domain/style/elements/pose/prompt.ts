import { PhotoStyleSettings } from '@/types/photo-style'
import { resolveBodyAngle, resolveHeadPosition, resolveShoulderPosition, resolveWeightDistribution, resolveArmPosition, resolveSittingPose } from './config'
import { getExpressionLabel } from '../expression/config'
import { getPoseTemplate } from './config'

export interface PosePromptResult {
  bodyAngle: string
  headPosition: string
  shoulderPosition: string
  weightDistribution: string
  arms: string
  sittingPosition?: string
  description?: string
  detailedInstructions?: string
  expression: string
}

export const generatePosePrompt = (
  settings: Partial<PhotoStyleSettings>
): PosePromptResult => {
  // Check if a high-level pose preset is selected
  const poseType = settings.pose?.type
  const isUserChoice = poseType === 'user-choice'
  
  // If a specific pose preset is selected (not user-choice), use the template
  if (poseType && !isUserChoice) {
    const template = getPoseTemplate(poseType)
    if (template) {
      const expression = getExpressionLabel(settings.expression?.type)
      
      return {
        bodyAngle: template.pose.body_angle,
        headPosition: template.pose.head_position,
        shoulderPosition: template.pose.shoulders,
        weightDistribution: template.pose.weight_distribution,
        arms: template.pose.arms,
        description: template.pose.description,
        detailedInstructions: template.prompt_instructions,
        expression
      }
    }
  }

  // Fallback to component-based resolution (used for 'user-choice' or individual overrides)
  const bodyAngle = resolveBodyAngle(settings.bodyAngle)
  const headPosition = resolveHeadPosition(settings.headPosition)
  const shoulderPosition = resolveShoulderPosition(settings.shoulderPosition)
  const weightDistribution = resolveWeightDistribution(settings.weightDistribution)
  const armPosition = resolveArmPosition(settings.armPosition)
  const sittingPose = settings.sittingPose && settings.sittingPose !== 'user-choice'
    ? resolveSittingPose(settings.sittingPose)
    : undefined

  const descriptionParts = [
    bodyAngle.description,
    weightDistribution.description,
    shoulderPosition.description
  ]

  if (sittingPose) {
    descriptionParts.unshift(sittingPose.description)
  }

  if (armPosition.description) {
    descriptionParts.push(armPosition.description)
  }
  if (headPosition.description) {
    descriptionParts.push(headPosition.description)
  }

  const expression = getExpressionLabel(settings.expression?.type)

  return {
    bodyAngle: bodyAngle.description,
    headPosition: headPosition.description,
    shoulderPosition: shoulderPosition.description,
    weightDistribution: weightDistribution.description,
    arms: armPosition.description,
    sittingPosition: sittingPose?.description,
    description: descriptionParts.join(' '),
    expression
  }
}

