import type { LightingSettings } from './types'

/**
 * Generates lighting prompt payload
 */
export function generateLightingPrompt(settings: LightingSettings) {
  return {
    lighting: {
      quality: settings.quality,
      direction: settings.direction,
      setup: settings.setup,
      color_temperature: `${settings.colorTemp}K`,
      description: settings.description
    }
  }
}

