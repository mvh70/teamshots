import type { LightingSettings, LightingInput } from './types'

/**
 * Derives optimal lighting settings based on scene requirements
 */
export function deriveLighting(input: LightingInput): LightingSettings {
  const quality = getLightingQuality(input)
  const direction = getLightingDirection(input)
  const setup = getLightingSetup(input)
  const colorTemp = getColorTemperature(input)
  const description = getLightingDescription(input, quality)

  return {
    quality,
    direction,
    setup,
    colorTemp,
    description
  }
}

/**
 * Calculate lighting quality based on environment and conditions
 */
function getLightingQuality(input: LightingInput): string {
  const { backgroundEnvironment, backgroundModifier, timeOfDay } = input

  // Studio = controlled soft lighting
  if (backgroundEnvironment === 'studio') {
    return 'Soft Diffused'
  }

  // Outdoor lighting quality varies by conditions
  if (backgroundEnvironment === 'outdoor') {
    if (timeOfDay === 'golden_hour' || timeOfDay === 'sunset') {
      return 'Warm Golden Hour'
    }
    if (timeOfDay === 'blue_hour') {
      return 'Cool Blue Hour'
    }
    if (backgroundModifier === 'bright') {
      return 'Natural Bright'
    }
    if (backgroundModifier === 'shade') {
      return 'Soft Natural Shade'
    }
    if (backgroundModifier === 'overcast') {
      return 'Diffused Overcast'
    }
    return 'Natural Daylight'
  }

  // Indoor lighting quality
  if (backgroundEnvironment === 'indoor') {
    if (backgroundModifier === 'bright') {
      return 'Bright Window Light'
    }
    if (backgroundModifier === 'dim') {
      return 'Mixed Ambient'
    }
    return 'Natural Window Light'
  }

  return 'Soft Diffused'
}

/**
 * Calculate lighting direction based on preset and shot type
 */
function getLightingDirection(input: LightingInput): string {
  const { presetId, shotType, subjectCount } = input

  // Groups need even frontal lighting to minimize shadows on multiple faces
  if (subjectCount >= 4) {
    return 'Frontal even spread'
  }

  // Fashion editorial = dramatic lighting
  if (presetId === 'fashion-editorial') {
    return 'Overhead with side fill'
  }

  // Executive portrait = authoritative (slightly below for power)
  if (presetId === 'executive-portrait') {
    return '45° from camera right, slightly below eye level'
  }

  // Close-ups benefit from classic Rembrandt
  if (shotType === 'close-up' || shotType === 'headshot' || shotType === 'extreme-close-up') {
    return '45° above and to camera left (Rembrandt)'
  }

  // Wider shots can use loop lighting
  if (shotType === 'full-length' || shotType === 'full-body' || shotType === 'wide-shot') {
    return '30° above and to camera left (Loop lighting)'
  }

  // Default: classic portrait lighting
  return '45° above and to camera left'
}

/**
 * Calculate lighting setup/equipment based on environment
 */
function getLightingSetup(input: LightingInput): string[] {
  const { backgroundEnvironment, backgroundModifier, subjectCount } = input

  // Studio setup
  if (backgroundEnvironment === 'studio') {
    if (subjectCount >= 4) {
      return [
        'Two softboxes (3x4ft) for even coverage',
        'White reflector for fill',
        'Rim light for separation'
      ]
    }
    return [
      'Softbox (3x4ft or larger) as key light',
      'White reflector opposite for fill',
      'Optional rim light for separation'
    ]
  }

  // Outdoor setup
  if (backgroundEnvironment === 'outdoor') {
    if (backgroundModifier === 'bright') {
      return [
        'Natural sunlight diffused through clouds or scrim',
        'Large white reflector for fill',
        'Avoid harsh direct sun'
      ]
    }
    if (backgroundModifier === 'shade') {
      return [
        'Open shade as primary light source',
        'White or silver reflector for direction'
      ]
    }
    return [
      'Natural ambient light',
      'White reflector for shaping'
    ]
  }

  // Indoor setup
  if (backgroundEnvironment === 'indoor') {
    if (backgroundModifier === 'bright') {
      return [
        'Large window as key light source',
        'White reflector opposite for fill',
        'Position subject 3-6ft from window'
      ]
    }
    return [
      'Natural window light',
      'White or silver reflector for fill'
    ]
  }

  return ['Softbox (3x4ft or larger) + reflector opposite']
}

/**
 * Calculate color temperature based on environment and time of day
 */
function getColorTemperature(input: LightingInput): number {
  const { backgroundEnvironment, backgroundModifier, timeOfDay } = input

  // Studio/controlled lighting
  if (backgroundEnvironment === 'studio') {
    return 5500
  }

  // Time-based color temperature (outdoor)
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
    if (timeMap[timeOfDay]) {
      return timeMap[timeOfDay]
    }
  }

  // Outdoor
  if (backgroundEnvironment === 'outdoor') {
    if (backgroundModifier === 'overcast') return 6500
    if (backgroundModifier === 'shade') return 7000
    return 5500 // Clear day default
  }

  // Indoor with specific lighting
  if (backgroundEnvironment === 'indoor') {
    if (backgroundModifier === 'tungsten') return 3200
    if (backgroundModifier === 'fluorescent') return 4000
    return 5000 // Natural window light
  }

  return 5500 // Daylight balanced default
}

/**
 * Generate human-readable lighting description
 */
function getLightingDescription(input: LightingInput, quality: string): string {
  const { backgroundEnvironment, subjectCount } = input

  if (subjectCount >= 4) {
    return 'Even professional lighting with balanced illumination across all subjects, minimizing shadows and ensuring consistent exposure.'
  }

  if (backgroundEnvironment === 'studio') {
    return 'Flattering professional studio lighting with gentle transitions and minimal harsh shadows.'
  }

  if (backgroundEnvironment === 'outdoor') {
    if (quality === 'Warm Golden Hour' || quality === 'Cool Blue Hour') {
      return 'Natural ambient light with warm color temperature and soft directional quality ideal for portraits.'
    }
    return 'Natural outdoor lighting enhanced with reflector fill for balanced, flattering illumination.'
  }

  if (backgroundEnvironment === 'indoor') {
    return 'Natural window light with reflector fill creating soft, flattering illumination with gentle shadow transitions.'
  }

  return 'Flattering professional lighting with gentle transitions and minimal harsh shadows.'
}

