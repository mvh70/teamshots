import { PhotoStyleSettings } from '@/types/photo-style'
import { resolveShotType } from './config'
import { hasValue } from '../base/element-types'

/**
 * Simplified shot type prompt result - only framing
 * Camera and lighting are now handled by camera-settings element
 */
export interface ShotTypePromptResult {
  framing: {
    shot_type: string
    crop_points: string
    composition: string
  }
}

/**
 * Generate shot type framing prompt
 * Simplified to only handle framing - camera settings moved to camera-settings element
 */
export function generateShotTypePrompt(settings: PhotoStyleSettings): ShotTypePromptResult {
  const shotTypeValue = hasValue(settings.shotType) ? settings.shotType.value.type : undefined
  const shotType = resolveShotType(shotTypeValue)

  return {
    framing: {
      // Store the ID (not label) so workflow can resolve it consistently for both generation and evaluation
      shot_type: shotType.id,
      crop_points: shotType.framingDescription,
      composition: shotType.compositionNotes ?? shotType.framingDescription
    }
  }
}

export function getStep1aShotTypeFramingConstraint(params: {
  bodyBoundaryInstruction?: string
  shotDescription: string
}): string {
  const framingInstruction =
    params.bodyBoundaryInstruction || `Frame as ${params.shotDescription} per JSON framing section.`
  return `1. **Framing:** ${framingInstruction}`
}

export function getStep2ShotTypeFramingConstraint(params: {
  shotType: string
  shotDescription: string
}): string {
  return `1. **Framing:** The person is already framed as ${params.shotType} (${params.shotDescription}). Maintain this exact framing and crop point; do NOT reframe.`
}
