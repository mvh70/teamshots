/**
 * Industry Headshot Package
 *
 * A specialized package where the primary customization is selecting an industry.
 * All other styling (background, clothing, pose, expression) is automatically
 * derived from the industry choice.
 */

import type { PhotoStyleSettings, CategoryType } from '@/types/photo-style'
import type { ClientStylePackage } from '../types'
import { CORPORATE_HEADSHOT } from '../defaults'
import { predefined, userChoice } from '../../elements/base/element-types'
import { AVAILABLE_INDUSTRIES, type IndustryType } from './industry-config'

// Only industry is visible - all other settings are derived from industry selection
const VISIBLE_CATEGORIES: CategoryType[] = ['industry']

// Re-export for convenience
export { AVAILABLE_INDUSTRIES, type IndustryType }

/**
 * Default settings for industry-headshot package
 */
const DEFAULT_SETTINGS: PhotoStyleSettings = {
  presetId: CORPORATE_HEADSHOT.id,
  shotType: predefined({ type: 'medium-shot' }),
  subjectCount: '1',
  // Industry is user-selectable - defaults to law-firms if not set
  industry: userChoice({ type: 'law-firms' }),
  // Background, clothing, pose, expression are derived from industry in server.ts
}

export const industryHeadshot: ClientStylePackage = {
  id: 'industry-headshot',
  label: 'Industry Headshot',
  version: 1,
  visibleCategories: VISIBLE_CATEGORIES,
  compositionCategories: [],
  userStyleCategories: ['industry'],
  availableBackgrounds: ['office'],
  availablePoses: ['classic_corporate', 'slimming_three_quarter', 'power_cross', 'candid_over_shoulder'],
  availableExpressions: ['genuine_smile', 'soft_smile', 'neutral_serious'],
  availableClothingStyles: ['business', 'startup'],
  defaultSettings: DEFAULT_SETTINGS,
  defaultPresetId: CORPORATE_HEADSHOT.id,
  presets: { [CORPORATE_HEADSHOT.id]: CORPORATE_HEADSHOT },

  metadata: {
    author: 'TeamShots',
    description: 'Industry-specific professional headshots with automatic styling based on industry selection',
    capabilities: {
      supportsCustomBackgrounds: false,
      supportsCustomClothing: false,
      supportsBranding: false,
      supportedWorkflowVersions: ['v3'],
      supportsAspectRatio: false,
      supportsPose: false,
      supportsExpression: false,
    },
  },

  /**
   * Prompt builder - not used in V3 workflow but required by interface
   */
  promptBuilder: () => {
    throw new Error('promptBuilder is deprecated - use server-side buildGenerationPayload instead')
  },

  /**
   * Extract UI settings from raw style settings
   */
  extractUiSettings: (rawStyleSettings: Record<string, unknown>): PhotoStyleSettings => {
    const industry = rawStyleSettings.industry as PhotoStyleSettings['industry'] | undefined
    return {
      presetId: industryHeadshot.defaultPresetId,
      industry: industry || userChoice({ type: 'law-firms' }),
    }
  },

  /**
   * Persistence adapter for storing/loading settings
   */
  persistenceAdapter: {
    serialize: (ui: PhotoStyleSettings) => ({
      package: 'industry-headshot',
      settings: {
        // Industry is stored in ElementSetting format
        industry: ui.industry,
      },
    }),

    deserialize: (raw: Record<string, unknown>): PhotoStyleSettings => {
      const r = raw as Record<string, unknown>
      const inner = 'settings' in r ? (r.settings as Record<string, unknown>) : r

      // Handle industry in ElementSetting format or legacy string format
      let industry: PhotoStyleSettings['industry']
      if (inner.industry) {
        const rawIndustry = inner.industry as { mode?: string; value?: { type?: string } } | string
        if (typeof rawIndustry === 'string') {
          // Legacy string format
          industry = userChoice({ type: rawIndustry as IndustryType })
        } else if (rawIndustry.value?.type) {
          // ElementSetting format
          industry = rawIndustry.mode === 'predefined'
            ? predefined({ type: rawIndustry.value.type as IndustryType })
            : userChoice({ type: rawIndustry.value.type as IndustryType })
        }
      }

      return {
        presetId: industryHeadshot.defaultPresetId,
        industry: industry || userChoice({ type: 'law-firms' }),
      }
    },
  },
}

export default industryHeadshot
