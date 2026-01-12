import { NEUTRAL_COLORS, GRADIENT_COLORS } from './colors'
import type { BackgroundEnvironment, BackgroundSettings } from './types'
import type { ElementConfig } from '../registry'
import { deserialize } from './deserializer'
import { predefined, userChoice } from '../base/element-types'

/**
 * UI metadata for background type selector
 * Icons and colors only - labels come from i18n
 */
export const BACKGROUND_TYPES = [
  { value: 'office', icon: '🏢', color: 'from-blue-500 to-indigo-500' },
  { value: 'tropical-beach', icon: '🏝️', color: 'from-cyan-500 to-teal-500' },
  { value: 'busy-city', icon: '🌆', color: 'from-purple-500 to-pink-500' },
  { value: 'neutral', icon: '⬜', color: 'from-gray-400 to-gray-500' },
  { value: 'gradient', icon: '🎨', color: 'from-orange-500 to-red-500' },
  { value: 'custom', icon: '📤', color: 'from-green-500 to-emerald-500' }
] as const

/**
 * Maps background types to their environment classification
 * Used for camera settings derivation
 */
export const BACKGROUND_ENVIRONMENT_MAP: Record<string, BackgroundEnvironment> = {
  'neutral': 'studio',
  'gradient': 'studio',
  'office': 'indoor',
  'tropical-beach': 'outdoor',
  'busy-city': 'outdoor',
  'custom': 'indoor' // Default for custom backgrounds
}

/**
 * Resolves the environment for a given background type
 */
export function getBackgroundEnvironment(backgroundType?: string): BackgroundEnvironment {
  if (!backgroundType) {
    return 'studio' // Default
  }
  return BACKGROUND_ENVIRONMENT_MAP[backgroundType] || 'studio'
}

// Re-export color palettes for backward compatibility
export { NEUTRAL_COLORS, GRADIENT_COLORS }

/**
 * Element registry config for background
 */
export const backgroundElementConfig: ElementConfig<BackgroundSettings> = {
  getDefaultPredefined: () => predefined({ type: 'office' }),
  getDefaultUserChoice: () => userChoice(),
  deserialize
}
