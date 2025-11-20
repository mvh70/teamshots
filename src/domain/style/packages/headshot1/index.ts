import { PhotoStyleSettings } from '@/types/photo-style'
import type { ClientStylePackage } from '../index'
import {
  buildStandardPrompt,
  generateBackgroundPrompt,
  generateBrandingPrompt,
  generateExpressionPrompt,
  generateWardrobePrompt
} from '../../prompt-builders'
import { getDefaultPresetSettings } from '../standard-settings'
import { setPath, getValueOrDefault } from '../shared/utils'
// Import optional deserializer helpers for the categories this package exposes
import {
  deserializeBackground,
  deserializeBranding,
  deserializeClothing,
  deserializeClothingColors,
  deserializeShotType,
  deserializeExpression
} from '../shared/deserializers'

const HEADSHOT1_PRESET_ID = 'corporate-headshot' as const
const HEADSHOT1_PRESET_DEFAULTS = getDefaultPresetSettings(HEADSHOT1_PRESET_ID)

const DEFAULTS = {
  ...HEADSHOT1_PRESET_DEFAULTS,
  background: { type: 'neutral' as const, color: '#f2f2f2' },
  branding: { type: 'exclude' as const },
  clothing: { style: 'startup' as const, details: 't-shirt' },
  clothingColors: {
    type: 'predefined' as const,
    colors: {
      topBase: 'White',
      topCover: 'Dark blue',
      shoes: 'brown',
      bottom: 'Gray'
    }
  }
}

function buildPrompt(settings: PhotoStyleSettings): string {
  const {
    presetDefaults,
    effectiveSettings,
    payload
  } = buildStandardPrompt({
    settings,
    defaultPresetId: headshot1.defaultPresetId,
    presetDefaults: HEADSHOT1_PRESET_DEFAULTS
  })

  const expressionResult = generateExpressionPrompt(effectiveSettings.expression)
  const currentArmPose = (payload.subject as Record<string, unknown>)?.pose as Record<string, unknown> | undefined
  const armsPose = currentArmPose?.arms as string
  const defaultPose = {
    arms: armsPose,
    description: expressionResult.poseDescription
  }
  setPath(payload, 'subject.pose.expression', expressionResult.expression)
  setPath(payload, 'subject.pose.description', defaultPose.description)
  setPath(payload, 'subject.pose.arms', defaultPose.arms)

  const background = effectiveSettings.background
  if (background) {
    const bgPrompt = generateBackgroundPrompt(background)
    if (bgPrompt.location_type) {
      setPath(payload, 'scene.environment.location_type', bgPrompt.location_type)
    }
    if (bgPrompt.description) {
      setPath(payload, 'scene.environment.description', bgPrompt.description)
    }
    if (bgPrompt.color_palette) {
      setPath(payload, 'scene.environment.color_palette', bgPrompt.color_palette)
    }
    if (bgPrompt.branding) {
      setPath(payload, 'scene.environment.branding', bgPrompt.branding)
    }
  }

  const wardrobeResult = generateWardrobePrompt({
    clothing: effectiveSettings.clothing ?? DEFAULTS.clothing,
    clothingColors: effectiveSettings.clothingColors ?? DEFAULTS.clothingColors,
    shotType: effectiveSettings.shotType?.type ?? presetDefaults.shotType?.type
  })
  setPath(payload, 'subject.wardrobe', wardrobeResult.wardrobe)

  const brandingResult = generateBrandingPrompt({
    branding: effectiveSettings.branding,
    styleKey: wardrobeResult.styleKey,
    detailKey: wardrobeResult.detailKey,
    defaultPose
  })
  setPath(payload, 'subject.branding', brandingResult.branding)
  // Use default pose - no special branding poses in headshot1
  setPath(payload, 'subject.pose.arms', defaultPose.arms)
  setPath(payload, 'subject.pose.description', defaultPose.description)

  return JSON.stringify(payload, null, 2)
}

export const headshot1: ClientStylePackage = {
  id: 'headshot1',
  label: 'Professional Headshot',
  version: 1,
  visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'shotType', 'expression'],
  availableBackgrounds: ['office', 'tropical-beach', 'busy-city', 'neutral', 'gradient', 'custom'],
  defaultSettings: DEFAULTS,
  defaultPresetId: HEADSHOT1_PRESET_ID,
  promptBuilder: (settings, _ctx) => {
    void _ctx

    // Merge user settings with package defaults
    const resolvedSettings: PhotoStyleSettings = {
      presetId: settings.presetId || headshot1.defaultPresetId,
      background: getValueOrDefault(settings.background, DEFAULTS.background),
      branding: getValueOrDefault(settings.branding, DEFAULTS.branding),
      clothing: getValueOrDefault(settings.clothing, DEFAULTS.clothing),
      clothingColors: getValueOrDefault(settings.clothingColors, DEFAULTS.clothingColors),
      shotType: getValueOrDefault(settings.shotType, DEFAULTS.shotType),
      expression: getValueOrDefault(settings.expression, HEADSHOT1_PRESET_DEFAULTS.expression),
      // Runtime context (passed in by caller, not from persisted settings)
      aspectRatio: settings.aspectRatio,
      subjectCount: settings.subjectCount,
      usageContext: settings.usageContext
    }

    return buildPrompt(resolvedSettings)
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      packageId: 'headshot1',
      version: 1,
      presetId: ui.presetId ?? headshot1.defaultPresetId,
      background: ui.background,
      branding: ui.branding,
      clothing: ui.clothing,
      clothingColors: ui.clothingColors || { type: 'user-choice' },
      shotType: ui.shotType,
      expression: ui.expression
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>
      
      // Deserialize only the categories exposed to users via visibleCategories
      // visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'shotType', 'expression']
      // Note: aspectRatio is derived from preset/shotType, not a direct user input
      const background = deserializeBackground(r)
      const branding = deserializeBranding(r)
      const clothing = deserializeClothing(r, DEFAULTS.clothing)
      const clothingColors = deserializeClothingColors(r, DEFAULTS.clothingColors)
      const shotType = deserializeShotType(r, DEFAULTS.shotType)
      const expression = deserializeExpression(r, HEADSHOT1_PRESET_DEFAULTS.expression)

      return {
        presetId: (r.presetId as string) || headshot1.defaultPresetId,
        background: background || { type: 'user-choice' },
        branding,
        clothing,
        clothingColors,
        shotType,
        expression
      }
    }
  }
}
