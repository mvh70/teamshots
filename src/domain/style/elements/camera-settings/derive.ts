import type { CameraSettings, CameraSettingsInput, CameraHeight } from './types'

/**
 * Derives optimal camera settings based on scene requirements
 * Based on PhotoSettingsDeriver algorithm
 */
export function deriveCameraSettings(input: CameraSettingsInput): CameraSettings {
  const focalLength = getFocalLength(input)
  const aperture = getAperture(input)
  const iso = getISO(input)
  const whiteBalance = getWhiteBalance(input)
  const cameraDistance = getCameraDistance(focalLength, input.shotType)
  const backgroundDistance = getBackgroundDistance(input)
  const cameraHeight = getCameraHeight(input)

  return {
    focalLength,
    aperture,
    iso,
    whiteBalance,
    cameraDistance,
    backgroundDistance,
    cameraHeight
  }
}

/**
 * Calculate focal length based on subject count, shot type, and preset
 */
function getFocalLength(input: CameraSettingsInput): number {
  const { subjectCount, shotType, presetId } = input

  // Subject count overrides (highest priority)
  if (subjectCount >= 9) return 35
  if (subjectCount >= 4) return 50
  if (subjectCount >= 2) return 70

  // Fashion editorial override for full-length shots
  if (presetId === 'fashion-editorial' && 
      (shotType === 'full-length' || shotType === 'full-body')) {
    return 85
  }

  // Shot type defaults
  const shotTypeMap: Record<string, number> = {
    'extreme-close-up': 85,
    'close-up': 85,
    'headshot': 85,
    'medium-close-up': 85,
    'bust': 85,
    'medium-shot': 70,
    'midchest': 70,
    'three-quarter': 70,
    'full-length': 50,
    'full-body': 50,
    'wide-shot': 35,
    'environmental': 35
  }

  return shotTypeMap[shotType] || 85
}

/**
 * Calculate aperture based on subject count, shot type, and preset
 */
function getAperture(input: CameraSettingsInput): number {
  const { subjectCount, shotType, presetId } = input

  // Subject count overrides (highest priority - need deeper DOF for groups)
  if (subjectCount >= 9) return 11.0
  if (subjectCount >= 4) return 8.0
  if (subjectCount >= 2) return 5.6

  // Fashion editorial override (shallow DOF for creative look)
  if (presetId === 'fashion-editorial') return 2.0

  // Shot type defaults
  const shotTypeMap: Record<string, number> = {
    'extreme-close-up': 2.0,
    'close-up': 2.0,
    'headshot': 2.0,
    'medium-close-up': 2.0,
    'bust': 2.0,
    'medium-shot': 2.0,
    'midchest': 2.0,
    'three-quarter': 2.0,
    'full-length': 4.0,
    'full-body': 4.0,
    'wide-shot': 8.0,      // Need more DOF for wider shots
    'environmental': 5.6    // Show context but not too deep
  }

  return shotTypeMap[shotType] || 4.0
}

/**
 * Calculate ISO based on background environment and modifiers
 */
function getISO(input: CameraSettingsInput): number {
  const { backgroundEnvironment, backgroundModifier } = input

  // Studio = cleanest, lowest ISO
  if (backgroundEnvironment === 'studio') return 100

  // Outdoor
  if (backgroundEnvironment === 'outdoor') {
    if (backgroundModifier === 'bright') return 100
    if (backgroundModifier === 'shade') return 100
    return 100  // Overcast or default outdoor
  }

  // Indoor
  if (backgroundEnvironment === 'indoor') {
    if (backgroundModifier === 'bright') return 100
    if (backgroundModifier === 'dim') return 100
    return 100  // Natural light default
  }

  return 100  // Safe universal default
}

/**
 * Calculate white balance based on environment and time of day
 */
