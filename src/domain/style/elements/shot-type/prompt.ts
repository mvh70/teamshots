import { PhotoStyleSettings } from '@/types/photo-style'
import { resolveShotType } from './config'

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
  const shotType = resolveShotType(settings.shotType?.type)

  return {
    framing: {
      // Store the ID (not label) so workflow can resolve it consistently for both generation and evaluation
      shot_type: shotType.id,
      crop_points: shotType.framingDescription,
      composition: shotType.compositionNotes ?? shotType.framingDescription
    }
  }
}

