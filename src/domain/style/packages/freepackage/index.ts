import { PhotoStyleSettings, CategoryType, BackgroundValue, ClothingValue, ClothingColorValue, ExpressionValue, PoseValue } from '@/types/photo-style'
import type { BrandingValue } from '../../elements/branding/types'
import type { ClientStylePackage } from '../index'
import * as backgroundElement from '../../elements/background'
import { deserialize as brandingDeserialize } from '../../elements/branding/deserializer'
import { deserialize as clothingDeserialize } from '../../elements/clothing/deserializer'
import * as clothingColors from '../../elements/clothing-colors'
import * as pose from '../../elements/pose'
import * as expression from '../../elements/expression'
import { predefined, userChoice } from '../../elements/base/element-types'

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
  'candid_over_shoulder',
  'seated_engagement',
]

const AVAILABLE_EXPRESSIONS = [
  'genuine_smile',
  'soft_smile',
  'neutral_serious',
  'laugh_joy',
]

const AVAILABLE_CLOTHING_STYLES = [
  'business',
  'startup'
]

// Package defaults - complete configuration for all categories
// This is the source of truth for this package - no external dependencies
//
// LIGHTING & CAMERA: Derived automatically from the user's background choice.
// See BACKGROUND_ENVIRONMENT_MAP in elements/background/config.ts for the mapping.
// Example: 'neutral' → studio environment → soft diffused lighting, 85mm portrait lens
//          'office' → indoor environment → natural window light
//          'tropical-beach' → outdoor environment → natural daylight
const DEFAULTS: PhotoStyleSettings = {
  presetId: 'corporate-headshot',
  // Visible categories - user can customize these
  background: userChoice<BackgroundValue>(),
  branding: userChoice<BrandingValue>(),
  pose: userChoice<PoseValue>({ type: 'slimming_three_quarter' }),
  clothing: userChoice<ClothingValue>(),
  clothingColors: predefined<ClothingColorValue>({
    topLayer: 'Dark blue',
    baseLayer: 'White',
    shoes: 'brown',
    bottom: 'Gray'
  }),
  expression: userChoice<ExpressionValue>({ type: 'genuine_smile' }),
  // Non-visible settings - package standards
  shotType: predefined({ type: 'medium-shot' as const }),
  filmType: predefined({ type: 'clinical-modern' }),
  aspectRatio: '1:1' as const,
  subjectCount: '1' as const
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
  availableClothingStyles: AVAILABLE_CLOTHING_STYLES,
  defaultSettings: DEFAULTS,
  defaultPresetId: 'corporate-headshot',
  presets: {},  // No preset dependency - package is self-contained
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
        clothingColors: ui.clothingColors || userChoice(),
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
      const brandingResult = brandingDeserialize(inner)
      const poseResult = pose.deserialize(inner, DEFAULTS.pose)
      const clothingResult = clothingDeserialize(inner, DEFAULTS.clothing)
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
