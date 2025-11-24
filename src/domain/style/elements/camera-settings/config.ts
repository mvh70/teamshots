/**
 * Camera settings configuration constants
 * 
 * These are used by the derivation algorithm to calculate
 * optimal camera settings based on scene requirements
 */

/**
 * Default values for camera settings
 */
export const DEFAULT_CAMERA_SETTINGS = {
  FOCAL_LENGTH: 85,
  APERTURE: 4.0,
  ISO: 400,
  WHITE_BALANCE: 5500,
  CAMERA_DISTANCE: 12,
  BACKGROUND_DISTANCE: 8,
  CAMERA_HEIGHT: 'eye_level' as const
}

/**
 * Minimum and maximum values for validation
 */
export const CAMERA_LIMITS = {
  FOCAL_LENGTH: { min: 24, max: 200 },
  APERTURE: { min: 1.2, max: 22 },
  ISO: { min: 100, max: 6400 },
  WHITE_BALANCE: { min: 2500, max: 10000 },
  DISTANCE: { min: 3, max: 50 }
}

