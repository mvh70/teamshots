import { generatePosePrompt } from './prompt'
import type { PromptBuildContext } from '../../prompt-builders/context-types'
import { setPath } from '../../prompt-builders/context'

export function applyToPayload(context: PromptBuildContext): void {
  const poseResult = generatePosePrompt(context.settings)

  // Set expression if present (uses user's expression selection)
  if (poseResult.expression) {
    setPath(context.payload, 'subject.pose.expression', poseResult.expression)
  }

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
