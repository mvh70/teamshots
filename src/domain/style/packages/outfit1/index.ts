import { PhotoStyleSettings, CategoryType } from '@/types/photo-style'
import type { ClientStylePackage } from '../index'
import { buildStandardPrompt } from '../../prompt-builders'
import { getDefaultPresetSettings } from '../standard-settings'
import { getValueOrDefault } from '../shared/utils'
import { CORPORATE_HEADSHOT } from '../defaults'
import * as backgroundElement from '../../elements/background'
import * as branding from '../../elements/branding'
import * as customClothing from '../../elements/custom-clothing'
import * as clothingColors from '../../elements/clothing-colors'
import * as pose from '../../elements/pose'
import * as expression from '../../elements/expression'
import * as shotTypeElement from '../../elements/shot-type'
import * as cameraSettings from '../../elements/camera-settings'
import * as lighting from '../../elements/lighting'
import * as subjectElement from '../../elements/subject'

const VISIBLE_CATEGORIES: CategoryType[] = [
  'background',
  'branding',
  'customClothing',
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
  'power_classic',
  'power_crossed',
  'casual_confident',
  'approachable_cross',
  'walking_confident',
  'sitting_engaged',
  'executive_seated',
  'thinker'
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
  clothingColors: {
    type: 'user-choice' as const
  },
  shotType: { type: 'medium-shot' as const },
  subjectCount: '1' as const
}

function buildPrompt(settings: PhotoStyleSettings): string {
  const context = buildStandardPrompt({
    settings,
    defaultPresetId: outfit1.defaultPresetId,
    presets: outfit1.presets || { [OUTFIT1_PRESET.id]: OUTFIT1_PRESET }
  })

  // Apply elements in dependency order
  shotTypeElement.applyToPayload(context)
  cameraSettings.applyToPayload(context)
  lighting.applyToPayload(context)
  pose.applyToPayload(context)
  backgroundElement.applyToPayload(context)

  // Apply custom clothing if user-choice
  if (settings.customClothing?.type === 'user-choice') {
    const customClothingPrompt = customClothing.buildCustomClothingPrompt(settings.customClothing)
    if (customClothingPrompt) {
      // Add outfit description to the subject prompt
      if (typeof context.payload.subject !== 'object' || context.payload.subject === null) {
        context.payload.subject = {}
      }
      (context.payload.subject as Record<string, unknown>).outfit = customClothingPrompt
    }
  }

  subjectElement.applyToPayload(context)
  branding.applyToPayload(context)

  // Build the final prompt with JSON only (no rules - rules are handled separately)
  return JSON.stringify(context.payload, null, 2)
}

export const outfit1: ClientStylePackage = {
  id: 'outfit1',
  label: 'Outfit Transfer',
  version: 1,
  visibleCategories: VISIBLE_CATEGORIES,
  compositionCategories: ['background', 'branding', 'pose'],
  userStyleCategories: ['customClothing', 'clothingColors', 'expression'],
  availableBackgrounds: AVAILABLE_BACKGROUNDS,
  availablePoses: AVAILABLE_POSES,
  availableExpressions: AVAILABLE_EXPRESSIONS,
  defaultSettings: DEFAULTS,
  defaultPresetId: OUTFIT1_PRESET.id,
  presets: { [OUTFIT1_PRESET.id]: OUTFIT1_PRESET },
  promptBuilder: (settings, _ctx) => {
    void _ctx

    // Merge user settings with package defaults
    const resolvedSettings: PhotoStyleSettings = {
      presetId: settings.presetId || outfit1.defaultPresetId,
      background: getValueOrDefault(settings.background, DEFAULTS.background),
      branding: getValueOrDefault(settings.branding, DEFAULTS.branding),
      customClothing: getValueOrDefault(settings.customClothing, DEFAULTS.customClothing),
      clothingColors: getValueOrDefault(settings.clothingColors, DEFAULTS.clothingColors),
      pose: getValueOrDefault(settings.pose, DEFAULTS.pose),
      expression: getValueOrDefault(settings.expression, DEFAULTS.expression),
      shotType: DEFAULTS.shotType, // Fixed to medium-shot for outfit1
      // Runtime context (passed in by caller, not from persisted settings)
      aspectRatio: settings.aspectRatio,
      subjectCount: settings.subjectCount,
      usageContext: settings.usageContext
    }

    return buildPrompt(resolvedSettings)
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
    }
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      package: 'outfit1',
      settings: {
        background: ui.background,
        branding: ui.branding,
        customClothing: ui.customClothing || { type: 'predefined' as const },
        clothingColors: ui.clothingColors || { type: 'user-choice' as const },
        pose: ui.pose,
        expression: ui.expression,
      }
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>

      // Support both old and new formats
      const inner = ('settings' in r)
        ? r.settings as Record<string, unknown>
        : r

      console.log('[outfit1.deserialize] Loading outfit1 package on page load')
      console.log('[outfit1.deserialize] inner.clothingColors:', JSON.stringify(inner.clothingColors, null, 2))

      // Deserialize categories
      const backgroundResult = backgroundElement.deserialize(inner)
      const brandingResult = branding.deserialize(inner)
      const customClothingResult = customClothing.deserializeCustomClothing(
        typeof inner.customClothing === 'string'
          ? inner.customClothing
          : JSON.stringify(inner.customClothing || DEFAULTS.customClothing)
      )
      const clothingColorsResult = clothingColors.deserialize(inner, DEFAULTS.clothingColors)
      const poseResult = pose.deserialize(inner, DEFAULTS.pose)
      const expressionResult = expression.deserialize(inner, DEFAULTS.expression)

      console.log('[outfit1.deserialize] clothingColorsResult:', JSON.stringify(clothingColorsResult, null, 2))

      return {
        presetId: outfit1.defaultPresetId,
        background: backgroundResult || { type: 'user-choice' },
        branding: brandingResult,
        customClothing: customClothingResult,
        clothingColors: clothingColorsResult,
        pose: poseResult,
        expression: expressionResult,
      }
    }
  }
}
