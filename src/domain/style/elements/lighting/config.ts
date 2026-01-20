/**
 * Lighting configuration and helpers
 * 
 * This file is reserved for future lighting-related configuration
 * such as lighting presets, equipment definitions, or constraint rules.
 */

import type { ElementConfig } from '../registry'
import type { LightingSettings, LightingType } from '@/types/photo-style'

/**
 * Default lighting settings
 */
export const DEFAULT_LIGHTING: LightingSettings = {
  mode: 'user-choice',
  value: undefined
}

/**
 * Deserialize lighting settings from stored format
 * Handles backward compatibility with old format
 */
export function deserializeLighting(raw: Record<string, unknown>): LightingSettings {
  const lighting = raw.lighting as Record<string, unknown> | undefined
  
  if (!lighting) {
    return DEFAULT_LIGHTING
  }

  // Already in new format (has mode field)
  if ('mode' in lighting && (lighting.mode === 'predefined' || lighting.mode === 'user-choice')) {
    return lighting as unknown as LightingSettings
  }

  // Migrate old format: { type: 'natural' | 'studio' | ... | 'user-choice' }
  if ('type' in lighting && typeof lighting.type === 'string') {
    const oldType = lighting.type as string
    
    // 'user-choice' in old format means user-choice mode with no value
    if (oldType === 'user-choice') {
      return { mode: 'user-choice', value: undefined }
    }
    
    // Other types become predefined mode with that type as value
    const validTypes = ['natural', 'studio', 'soft', 'dramatic']
    if (validTypes.includes(oldType)) {
      return { mode: 'predefined', value: { type: oldType as LightingType } }
    }
  }

  return DEFAULT_LIGHTING
}

/**
 * Element registry config for lighting
 * Uses the standard { mode, value } pattern
 */
export const lightingElementConfig: ElementConfig<LightingSettings> = {
  getDefaultPredefined: () => ({ mode: 'predefined', value: { type: 'natural' } }),
  getDefaultUserChoice: () => ({ mode: 'user-choice', value: undefined }),
  deserialize: deserializeLighting
}
