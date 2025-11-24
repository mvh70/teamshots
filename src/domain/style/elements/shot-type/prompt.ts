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
      shot_type: shotType.label,
      crop_points: shotType.framingDescription,
      composition: shotType.compositionNotes ?? shotType.framingDescription
    }
  }
}

