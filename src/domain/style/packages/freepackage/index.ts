import { PhotoStyleSettings, CategoryType } from '@/types/photo-style'
import type { ClientStylePackage } from '../index'
import { buildStandardPrompt } from '../../prompt-builders'
import { getDefaultPresetSettings } from '../standard-settings'
import { getValueOrDefault } from '../shared/utils'
import { CORPORATE_HEADSHOT } from '../defaults'
import * as backgroundElement from '../../elements/background'
import * as branding from '../../elements/branding'
import * as clothing from '../../elements/clothing'
import * as clothingColors from '../../elements/clothing-colors'
import * as pose from '../../elements/pose'
import * as expression from '../../elements/expression'
import * as shotTypeElement from '../../elements/shot-type'
import * as cameraSettings from '../../elements/camera-settings'
import * as lighting from '../../elements/lighting'


const VISIBLE_CATEGORIES: CategoryType[] = [
  'background', 
  'branding', 
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

const DEFAULTS = {
  ...FREE_PRESET_DEFAULTS,
  clothingColors: {
    type: 'predefined' as const,
    colors: {
      topBase: 'White',
      topCover: 'Dark blue',
      shoes: 'brown',
      bottom: 'Gray'
    }
  },
  pose: { type: 'jacket_reveal' as const },
  shotType: { type: 'medium-shot' as const },
  subjectCount: '1' as const // TODO: Should be dynamically set based on selfieKeys.length in server.ts
}

function buildPrompt(settings: PhotoStyleSettings): string {
  const context = buildStandardPrompt({
    settings,
    defaultPresetId: freepackage.defaultPresetId,
    presets: freepackage.presets || { [FREE_PRESET.id]: FREE_PRESET }
  })

  // Apply elements in dependency order
  shotTypeElement.applyToPayload(context)
  cameraSettings.applyToPayload(context)
  lighting.applyToPayload(context)
  pose.applyToPayload(context)
  backgroundElement.applyToPayload(context)
  clothing.applyToPayload(context)
  branding.applyToPayload(context)

  // Build the final prompt with JSON and rules
  let prompt = JSON.stringify(context.payload, null, 2)
  
  if (context.rules.length > 0) {
    prompt += '\n\n## Rules to Follow\n\n'
    context.rules.forEach((rule, index) => {
      prompt += `${index + 1}. ${rule}\n`
    })
  }

  return prompt
}



export const freepackage: ClientStylePackage = {
  id: 'freepackage',
  label: 'Free Package',
  version: 1,
  visibleCategories: VISIBLE_CATEGORIES,
  compositionCategories: ['background', 'branding'],
  userStyleCategories: ['clothing', 'clothingColors', 'expression'],
  availableBackgrounds: AVAILABLE_BACKGROUNDS,
  availableExpressions: AVAILABLE_EXPRESSIONS,
  defaultSettings: DEFAULTS,
  defaultPresetId: FREE_PRESET.id,
  presets: { [FREE_PRESET.id]: FREE_PRESET },
  promptBuilder: (settings, _ctx) => {
    void _ctx

    // Merge user settings with package defaults
    const resolvedSettings: PhotoStyleSettings = {
      presetId: settings.presetId || freepackage.defaultPresetId,
      background: getValueOrDefault(settings.background, DEFAULTS.background),
      branding: getValueOrDefault(settings.branding, DEFAULTS.branding),
      clothing: getValueOrDefault(settings.clothing, DEFAULTS.clothing),
      clothingColors: getValueOrDefault(settings.clothingColors, DEFAULTS.clothingColors),
      pose: getValueOrDefault(settings.pose, DEFAULTS.pose),
      expression: getValueOrDefault(settings.expression, DEFAULTS.expression),
      shotType: DEFAULTS.shotType, // Fixed to medium-shot for freepackage
      // Runtime context (passed in by caller, not from persisted settings)
      aspectRatio: settings.aspectRatio,
      subjectCount: settings.subjectCount,
      usageContext: settings.usageContext
    }

    return buildPrompt(resolvedSettings)
  },
  extractUiSettings: (rawStyleSettings) => {
    // Extract UI settings from request for visible categories: background, branding, clothing, clothingColors, expression
    return {
      presetId: freepackage.defaultPresetId,
      background: rawStyleSettings.background as PhotoStyleSettings['background'],
      branding: rawStyleSettings.branding as PhotoStyleSettings['branding'],
      clothing: rawStyleSettings.clothing as PhotoStyleSettings['clothing'],
      clothingColors: rawStyleSettings.clothingColors as PhotoStyleSettings['clothingColors'],
      expression: rawStyleSettings.expression as PhotoStyleSettings['expression'],
      // Fixed settings for freepackage
      pose: DEFAULTS.pose,
      shotType: DEFAULTS.shotType,
    }
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      package: 'freepackage',
      settings: {
        // presetId removed - derived from package
        // Only serialize categories in visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'expression']
        background: ui.background,
        branding: ui.branding,
        clothing: ui.clothing,
        clothingColors: ui.clothingColors || { type: 'user-choice' },
        expression: ui.expression,
        // Note: pose is NOT in visibleCategories, so it should not be serialized
      }
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>

      // Support both old and new formats
      const inner = ('settings' in r)
        ? r.settings as Record<string, unknown>
        : r

      // Deserialize only the categories exposed to users via visibleCategories
      // visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'expression']
      // Note: pose is NOT in visibleCategories, so it should not be deserialized (use default instead)
      // Note: aspectRatio is derived from preset/shotType, not a direct user input
      const backgroundResult = backgroundElement.deserialize(inner)
      const brandingResult = branding.deserialize(inner)
      const clothingResult = clothing.deserialize(inner, DEFAULTS.clothing)
      const clothingColorsResult = clothingColors.deserialize(inner, DEFAULTS.clothingColors)
      const expressionResult = expression.deserialize(inner, DEFAULTS.expression)

      return {
        presetId: freepackage.defaultPresetId, // Always derive from package
        background: backgroundResult || { type: 'user-choice' },
        branding: brandingResult,
        clothing: clothingResult,
        clothingColors: clothingColorsResult,
        // Use default pose (not from database) since pose is not in visibleCategories
        pose: DEFAULTS.pose,
        expression: expressionResult,
      }
    }
  }
}
