import { generateShotTypePrompt } from './prompt'
import type { PromptBuildContext } from '../../prompt-builders/context-types'
import { setPath } from '../../prompt-builders/context'

/**
 * Apply shot type framing only
 * Camera settings are now handled by camera-settings element
 */
export function applyToPayload(context: PromptBuildContext): void {
  const shotTypePrompt = generateShotTypePrompt(context.settings)

  // Apply only framing information
  setPath(context.payload, 'framing.shot_type', shotTypePrompt.framing.shot_type)
  setPath(context.payload, 'framing.crop_points', shotTypePrompt.framing.crop_points)
  setPath(context.payload, 'framing.composition', shotTypePrompt.framing.composition)
}
