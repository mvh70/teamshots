import { PhotoStyleSettings, CategoryType } from '@/types/photo-style'
import type { ClientStylePackage } from '../index'
import { getDefaultPresetSettings } from '../standard-settings'
import { getValueOrDefault } from '../shared/utils'
import { CORPORATE_HEADSHOT } from '../defaults'
import * as backgroundElement from '../../elements/background'
import * as branding from '../../elements/branding'
import * as clothing from '../../elements/clothing'
import * as clothingColors from '../../elements/clothing-colors'
import * as pose from '../../elements/pose'
import * as expression from '../../elements/expression'

// Branding is NOT visible - it's fixed to include TeamShotsPro logo
const VISIBLE_CATEGORIES: CategoryType[] = [
  'background', 
  'pose',
  'clothing', 
  'clothingColors', 
  'expression'
]

const AVAILABLE_BACKGROUNDS = [
  'office', 
  'tropical-beach', 
  'busy-city', 
  'neutral', 
  'gradient', 
  'custom'
]

const AVAILABLE_POSES = [
  'classic_corporate',
  'slimming_three_quarter',
  'power_cross',
  'approachable_lean',
  'candid_over_shoulder',
  'seated_engagement'
]

const AVAILABLE_EXPRESSIONS = [
  'genuine_smile',
  'soft_smile',
  'neutral_serious',
  'laugh_joy',
  'contemplative',
  'confident',
  'sad'
]

const FREE_PRESET = CORPORATE_HEADSHOT
const FREE_PRESET_DEFAULTS = getDefaultPresetSettings(FREE_PRESET)

// Package defaults - branding is ALWAYS included with TeamShotsPro logo
// Note: branding is NOT in visibleCategories, so users cannot change it
const DEFAULTS = {
  ...FREE_PRESET_DEFAULTS,
  branding: {
    type: 'include' as const,
    position: 'background' as const,
    // Logo will be set server-side from brand config
  },
  clothingColors: {
    type: 'predefined' as const,
    colors: {
      topLayer: 'Dark blue',
      baseLayer: 'White',
      shoes: 'brown',
      bottom: 'Gray'
    }
  },
  shotType: { type: 'medium-shot' as const }, // Package standard (not in visibleCategories)
  subjectCount: '1' as const
}

export const tryitforfree: ClientStylePackage = {
  id: 'tryitforfree',
  label: 'Try It For Free',
  version: 1,
  visibleCategories: VISIBLE_CATEGORIES,
  compositionCategories: ['background', 'pose'], // Branding removed - it's fixed
  userStyleCategories: ['clothing', 'clothingColors', 'expression'],
  availableBackgrounds: AVAILABLE_BACKGROUNDS,
  availablePoses: AVAILABLE_POSES,
  availableExpressions: AVAILABLE_EXPRESSIONS,
  defaultSettings: DEFAULTS,
  defaultPresetId: FREE_PRESET.id,
  presets: { [FREE_PRESET.id]: FREE_PRESET },
  promptBuilder: () => {
    throw new Error('promptBuilder is deprecated - use server-side buildGenerationPayload instead')
  },
  extractUiSettings: (rawStyleSettings) => {
    // Extract UI settings from request for visible categories only
    // visibleCategories: ['background', 'pose', 'clothing', 'clothingColors', 'expression']
    // Note: Branding is NOT extracted - it's always fixed to include
    return {
      presetId: tryitforfree.defaultPresetId,
      background: rawStyleSettings.background as PhotoStyleSettings['background'],
      // Branding is NOT included - it's fixed
      pose: rawStyleSettings.pose as PhotoStyleSettings['pose'],
      clothing: rawStyleSettings.clothing as PhotoStyleSettings['clothing'],
      clothingColors: rawStyleSettings.clothingColors as PhotoStyleSettings['clothingColors'],
      expression: rawStyleSettings.expression as PhotoStyleSettings['expression'],
    }
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      package: 'tryitforfree',
      settings: {
        // Only serialize visible categories: ['background', 'pose', 'clothing', 'clothingColors', 'expression']
        // Branding is NOT serialized - it's always fixed to include TeamShotsPro logo
        background: ui.background,
        pose: ui.pose,
        clothing: ui.clothing,
        clothingColors: ui.clothingColors || { type: 'user-choice' },
        expression: ui.expression,
      }
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>

      // Support both old and new formats
      const inner = ('settings' in r)
        ? r.settings as Record<string, unknown>
        : r

      // Deserialize visible categories only
      // Branding is NOT deserialized - it's always fixed
      const backgroundResult = backgroundElement.deserialize(inner)
      const poseResult = pose.deserialize(inner, DEFAULTS.pose)
      const clothingResult = clothing.deserialize(inner, DEFAULTS.clothing)
      const clothingColorsResult = clothingColors.deserialize(inner, DEFAULTS.clothingColors)
      const expressionResult = expression.deserialize(inner, DEFAULTS.expression)

      // Return settings with only visible categories
      // Branding will be applied from package defaults during generation
      const settings: PhotoStyleSettings = {
        presetId: tryitforfree.defaultPresetId,
        background: backgroundResult || { type: 'user-choice' },
        // Branding is NOT included - it's fixed to include TeamShotsPro logo
        pose: poseResult,
        clothing: clothingResult,
        clothingColors: clothingColorsResult,
        expression: expressionResult,
      }
      
      return settings
    }
  }
}