function getWhiteBalance(input: CameraSettingsInput): number {
  const { backgroundEnvironment, backgroundModifier, timeOfDay } = input

  // Studio/controlled lighting
  if (backgroundEnvironment === 'studio') return 5500

  // Time-based white balance (outdoor)
  if (timeOfDay) {
    const timeMap: Record<string, number> = {
      'sunrise': 3500,
      'morning': 5000,
      'midday': 5500,
      'afternoon': 5000,
      'golden_hour': 3500,
      'sunset': 3000,
      'blue_hour': 7000
    }
    if (timeMap[timeOfDay]) return timeMap[timeOfDay]
  }

  // Outdoor
  if (backgroundEnvironment === 'outdoor') {
    if (backgroundModifier === 'overcast') return 6500
    if (backgroundModifier === 'shade') return 7000
    return 5500  // Clear day default
  }

  // Indoor with specific lighting
  if (backgroundEnvironment === 'indoor') {
    if (backgroundModifier === 'tungsten') return 3200
    if (backgroundModifier === 'fluorescent') return 4000
    return 5000  // Natural window light
  }

  return 5500  // Daylight balanced default
}

/**
 * Calculate camera distance from subject based on focal length and shot type
 */
function getCameraDistance(focalLength: number, shotType: string): number {
  // Distance matrix: focal length → shot type → distance in feet
  const distanceMatrix: Record<number, Record<string, number>> = {
    35: {
      'wide-shot': 6,
      'environmental': 8,
      'three-quarter': 8,
      'full-length': 10,
      'full-body': 10
    },
    50: {
      'wide-shot': 8,
      'environmental': 10,
      'headshot': 6,
      'medium-close-up': 6,
      'bust': 8,
      'medium-shot': 12,
      'midchest': 10,
      'three-quarter': 12,
      'full-length': 15,
      'full-body': 15
    },
    70: {
      'wide-shot': 10,
      'environmental': 12,
      'headshot': 8,
      'medium-close-up': 8,
      'bust': 10,
      'medium-shot': 15,
      'midchest': 12,
      'three-quarter': 15,
      'full-length': 20,
      'full-body': 20
    },
    85: {
      'extreme-close-up': 10,
      'close-up': 10,
      'headshot': 10,
      'medium-close-up': 10,
      'bust': 12,
      'medium-shot': 15,
      'midchest': 12,
      'three-quarter': 15,
      'full-length': 25,
      'full-body': 25
    },
    105: {
      'close-up': 10,
      'headshot': 12,
      'medium-close-up': 12
    },
    135: {
      'close-up': 12,
      'headshot': 15,
      'full-length': 35,
      'full-body': 35
    }
  }

  const shotTypeDistances = distanceMatrix[focalLength]
  if (shotTypeDistances && shotTypeDistances[shotType]) {
    return shotTypeDistances[shotType]
  }

  // Default fallback based on focal length
  return 12
}

/**
 * Calculate background distance (subject separation) based on preset and shot type
 */
function getBackgroundDistance(input: CameraSettingsInput): number {
  const { presetId, shotType } = input

  // Fashion = maximum separation for dramatic bokeh
  if (presetId === 'fashion-editorial') return 15

  // Environmental/context-showing presets = minimal separation
  const contextualPresets = ['lifestyle-casual', 'instagram-social', 'dating-profile']
  if (presetId && contextualPresets.includes(presetId)) return 4

  // Wide/environmental shots show context
  if (shotType === 'wide-shot' || shotType === 'environmental') return 4

  // Standard professional separation
  return 8
}

/**
 * Calculate camera height based on shot type and preset
 */
function getCameraHeight(input: CameraSettingsInput): CameraHeight {
  const { shotType, presetId } = input

  // Preset overrides
  if (presetId === 'executive-portrait') return 'slightly_below_eye'

  // Shot type defaults
  const heightMap: Record<string, CameraHeight> = {
    'extreme-close-up': 'eye_level',
    'close-up': 'eye_level',
    'headshot': 'eye_level',
    'medium-close-up': 'eye_level',
    'bust': 'eye_level',
    'medium-shot': 'chest_level',
    'midchest': 'chest_level',
    'three-quarter': 'chest_level',
    'full-length': 'waist_level',
    'full-body': 'waist_level',
    'wide-shot': 'chest_level',
    'environmental': 'chest_level'
  }

  return heightMap[shotType] || 'eye_level'
}

