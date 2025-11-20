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

const FREE_PRESET_ID = 'corporate-headshot' as const
const FREE_PRESET_DEFAULTS = getDefaultPresetSettings(FREE_PRESET_ID)

const DEFAULTS = {
  ...FREE_PRESET_DEFAULTS,
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
    defaultPresetId: freepackage.defaultPresetId,
    presetDefaults: FREE_PRESET_DEFAULTS
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

  // Package-specific branding behavior: freepackage always opens jacket for clothing branding
  const brandingResult = generateBrandingPrompt({
    branding: effectiveSettings.branding,
    styleKey: wardrobeResult.styleKey,
    detailKey: wardrobeResult.detailKey,
    defaultPose
  })

  // Override: Force jacket-opening pose when logo is on business clothing (excluding dresses/gowns)
  const wantsClothingBranding =
    effectiveSettings.branding?.type === 'include' &&
    effectiveSettings.branding.logoKey &&
    (effectiveSettings.branding.position ?? 'clothing') === 'clothing'

  let poseResult = brandingResult.pose
  if (
    wantsClothingBranding &&
    wardrobeResult.styleKey === 'business' &&
    wardrobeResult.detailKey !== 'dress' &&
    wardrobeResult.detailKey !== 'gown'
  ) {
    // Package-specific: Always reveal logo prominently in freepackage
    poseResult = {
      arms: 'opening jacket to reveal logo on the base shirt',
      description: 'Subject is elegantly opening the jacket to proudly reveal the logo on the base garment beneath.'
    }
  }

  setPath(payload, 'subject.branding', brandingResult.branding)
  setPath(payload, 'subject.pose.arms', poseResult.arms)
  setPath(payload, 'subject.pose.description', poseResult.description)

  return JSON.stringify(payload, null, 2)
}

export const freepackage: ClientStylePackage = {
  id: 'freepackage',
  label: 'Free Package',
  version: 1,
  visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'shotType', 'expression'],
  availableBackgrounds: ['office', 'tropical-beach', 'busy-city', 'neutral', 'gradient', 'custom'],
  defaultSettings: DEFAULTS,
  defaultPresetId: FREE_PRESET_ID,
  promptBuilder: (settings, _ctx) => {
    void _ctx

    // Merge user settings with package defaults
    const resolvedSettings: PhotoStyleSettings = {
      presetId: settings.presetId || freepackage.defaultPresetId,
      background: getValueOrDefault(settings.background, DEFAULTS.background),
      branding: getValueOrDefault(settings.branding, DEFAULTS.branding),
      clothing: getValueOrDefault(settings.clothing, DEFAULTS.clothing),
      clothingColors: getValueOrDefault(settings.clothingColors, DEFAULTS.clothingColors),
      shotType: getValueOrDefault(settings.shotType, DEFAULTS.shotType),
      expression: getValueOrDefault(settings.expression, FREE_PRESET_DEFAULTS.expression),
      // Runtime context (passed in by caller, not from persisted settings)
      aspectRatio: settings.aspectRatio,
      subjectCount: settings.subjectCount,
      usageContext: settings.usageContext
    }

    return buildPrompt(resolvedSettings)
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      packageId: 'freepackage',
      version: 1,
      presetId: ui.presetId ?? freepackage.defaultPresetId,
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
      const expression = deserializeExpression(r, FREE_PRESET_DEFAULTS.expression)

      return {
        presetId: (r.presetId as string) || freepackage.defaultPresetId,
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
