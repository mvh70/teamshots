import { PhotoStyleSettings, PoseSettings } from '@/types/photo-style'
import { resolveBodyAngle, resolveHeadPosition, resolveShoulderPosition, resolveWeightDistribution, resolveArmPosition, resolveSittingPose } from './config'
import { getExpressionLabel } from '../expression/config'
import { getPoseTemplate } from './config'
import { Logger } from '@/lib/logger'

export interface PosePromptResult {
  bodyAngle: string
  headPosition: string
  chinTechnique?: string
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
  
  Logger.debug('generatePosePrompt - checking pose type:', {
    poseType,
    isUserChoice,
    willUseTemplate: poseType && !isUserChoice
  })
  
  // If a specific pose preset is selected (not user-choice), use the template
  if (poseType && !isUserChoice) {
    const template = getPoseTemplate(poseType)
    Logger.debug('generatePosePrompt - template lookup:', {
      poseType,
      templateFound: !!template,
      templateArms: template?.pose?.arms
    })
    if (template) {
      const expression = getExpressionLabel(settings.expression?.type)
      
      return {
        bodyAngle: template.pose.body_angle,
        headPosition: template.pose.head_position,
        chinTechnique: template.pose.chin_technique,
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
  // Cast to PoseSettings to access granular properties which are merged into PoseSettings type
  const granularSettings = settings.pose as PoseSettings || {}
  
  const bodyAngle = resolveBodyAngle(granularSettings.bodyAngle)
  const headPosition = resolveHeadPosition(granularSettings.headPosition)
  const shoulderPosition = resolveShoulderPosition(granularSettings.shoulderPosition)
  const weightDistribution = resolveWeightDistribution(granularSettings.weightDistribution)
  const armPosition = resolveArmPosition(granularSettings.armPosition)
  const sittingPose = granularSettings.sittingPose && granularSettings.sittingPose !== 'user-choice'
    ? resolveSittingPose(granularSettings.sittingPose)
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
    chinTechnique: 'Chin out and down: extend the neck slightly forward, then lower the chin a touch to define the jawline.',
    shoulderPosition: shoulderPosition.description,
    weightDistribution: weightDistribution.description,
    arms: armPosition.description,
    sittingPosition: sittingPose?.description,
    description: descriptionParts.join(' '),
    expression
  }
}

