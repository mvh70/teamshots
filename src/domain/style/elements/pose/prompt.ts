import { PhotoStyleSettings } from '@/types/photo-style'
import { getPoseTemplate } from './config'
import { Logger } from '@/lib/logger'
import type { PoseType, PoseSettings, LegacyPoseSettings } from './types'
import { hasValue } from '../base/element-types'

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
}

// Default pose template for fallback
const DEFAULT_POSE_TYPE: PoseType = 'classic_corporate'

/**
 * Extract pose type from settings, handling both legacy and new formats
 */
function getPoseType(pose: PoseSettings | LegacyPoseSettings | undefined): PoseType {
  if (!pose) return DEFAULT_POSE_TYPE

  // New format: { mode: '...', value?: { type: '...' } }
  if ('mode' in pose) {
    const newPose = pose as PoseSettings
    if (hasValue(newPose)) {
      return newPose.value.type
    }
    return DEFAULT_POSE_TYPE
  }

  // Legacy format: { type: '...' }
  const legacyPose = pose as LegacyPoseSettings
  if (legacyPose.type === 'user-choice') {
    return DEFAULT_POSE_TYPE
  }
  return legacyPose.type
}

export const generatePosePrompt = (
  settings: Partial<PhotoStyleSettings>
): PosePromptResult => {
  const poseType = getPoseType(settings.pose as PoseSettings | LegacyPoseSettings | undefined)

  Logger.debug('generatePosePrompt - pose type:', { poseType })

  const template = getPoseTemplate(poseType)

  if (!template) {
    Logger.warn('generatePosePrompt - template not found, using default:', { poseType })
    const defaultTemplate = getPoseTemplate(DEFAULT_POSE_TYPE)!
    return {
      bodyAngle: defaultTemplate.pose.body_angle,
      headPosition: defaultTemplate.pose.head_position,
      chinTechnique: defaultTemplate.pose.chin_technique,
      shoulderPosition: defaultTemplate.pose.shoulders,
      weightDistribution: defaultTemplate.pose.weight_distribution,
      arms: defaultTemplate.pose.arms,
      description: defaultTemplate.pose.description,
      detailedInstructions: defaultTemplate.prompt_instructions
    }
  }

  return {
    bodyAngle: template.pose.body_angle,
    headPosition: template.pose.head_position,
    chinTechnique: template.pose.chin_technique,
    shoulderPosition: template.pose.shoulders,
    weightDistribution: template.pose.weight_distribution,
    arms: template.pose.arms,
    description: template.pose.description,
    detailedInstructions: template.prompt_instructions
  }
}

