import { PhotoStyleSettings, CategoryType } from '@/types/photo-style'
import type { ClientStylePackage } from '../index'
import { getDefaultPresetSettings } from '../standard-settings'
import { getValueOrDefault } from '../shared/utils'
import { CORPORATE_HEADSHOT } from '../defaults'
import * as backgroundElement from '../../elements/background'
import * as branding from '../../elements/branding'
import * as customClothing from '../../elements/custom-clothing'
import * as clothingColors from '../../elements/clothing-colors'
import * as pose from '../../elements/pose'
import * as expression from '../../elements/expression'
import * as shotType from '../../elements/shot-type'
import { predefined, userChoice, isUserChoice, hasValue } from '../../elements/base/element-types'
import type { ClothingColorValue } from '../../elements/clothing-colors/types'

const VISIBLE_CATEGORIES: CategoryType[] = [
  'background',
  'branding',
  'customClothing',
  'clothingColors',
  'pose',
  'expression',
  'shotType']

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
  'contemplative',
  'confident'
]

const OUTFIT1_PRESET = CORPORATE_HEADSHOT
const OUTFIT1_PRESET_DEFAULTS = getDefaultPresetSettings(OUTFIT1_PRESET)

const DEFAULTS = {
  ...OUTFIT1_PRESET_DEFAULTS,
  customClothing: {
    type: 'predefined' as const
  },
  clothingColors: userChoice<ClothingColorValue>(),
  shotType: predefined({ type: 'medium-close-up' as const }),
  subjectCount: '1' as const
}

export const outfit1: ClientStylePackage = {
  id: 'outfit1',
  label: 'Outfit Transfer',
  version: 1,
  visibleCategories: VISIBLE_CATEGORIES,
  compositionCategories: ['background', 'branding', 'pose', 'shotType'],
  userStyleCategories: ['customClothing', 'clothingColors', 'expression'],
  availableBackgrounds: AVAILABLE_BACKGROUNDS,
  availablePoses: AVAILABLE_POSES,
  availableExpressions: AVAILABLE_EXPRESSIONS,
  defaultSettings: DEFAULTS,
  defaultPresetId: OUTFIT1_PRESET.id,
  presets: { [OUTFIT1_PRESET.id]: OUTFIT1_PRESET },
  promptBuilder: () => {
    throw new Error('promptBuilder is deprecated - use server-side buildGenerationPayload instead')
  },
  extractUiSettings: (rawStyleSettings) => {
    // Extract UI settings from request for visible categories only
    return {
      presetId: outfit1.defaultPresetId,
      background: rawStyleSettings.background as PhotoStyleSettings['background'],
      branding: rawStyleSettings.branding as PhotoStyleSettings['branding'],
      customClothing: rawStyleSettings.customClothing as PhotoStyleSettings['customClothing'],
      clothingColors: rawStyleSettings.clothingColors as PhotoStyleSettings['clothingColors'],
      pose: rawStyleSettings.pose as PhotoStyleSettings['pose'],
      expression: rawStyleSettings.expression as PhotoStyleSettings['expression'],
      shotType: rawStyleSettings.shotType as PhotoStyleSettings['shotType'],
    }
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      package: 'outfit1',
      settings: {
        background: ui.background,
        branding: ui.branding,
        // Preserve customClothing if it exists, even if just { type: 'user-choice' } without uploaded outfit
        customClothing: ui.customClothing && typeof ui.customClothing === 'object' && 'type' in ui.customClothing
          ? ui.customClothing
          : { type: 'predefined' as const },
        clothingColors: ui.clothingColors || userChoice(),
        pose: ui.pose,
        expression: ui.expression,
        shotType: ui.shotType,
      }
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>

      // Support both old and new formats
      const inner = ('settings' in r)
        ? r.settings as Record<string, unknown>
        : r

      // Debug logging removed - using Logger instead if needed

      // Deserialize categories
      const backgroundResult = backgroundElement.deserialize(inner)
      const brandingResult = branding.deserialize(inner)
      const customClothingResult = customClothing.deserializeCustomClothing(
        typeof inner.customClothing === 'string'
          ? inner.customClothing
          : JSON.stringify(inner.customClothing || DEFAULTS.customClothing)
      )
      let clothingColorsResult = clothingColors.deserialize(inner, DEFAULTS.clothingColors)
      const poseResult = pose.deserialize(inner, DEFAULTS.pose)
      const expressionResult = expression.deserialize(inner, DEFAULTS.expression)
      const shotTypeResult = shotType.deserialize(inner, DEFAULTS.shotType)

      // Sync colors from customClothing to clothingColors if outfit has colors
      // This ensures colors show up on initial page load (server-side)
      // Merge customClothing colors into clothingColors (customClothing colors take precedence)
      if (customClothingResult.colors &&
          customClothingResult.type === 'user-choice' &&
          isUserChoice(clothingColorsResult)) {
        const outfitColors = customClothingResult.colors
        const existingColors = hasValue(clothingColorsResult) ? clothingColorsResult.value : {}

        // Merge colors: outfit colors take precedence, but keep existing ones if outfit doesn't have them
        const mergedColors = { ...existingColors }
        if (outfitColors.topLayer) mergedColors.topLayer = outfitColors.topLayer
        if (outfitColors.baseLayer) mergedColors.baseLayer = outfitColors.baseLayer
        if (outfitColors.bottom) mergedColors.bottom = outfitColors.bottom
        if (outfitColors.shoes) mergedColors.shoes = outfitColors.shoes

        // Update clothingColors with merged colors (only if we have at least one color from outfit)
        if (outfitColors.topLayer || outfitColors.bottom) {
          clothingColorsResult = userChoice(mergedColors)
        }
      }

      return {
        presetId: outfit1.defaultPresetId,
        background: backgroundResult || { type: 'user-choice' },
        branding: brandingResult,
        customClothing: customClothingResult,
        clothingColors: clothingColorsResult,
        pose: poseResult,
        expression: expressionResult,
        shotType: shotTypeResult,
      }
    }
  }
}
