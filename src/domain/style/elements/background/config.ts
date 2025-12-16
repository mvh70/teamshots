import { NEUTRAL_COLORS, GRADIENT_COLORS } from './colors'
import type { BackgroundEnvironment } from './types'
import type { ElementConfig } from '../registry'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { deserialize } from './deserializer'

export const BACKGROUND_TYPES = [
  { value: 'office', label: 'Office Environment', icon: '🏢', color: 'from-blue-500 to-indigo-500' },
  { value: 'tropical-beach', label: 'Tropical Beach', icon: '🏝️', color: 'from-cyan-500 to-teal-500' },
  { value: 'busy-city', label: 'Busy City', icon: '🌆', color: 'from-purple-500 to-pink-500' },
  { value: 'neutral', label: 'Neutral Background', icon: '⬜', color: 'from-gray-400 to-gray-500' },
  { value: 'gradient', label: 'Gradient Background', icon: '🎨', color: 'from-orange-500 to-red-500' },
  { value: 'custom', label: 'Custom Upload', icon: '📤', color: 'from-green-500 to-emerald-500' }
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
  if (!backgroundType || backgroundType === 'user-choice') {
    return 'studio' // Default
  }
  return BACKGROUND_ENVIRONMENT_MAP[backgroundType] || 'studio'
}

// Re-export color palettes for backward compatibility
export { NEUTRAL_COLORS, GRADIENT_COLORS }

/**
 * Element registry config for background
 */
export const backgroundElementConfig: ElementConfig<PhotoStyleSettings['background']> = {
  getDefaultPredefined: () => ({ type: 'office' }),
  getDefaultUserChoice: () => ({ type: 'user-choice' }),
  deserialize
}
