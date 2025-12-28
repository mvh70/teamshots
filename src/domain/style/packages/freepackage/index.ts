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


const VISIBLE_CATEGORIES: CategoryType[] = [
  'background', 
  'branding', 
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
  //'approachable_lean',
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
  //'sad'
]

const FREE_PRESET = CORPORATE_HEADSHOT
const FREE_PRESET_DEFAULTS = getDefaultPresetSettings(FREE_PRESET)

// Package defaults - complete configuration for all categories
// Note: visibleCategories controls what users can customize, not this object
const DEFAULTS = {
  ...FREE_PRESET_DEFAULTS,
  clothingColors: {
    type: 'predefined' as const,
    colors: {
      topLayer: 'Dark blue',
      baseLayer: 'White',
      shoes: 'brown',
      bottom: 'Gray'
    }
  },
  //pose: { type: 'jacket_reveal' as const }, // Package standard (not in visibleCategories)
  shotType: { type: 'medium-shot' as const }, // Package standard (not in visibleCategories)
  subjectCount: '1' as const // TODO: Should be dynamically set based on selfieKeys.length in server.ts
}

export const freepackage: ClientStylePackage = {
  id: 'freepackage',
  label: 'Free Package',
  version: 1,
  visibleCategories: VISIBLE_CATEGORIES,
  compositionCategories: ['background', 'branding', 'pose'],
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
    // visibleCategories: ['background', 'branding', 'pose', 'clothing', 'clothingColors', 'expression']
    // Note: Non-visible categories (shotType) are NOT extracted here
    // They will be applied from package defaults during server-side generation
    return {
      presetId: freepackage.defaultPresetId,
      background: rawStyleSettings.background as PhotoStyleSettings['background'],
      branding: rawStyleSettings.branding as PhotoStyleSettings['branding'],
      pose: rawStyleSettings.pose as PhotoStyleSettings['pose'],
      clothing: rawStyleSettings.clothing as PhotoStyleSettings['clothing'],
      clothingColors: rawStyleSettings.clothingColors as PhotoStyleSettings['clothingColors'],
      expression: rawStyleSettings.expression as PhotoStyleSettings['expression'],
    }
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      package: 'freepackage',
      settings: {
        // Only serialize visible categories: ['background', 'branding', 'pose', 'clothing', 'clothingColors', 'expression']
        // Non-visible categories (shotType) are package standards and don't need to be persisted
        background: ui.background,
        branding: ui.branding,
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
      // visibleCategories: ['background', 'branding', 'pose', 'clothing', 'clothingColors', 'expression']
      const backgroundResult = backgroundElement.deserialize(inner)
      const brandingResult = branding.deserialize(inner)
      const poseResult = pose.deserialize(inner, DEFAULTS.pose)
      const clothingResult = clothing.deserialize(inner, DEFAULTS.clothing)
      const clothingColorsResult = clothingColors.deserialize(inner, DEFAULTS.clothingColors)
      const expressionResult = expression.deserialize(inner, DEFAULTS.expression)

      // Return settings with only visible categories
      // Non-visible categories (shotType) will be applied from package defaults during generation
      const settings: PhotoStyleSettings = {
        presetId: freepackage.defaultPresetId,
        background: backgroundResult || { type: 'user-choice' },
        branding: brandingResult,
        pose: poseResult,
        clothing: clothingResult,
        clothingColors: clothingColorsResult,
        expression: expressionResult,
      }
      
      return settings
    }
  }
}
