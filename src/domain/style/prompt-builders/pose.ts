import type { PhotoStyleSettings } from '@/types/photo-style'
import { getExpressionLabel } from '../packages/pose-presets'
import {
  resolveBodyAngle,
  resolveHeadPosition,
  resolveShoulderPosition,
  resolveWeightDistribution,
  resolveArmPosition,
  resolveSittingPose
} from '../packages/pose-presets'
import { getPoseTemplate, generatePoseInstructions } from '../packages/pose-templates'

export interface PosePromptResult {
  bodyAngle: string
  headPosition: string
  shoulderPosition: string
  weightDistribution: string
  arms: string
  sittingPosition?: string
  description: string
  expression: string
  detailedInstructions?: string
  minimumShotType?: string
  requiresArmsVisible?: boolean
}

/**
 * Generates pose prompt from pose settings.
 * If a pose preset is selected, uses the detailed pose template.
 * Otherwise, falls back to expression-based pose or individual component settings.
 */
export function generatePosePrompt(
  settings: PhotoStyleSettings
): PosePromptResult {
  const poseType = settings.pose?.type

  // If a pose preset is selected, use the detailed pose template
  if (poseType && poseType !== 'user-choice') {
    const template = getPoseTemplate(poseType)
    
    if (template) {
      // Use detailed template instructions
      const detailedInstructions = generatePoseInstructions(template)
      
      return {
        bodyAngle: template.pose.body_angle,
        headPosition: template.pose.head_position,
        shoulderPosition: template.pose.shoulders,
        weightDistribution: template.pose.weight_distribution,
        arms: template.pose.arms,
        sittingPosition: template.pose.stance?.includes('Seated') ? template.pose.stance : undefined,
        description: template.pose.description,
        expression: template.pose.expression,
        detailedInstructions,
        minimumShotType: template.minimum_shot_type || template.shot_type,
        requiresArmsVisible: template.requires_arms_visible
      }
    }
    
    // Fallback: use resolved individual components if template not found
    const bodyAngle = resolveBodyAngle(settings.bodyAngle as string | undefined)
    const headPosition = resolveHeadPosition(settings.headPosition as string | undefined)
    const shoulderPosition = resolveShoulderPosition(settings.shoulderPosition as string | undefined)
    const weightDistribution = resolveWeightDistribution(settings.weightDistribution as string | undefined)
    const armPosition = resolveArmPosition(settings.armPosition as string | undefined)
    const sittingPose = settings.sittingPose && settings.sittingPose !== 'user-choice'
      ? resolveSittingPose(settings.sittingPose as string | undefined)
      : undefined

    // Build description from pose components
    const descriptionParts: string[] = []
    descriptionParts.push(bodyAngle.description)
    if (weightDistribution.description) {
      descriptionParts.push(weightDistribution.description)
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

  // Fallback: use expression-based pose (legacy behavior)
  const expressionType = settings.expression?.type || 'professional'
  const expression = getExpressionLabel(expressionType)

  // Resolve individual components if set, otherwise use defaults
  const bodyAngle = resolveBodyAngle(settings.bodyAngle as string | undefined)
  const headPosition = resolveHeadPosition(settings.headPosition as string | undefined)
  const shoulderPosition = resolveShoulderPosition(settings.shoulderPosition as string | undefined)
  const weightDistribution = resolveWeightDistribution(settings.weightDistribution as string | undefined)
  const armPosition = resolveArmPosition(settings.armPosition as string | undefined)
  const sittingPose = settings.sittingPose && settings.sittingPose !== 'user-choice'
    ? resolveSittingPose(settings.sittingPose as string | undefined)
    : undefined

  // Build description from expression and pose components
  const descriptionParts: string[] = []
  if (armPosition.description) {
    descriptionParts.push(armPosition.description)
  }
  descriptionParts.push(`${expressionType} posture facing camera`)

  return {
    bodyAngle: bodyAngle.description,
    headPosition: headPosition.description,
    shoulderPosition: shoulderPosition.description,
    weightDistribution: weightDistribution.description,
    arms: armPosition.description,
    sittingPosition: sittingPose?.description,
    description: descriptionParts.join('. '),
    expression
  }
}

