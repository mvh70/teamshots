/**
 * Lighting configuration and helpers
 * 
 * This file is reserved for future lighting-related configuration
 * such as lighting presets, equipment definitions, or constraint rules.
 */

// Placeholder for future lighting configuration

import type { ElementConfig } from '../registry'
import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Element registry config for lighting
 */
export const lightingElementConfig: ElementConfig<PhotoStyleSettings['lighting']> = {
  getDefaultPredefined: () => ({ type: 'natural' }),
  getDefaultUserChoice: () => ({ type: 'user-choice' })
}

export {}
