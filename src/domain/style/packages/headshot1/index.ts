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
  'confident',
  'sad'
]

const HEADSHOT1_PRESET = CORPORATE_HEADSHOT
const HEADSHOT1_PRESET_DEFAULTS = getDefaultPresetSettings(HEADSHOT1_PRESET)

const DEFAULTS = {
  ...HEADSHOT1_PRESET_DEFAULTS,
  clothingColors: {
    type: 'predefined' as const,
    colors: {
      topBase: 'White',
      topCover: 'Dark red',
      shoes: 'brown',
      bottom: 'Gray'
    }
  },
  shotType: { type: 'medium-shot' as const },
  subjectCount: '1' as const // TODO: Should be dynamically set based on selfieKeys.length in server.ts
}

function buildPrompt(settings: PhotoStyleSettings): string {
  const context = buildStandardPrompt({
    settings,
    defaultPresetId: headshot1.defaultPresetId,
    presets: headshot1.presets || { [HEADSHOT1_PRESET.id]: HEADSHOT1_PRESET }
  })

  // Apply elements in dependency order
  shotTypeElement.applyToPayload(context)
  cameraSettings.applyToPayload(context)
  lighting.applyToPayload(context)
  pose.applyToPayload(context)
  backgroundElement.applyToPayload(context)
  clothing.applyToPayload(context)
  branding.applyToPayload(context)

  // No pose overrides in headshot1 - done

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
  promptBuilder: (settings, _ctx) => {
    void _ctx

    // Merge user settings with package defaults
    const resolvedSettings: PhotoStyleSettings = {
      presetId: settings.presetId || headshot1.defaultPresetId,
      background: getValueOrDefault(settings.background, DEFAULTS.background),
      branding: getValueOrDefault(settings.branding, DEFAULTS.branding),
      clothing: getValueOrDefault(settings.clothing, DEFAULTS.clothing),
      clothingColors: getValueOrDefault(settings.clothingColors, DEFAULTS.clothingColors),
      pose: getValueOrDefault(settings.pose, DEFAULTS.pose),
      expression: getValueOrDefault(settings.expression, DEFAULTS.expression),
      shotType: DEFAULTS.shotType, // Fixed to medium-shot for headshot1
      // Runtime context (passed in by caller, not from persisted settings)
      aspectRatio: settings.aspectRatio,
      subjectCount: settings.subjectCount,
      usageContext: settings.usageContext
    }

    return buildPrompt(resolvedSettings)
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

