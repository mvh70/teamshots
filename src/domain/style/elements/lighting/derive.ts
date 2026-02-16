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
 * Describe lighting behavior (not visible equipment) based on environment
 */
function getLightingSetup(input: LightingInput): string[] {
  const { backgroundEnvironment, backgroundModifier, subjectCount } = input

  // Studio behavior
  if (backgroundEnvironment === 'studio') {
    if (subjectCount >= 4) {
      return [
        'Primary illumination is evenly distributed across all subjects',
        'Shadows remain soft with gentle fill and low contrast',
        'Subtle edge separation keeps subjects distinct from the background'
      ]
    }
    return [
      'Primary key light is soft, broad, and wrapping from camera-left',
      'Fill light behavior keeps shadows gentle while preserving facial definition',
      "A subtle cool edge highlight separates hair and shoulders from the background"
    ]
  }

  // Outdoor behavior
  if (backgroundEnvironment === 'outdoor') {
    if (backgroundModifier === 'bright') {
      return [
        'Sunlight appears softened and controlled for comfortable contrast',
        'Shadows are lifted naturally to preserve detail in facial features',
        'Avoid harsh high-noon contrast or blown highlights'
      ]
    }
    if (backgroundModifier === 'shade') {
      return [
        'Open shade provides the primary soft directional light',
        'Subtle directional shaping maintains depth without harsh edges'
      ]
    }
    return [
      'Natural ambient daylight remains the dominant source',
      'Lighting is balanced for flattering facial contrast and clean skin tone'
    ]
  }

  // Indoor behavior
  if (backgroundEnvironment === 'indoor') {
    if (backgroundModifier === 'bright') {
      return [
        'Window-side light provides broad, soft key illumination',
        'Ambient bounce preserves shadow detail on the opposite side',
        'Directionality is clear while transitions remain soft and flattering'
      ]
    }
    return [
      'Natural window-influenced light is soft and realistic',
      'Balanced fill keeps contrast professional and controlled'
    ]
  }

  return ['Soft, balanced portrait lighting with controlled contrast']
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
    return 'Natural outdoor lighting with balanced, flattering illumination.'
  }

  if (backgroundEnvironment === 'indoor') {
    return 'Natural window light creating soft, flattering illumination with gentle shadow transitions.'
  }

  return 'Flattering professional lighting with gentle transitions and minimal harsh shadows.'
}
