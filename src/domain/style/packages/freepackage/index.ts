import { PhotoStyleSettings } from '@/types/photo-style'
import type { ClientStylePackage } from '../index'
import {
  buildStandardPrompt,
  generateBackgroundPrompt,
  generateBrandingPrompt,
  generateWardrobePrompt,
  generatePosePrompt
} from '../../prompt-builders'
import { JACKET_REVEAL_POSE, generatePoseInstructions } from '../pose-templates'
import { getDefaultPresetSettings } from '../standard-settings'
import { setPath, getValueOrDefault } from '../shared/utils'
// Import optional deserializer helpers for the categories this package exposes
import {
  deserializeBackground,
  deserializeBranding,
  deserializeClothing,
  deserializeClothingColors,
  deserializePose,
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
  },
  pose: { type: 'user-choice' as const },
  shotType: { type: 'medium-shot' as const }
}

function buildPrompt(settings: PhotoStyleSettings): string {
  const {
    effectiveSettings,
    payload
  } = buildStandardPrompt({
    settings,
    defaultPresetId: freepackage.defaultPresetId,
    presetDefaults: FREE_PRESET_DEFAULTS
  })

  // Generate pose prompt - respects pose presets if selected
  const generatedPose = generatePosePrompt(effectiveSettings)
  
  // Override pose fields from buildStandardPrompt with template-based instructions
  // This ensures pose templates take precedence over component-based resolution
  setPath(payload, 'subject.pose.expression', generatedPose.expression)
  setPath(payload, 'subject.pose.description', generatedPose.description)
  setPath(payload, 'subject.pose.body_angle', generatedPose.bodyAngle)
  setPath(payload, 'subject.pose.head_position', generatedPose.headPosition)
  setPath(payload, 'subject.pose.shoulder_position', generatedPose.shoulderPosition)
  setPath(payload, 'subject.pose.weight_distribution', generatedPose.weightDistribution)
  setPath(payload, 'subject.pose.arms', generatedPose.arms)
  if (generatedPose.sittingPosition) {
    setPath(payload, 'subject.pose.sitting_position', generatedPose.sittingPosition)
  }
  
  // Store default pose for branding (may be overridden by branding logic)
  const defaultPose = {
    arms: generatedPose.arms,
    description: generatedPose.description
  }

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
    shotType: DEFAULTS.shotType.type // Fixed to medium-shot for freepackage
  })
  setPath(payload, 'subject.wardrobe', wardrobeResult.wardrobe)

  // Package-specific branding behavior: freepackage always opens jacket for clothing branding
  const brandingResult = generateBrandingPrompt({
    branding: effectiveSettings.branding,
    styleKey: wardrobeResult.styleKey,
    detailKey: wardrobeResult.detailKey,
    defaultPose
  })

  setPath(payload, 'subject.branding', brandingResult.branding)
  
  // Determine final pose: use branding-specific pose if required, otherwise use generated pose
  // Override: Force jacket-opening pose when logo is on business clothing (excluding dresses/gowns)
  const wantsClothingBranding =
    effectiveSettings.branding?.type === 'include' &&
    effectiveSettings.branding.logoKey &&
    (effectiveSettings.branding.position ?? 'clothing') === 'clothing'

  let finalPose = generatedPose
  if (
    wantsClothingBranding &&
    wardrobeResult.styleKey === 'business' &&
    wardrobeResult.detailKey !== 'dress' &&
    wardrobeResult.detailKey !== 'gown'
  ) {
    // Package-specific: Always reveal logo prominently in freepackage using jacket_reveal pose
    const jacketRevealInstructions = generatePoseInstructions(JACKET_REVEAL_POSE)
    finalPose = {
      ...generatedPose,
      bodyAngle: JACKET_REVEAL_POSE.pose.body_angle,
      headPosition: JACKET_REVEAL_POSE.pose.head_position,
      shoulderPosition: JACKET_REVEAL_POSE.pose.shoulders,
      weightDistribution: JACKET_REVEAL_POSE.pose.weight_distribution,
      arms: JACKET_REVEAL_POSE.pose.arms,
      description: JACKET_REVEAL_POSE.pose.description,
      expression: JACKET_REVEAL_POSE.pose.expression,
      detailedInstructions: jacketRevealInstructions,
      minimumShotType: JACKET_REVEAL_POSE.minimum_shot_type
    }
  }
  
  // Set detailed pose instructions on payload
  setPath(payload, 'subject.pose.body_angle', finalPose.bodyAngle)
  setPath(payload, 'subject.pose.head_position', finalPose.headPosition)
  setPath(payload, 'subject.pose.shoulder_position', finalPose.shoulderPosition)
  setPath(payload, 'subject.pose.weight_distribution', finalPose.weightDistribution)
  setPath(payload, 'subject.pose.arms', finalPose.arms)
  setPath(payload, 'subject.pose.description', finalPose.description)
  if (finalPose.minimumShotType) {
    setPath(payload, 'subject.pose.minimum_shot_type', finalPose.minimumShotType)
  }

  return JSON.stringify(payload, null, 2)
}

export const freepackage: ClientStylePackage = {
  id: 'freepackage',
  label: 'Free Package',
  version: 1,
  visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'pose', 'expression'],
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
      pose: getValueOrDefault(settings.pose, DEFAULTS.pose),
      expression: getValueOrDefault(settings.expression, FREE_PRESET_DEFAULTS.expression),
      shotType: DEFAULTS.shotType, // Fixed to medium-shot for freepackage
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
      pose: ui.pose,
      expression: ui.expression
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>
      
      // Deserialize only the categories exposed to users via visibleCategories
      // visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'pose', 'expression']
      // Note: aspectRatio is derived from preset/shotType, not a direct user input
      const background = deserializeBackground(r)
      const branding = deserializeBranding(r)
      const clothing = deserializeClothing(r, DEFAULTS.clothing)
      const clothingColors = deserializeClothingColors(r, DEFAULTS.clothingColors)
      const pose = deserializePose(r, DEFAULTS.pose)
      const expression = deserializeExpression(r, FREE_PRESET_DEFAULTS.expression)

      return {
        presetId: (r.presetId as string) || freepackage.defaultPresetId,
        background: background || { type: 'user-choice' },
        branding,
        clothing,
        clothingColors,
        pose,
        expression
      }
    }
  }
}
