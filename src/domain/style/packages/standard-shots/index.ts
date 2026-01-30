/**
 * Standard Shots Package (Client-side configuration)
 *
 * Uses element-driven settings: each preset defines PhotoStyleSettings
 * that elements read and use to build prompts.
 *
 * NOTE: For server-side generation, use server.ts instead.
 */

import type { ClientStylePackage } from '../types'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { getPresetSettings, PRESET_SETTINGS } from '../../elements/preset/presets'

// Import elements for registration
import '../../elements/subject/element'
import { standardShotPresetElement } from '../../elements/composition/standard-shot/StandardShotPresetElement'

export const standardShots: ClientStylePackage = {
  id: 'standard-shots',
  label: 'Standard Professional Shots',
  version: 1,

  // Only preset selection is visible - all other settings come from preset
  visibleCategories: ['preset'],

  // Default settings (LINKEDIN_NEUTRAL_STUDIO)
  defaultSettings: {
    presetId: 'LINKEDIN_NEUTRAL_STUDIO',
    subjectCount: '1',
    ...getPresetSettings('LINKEDIN_NEUTRAL_STUDIO'),
  } as PhotoStyleSettings,

  defaultPresetId: 'LINKEDIN_NEUTRAL_STUDIO',

  // Presets map - used by UI to list available presets
  presets: Object.fromEntries(
    Object.keys(PRESET_SETTINGS).map(id => [id, {
      id,
      label: id.replace(/_/g, ' '),
      ...PRESET_SETTINGS[id],
    }])
  ),

  // Elements that contribute to this package
  requiredElements: [
    'subject',           // Identity preservation
    'standard-shot-preset', // Scene metadata only
    'pose',              // Pose from preset settings
    'expression',        // Expression from preset settings
    'lighting',          // Lighting from preset settings
    'camera-settings',   // Camera from shot type
    'shot-type',         // Shot type from preset settings
    'aspect-ratio',      // Aspect ratio from preset settings
    'background',        // Background from preset settings
    'clothing',          // Clothing from preset settings
    'filmType',          // Film type from preset settings
    'global-quality',    // Quality rules
  ],
  providedElements: [standardShotPresetElement],

  extractUiSettings: (raw: Record<string, unknown>) => {
    // The preset selector stores the preset ID inside a wrapper: { mode: '...', value: { presetId: '...' } }
    // Also check the top-level presetId field as fallback
    const presetWrapper = raw.preset as { value?: { presetId?: string } } | undefined
    const presetId = presetWrapper?.value?.presetId || (raw.presetId as string)
    return { presetId }
  },

  persistenceAdapter: {
    serialize: (ui: PhotoStyleSettings) => ({
      package: 'standard-shots',
      settings: { presetId: ui.presetId }
    }),
    deserialize: (raw: unknown) => {
      const r = raw as Record<string, unknown>
      const settings = (r.settings || r) as Record<string, unknown>
      return {
        presetId: (settings.presetId as string) || 'LINKEDIN_NEUTRAL_STUDIO'
      }
    }
  },

  promptBuilder: (settings: PhotoStyleSettings) => `Standard Shot: ${settings.presetId}`,

  metadata: {
    author: 'TeamShots',
    description: 'Proven formulas for standard professional use cases (LinkedIn, Dating, CV)',
    homepage: '',
    license: 'Proprietary',
    compatibility: {
      minVersion: '1.0.0',
      requires: [],
      optional: []
    },
    capabilities: {
      supportsCustomClothing: false,
      supportsBranding: false,
      supportsCustomBackgrounds: false,
      supportedWorkflowVersions: ['v3'],
      supportsAspectRatio: true,
      supportsPose: true,
      supportsExpression: true,
    }
  },

  async initialize() { },
  async validate() { return { valid: true, errors: [], warnings: [] } },
  onRegister() { },
  onUnregister() { },
}

export default standardShots
