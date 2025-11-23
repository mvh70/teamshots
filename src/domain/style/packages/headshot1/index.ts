import { PhotoStyleSettings } from '@/types/photo-style'
import type { ClientStylePackage } from '../index'
import {
  buildStandardPrompt,
  generateBackgroundPrompt,
  generateBrandingPrompt,
  generateWardrobePrompt,
  generatePosePrompt
} from '../../prompt-builders'
import { resolveShotType } from '../../elements/shot-type/config'
import {
  resolveBodyAngle,
  resolveHeadPosition,
  resolveShoulderPosition,
  resolveWeightDistribution,
  resolveArmPosition,
  resolveSittingPose
} from '../../elements/pose/config'
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
  },
  pose: { type: 'user-choice' as const },
  expression: { type: 'user-choice' as const },
  shotType: { type: 'medium-shot' as const }
}

function buildPrompt(settings: PhotoStyleSettings): string {
  const {
    effectiveSettings,
    payload
  } = buildStandardPrompt({
    settings,
    defaultPresetId: headshot1.defaultPresetId,
    presetDefaults: HEADSHOT1_PRESET_DEFAULTS
  })

  // Set framing (shot type) - package decides what goes in the prompt
  const shotType = resolveShotType(effectiveSettings.shotType?.type)
  setPath(payload, 'framing.shot_type', shotType.label)
  setPath(payload, 'framing.crop_points', shotType.framingDescription)
  setPath(payload, 'framing.composition', shotType.compositionNotes ?? shotType.framingDescription)

  // Generate pose prompt - respects pose presets if selected, otherwise uses default
  const poseResult = generatePosePrompt(effectiveSettings)

  // Set expression if present (uses user's expression selection)
  if (poseResult.expression) {
    setPath(payload, 'subject.pose.expression', poseResult.expression)
  }

  // If a pose template was found (indicated by detailedInstructions), use template values
  // Otherwise, use component-based resolution
  if (poseResult.detailedInstructions) {
    // Use template-based instructions for detailed pose
    if (poseResult.description) {
      setPath(payload, 'subject.pose.description', poseResult.description)
    }
    if (poseResult.bodyAngle) {
      setPath(payload, 'subject.pose.body_angle', poseResult.bodyAngle)
    }
    if (poseResult.headPosition) {
      setPath(payload, 'subject.pose.head_position', poseResult.headPosition)
    }
    if (poseResult.shoulderPosition) {
      setPath(payload, 'subject.pose.shoulder_position', poseResult.shoulderPosition)
    }
    if (poseResult.weightDistribution) {
      setPath(payload, 'subject.pose.weight_distribution', poseResult.weightDistribution)
    }
    if (poseResult.arms) {
      setPath(payload, 'subject.pose.arms', poseResult.arms)
    }
    if (poseResult.sittingPosition) {
      setPath(payload, 'subject.pose.sitting_position', poseResult.sittingPosition)
    }
  } else {
    // Use component-based resolution when no pose template
    const bodyAngle = resolveBodyAngle(effectiveSettings.bodyAngle as string | undefined)
    const headPosition = resolveHeadPosition(effectiveSettings.headPosition as string | undefined)
    const shoulderPosition = resolveShoulderPosition(effectiveSettings.shoulderPosition as string | undefined)
    const weightDistribution = resolveWeightDistribution(effectiveSettings.weightDistribution as string | undefined)
    const armPosition = resolveArmPosition(effectiveSettings.armPosition as string | undefined)
    const sittingPose = effectiveSettings.sittingPose && effectiveSettings.sittingPose !== 'user-choice'
      ? resolveSittingPose(effectiveSettings.sittingPose as string | undefined)
      : undefined

    setPath(payload, 'subject.pose.body_angle', bodyAngle.description)
    setPath(payload, 'subject.pose.head_position', headPosition.description)
    setPath(payload, 'subject.pose.shoulder_position', shoulderPosition.description)
    setPath(payload, 'subject.pose.weight_distribution', weightDistribution.description)
    setPath(payload, 'subject.pose.arms', armPosition.description)
    if (sittingPose) {
      setPath(payload, 'subject.pose.sitting_position', sittingPose.description)
    }
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
    shotType: DEFAULTS.shotType.type // Fixed to medium-shot for headshot1
  })
  setPath(payload, 'subject.wardrobe', wardrobeResult.wardrobe)

  const brandingResult = generateBrandingPrompt({
    branding: effectiveSettings.branding,
    styleKey: wardrobeResult.styleKey,
    detailKey: wardrobeResult.detailKey,
    defaultPose: {
      arms: poseResult.arms,
      description: poseResult.description
    }
  })
  setPath(payload, 'subject.branding', brandingResult.branding)
  // Use pose from generatePosePrompt - no special branding poses in headshot1
  // (pose settings are already set by buildStandardPrompt and generatePosePrompt)

  return JSON.stringify(payload, null, 2)
}

export const headshot1: ClientStylePackage = {
  id: 'headshot1',
  label: 'Professional Headshot',
  version: 1,
  visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'pose', 'expression'],
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
  persistenceAdapter: {
    serialize: (ui) => ({
      packageId: 'headshot1',
      version: 1,
      presetId: ui.presetId ?? headshot1.defaultPresetId,
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
      const expression = deserializeExpression(r, DEFAULTS.expression)

      return {
        presetId: (r.presetId as string) || headshot1.defaultPresetId,
        background: background || { type: 'user-choice' },
        branding,
        clothing,
        clothingColors,
        pose,
        expression,
        // Include granular pose settings if present
        bodyAngle: (r.bodyAngle as PhotoStyleSettings['bodyAngle']) || undefined,
        headPosition: (r.headPosition as PhotoStyleSettings['headPosition']) || undefined,
        shoulderPosition: (r.shoulderPosition as PhotoStyleSettings['shoulderPosition']) || undefined,
        weightDistribution: (r.weightDistribution as PhotoStyleSettings['weightDistribution']) || undefined,
        armPosition: (r.armPosition as PhotoStyleSettings['armPosition']) || undefined,
        sittingPose: (r.sittingPose as PhotoStyleSettings['sittingPose']) || undefined
      }
    }
  }
}
