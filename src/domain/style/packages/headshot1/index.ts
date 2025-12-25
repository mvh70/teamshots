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
  'clothing', 
  'clothingColors', 
  'pose', 
  'expression']

const AVAILABLE_BACKGROUNDS = [
  'office', 
  'tropical-beach', 
  'busy-city', 
  'neutral', 
  'gradient', 
  'custom']

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
  //'contemplative',
  //'confident'
]

const HEADSHOT1_PRESET = CORPORATE_HEADSHOT
const HEADSHOT1_PRESET_DEFAULTS = getDefaultPresetSettings(HEADSHOT1_PRESET)

const DEFAULTS = {
  ...HEADSHOT1_PRESET_DEFAULTS,
  clothingColors: {
    type: 'predefined' as const,
    colors: {
      topLayer: 'Dark red',
      baseLayer: 'White',
      shoes: 'brown',
      bottom: 'Gray'
    }
  },
  shotType: { type: 'medium-shot' as const },
  subjectCount: '1' as const // TODO: Should be dynamically set based on selfieKeys.length in server.ts
}

export const headshot1: ClientStylePackage = {
  id: 'headshot1',
  label: 'Professional Headshot',
  version: 1,
  visibleCategories: VISIBLE_CATEGORIES,
  compositionCategories: ['background', 'branding', 'pose'],
  userStyleCategories: ['clothing', 'clothingColors', 'expression'],
  availableBackgrounds: AVAILABLE_BACKGROUNDS,
  availablePoses: AVAILABLE_POSES,
  availableExpressions: AVAILABLE_EXPRESSIONS,
  defaultSettings: DEFAULTS,
  defaultPresetId: HEADSHOT1_PRESET.id,
  presets: { [HEADSHOT1_PRESET.id]: HEADSHOT1_PRESET },
  promptBuilder: () => {
    throw new Error('promptBuilder is deprecated - use server-side buildGenerationPayload instead')
  },
  extractUiSettings: (rawStyleSettings) => {
    // Extract UI settings from request for visible categories only
    // visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'pose', 'expression']
    // Note: shotType is NOT extracted here (not visible to users)
    // It will be applied from package defaults during server-side generation
    return {
      presetId: headshot1.defaultPresetId,
      background: rawStyleSettings.background as PhotoStyleSettings['background'],
      branding: rawStyleSettings.branding as PhotoStyleSettings['branding'],
      clothing: rawStyleSettings.clothing as PhotoStyleSettings['clothing'],
      clothingColors: rawStyleSettings.clothingColors as PhotoStyleSettings['clothingColors'],
      pose: rawStyleSettings.pose as PhotoStyleSettings['pose'],
      expression: rawStyleSettings.expression as PhotoStyleSettings['expression'],
    }
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      package: 'headshot1',
      settings: {
        // presetId removed - derived from package
        background: ui.background,
        branding: ui.branding,
        clothing: ui.clothing,
        clothingColors: ui.clothingColors || { type: 'user-choice' },
        pose: ui.pose, // Now includes nested granular settings
        expression: ui.expression,
      }
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>

      // Support both old and new formats
      const inner = ('settings' in r)
        ? r.settings as Record<string, unknown>
        : r

      // Deserialize only the categories exposed to users via visibleCategories
      // visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'pose', 'expression']
      // Note: aspectRatio is derived from preset/shotType, not a direct user input
      const backgroundResult = backgroundElement.deserialize(inner)
      const brandingResult = branding.deserialize(inner)
      const clothingResult = clothing.deserialize(inner, DEFAULTS.clothing)
      const clothingColorsResult = clothingColors.deserialize(inner, DEFAULTS.clothingColors)
      const poseResult = pose.deserialize(inner, DEFAULTS.pose)
      const expressionResult = expression.deserialize(inner, DEFAULTS.expression)

      return {
        presetId: headshot1.defaultPresetId, // Always derive from package
        background: backgroundResult || { type: 'user-choice' },
        branding: brandingResult,
        clothing: clothingResult,
        clothingColors: clothingColorsResult,
        pose: poseResult,
        expression: expressionResult,
      }
    }
  }
}

