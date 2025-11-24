import type { CameraSettings } from './types'

/**
 * Describes lens character based on focal length
 */
function describeLensCharacter(focalLength: number): string {
  if (focalLength <= 35) {
    return 'Wide-angle lens with expanded field of view'
  }
  if (focalLength <= 50) {
    return 'Standard lens with natural perspective'
  }
  if (focalLength <= 85) {
    return 'Portrait lens with flattering compression'
  }
  if (focalLength <= 105) {
    return 'Telephoto portrait lens with strong compression'
  }
  return 'Long telephoto lens with dramatic compression and isolation'
}

/**
 * Formats camera height as human-readable description
 */
function describeCameraHeight(height: string): string {
  const heightMap: Record<string, string> = {
    'eye_level': 'at subject eye level',
    'chest_level': 'at subject chest level',
    'waist_level': 'at subject waist level',
    'slightly_above_eye': 'slightly above subject eye level',
    'slightly_below_eye': 'slightly below subject eye level'
  }
  return heightMap[height] || 'at subject eye level'
}

/**
 * Generates camera settings prompt payload
 */
export function generateCameraSettingsPrompt(settings: CameraSettings) {
  return {
    camera: {
      lens: {
        focal_length_mm: settings.focalLength,
        character: describeLensCharacter(settings.focalLength)
      },
      settings: {
        aperture: `f/${settings.aperture.toFixed(1)}`,
        iso: settings.iso
      },
      positioning: {
        distance_from_subject_ft: settings.cameraDistance,
        subject_to_background_ft: settings.backgroundDistance,
        height: describeCameraHeight(settings.cameraHeight)
      },
      color: {
        white_balance_kelvin: settings.whiteBalance
      }
    }
  }
}

