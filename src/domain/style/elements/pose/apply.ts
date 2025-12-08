import { generatePosePrompt } from './prompt'
import type { PromptBuildContext } from '../../prompt-builders/context-types'
import { setPath } from '../../prompt-builders/context'
import { Logger } from '@/lib/logger'

export function applyToPayload(context: PromptBuildContext): void {
  // Debug logging to trace pose handling
  Logger.debug('Pose applyToPayload - input settings.pose:', {
    poseType: context.settings.pose?.type,
    fullPose: context.settings.pose
  })
  
  const poseResult = generatePosePrompt(context.settings)
  
  Logger.debug('Pose applyToPayload - generated result:', {
    arms: poseResult.arms,
    description: poseResult.description,
    bodyAngle: poseResult.bodyAngle
  })

  // NOTE: Expression is NOT set here - it's already set correctly in createBasePayload
  // from the user's expression selection in photo style settings. Pose should not override it.

  // Set detailed pose instructions on payload based on generatedPose results
  // This handles both template-based poses and component-based resolution
  setPath(context.payload, 'subject.pose.description', poseResult.description)
  setPath(context.payload, 'subject.pose.body_angle', poseResult.bodyAngle)
  setPath(context.payload, 'subject.pose.head_position', poseResult.headPosition)
  setPath(context.payload, 'subject.pose.chin_technique', poseResult.chinTechnique)
  setPath(context.payload, 'subject.pose.shoulder_position', poseResult.shoulderPosition)
  setPath(context.payload, 'subject.pose.weight_distribution', poseResult.weightDistribution)
  setPath(context.payload, 'subject.pose.arms', poseResult.arms)
  if (poseResult.sittingPosition) {
    setPath(context.payload, 'subject.pose.sitting_position', poseResult.sittingPosition)
  }
}
