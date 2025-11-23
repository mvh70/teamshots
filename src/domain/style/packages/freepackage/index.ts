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
import { JACKET_REVEAL_POSE, generatePoseInstructions } from '../../elements/pose/config'
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
  expression: { type: 'user-choice' as const },
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

  // Set framing (shot type) - package decides what goes in the prompt
  const shotType = resolveShotType(effectiveSettings.shotType?.type)
  setPath(payload, 'framing.shot_type', shotType.label)
  setPath(payload, 'framing.crop_points', shotType.framingDescription)
  setPath(payload, 'framing.composition', shotType.compositionNotes ?? shotType.framingDescription)

  // Generate pose prompt - respects pose presets if selected
  const generatedPose = generatePosePrompt(effectiveSettings)
  
  // Set expression if present
  if (generatedPose.expression) {
    setPath(payload, 'subject.pose.expression', generatedPose.expression)
  }

  // If a pose template was found, use template values; otherwise use component-based resolution
  if (generatedPose.detailedInstructions) {
    // Use template-based instructions
    if (generatedPose.description) {
      setPath(payload, 'subject.pose.description', generatedPose.description)
    }
    if (generatedPose.bodyAngle) {
      setPath(payload, 'subject.pose.body_angle', generatedPose.bodyAngle)
    }
    if (generatedPose.headPosition) {
      setPath(payload, 'subject.pose.head_position', generatedPose.headPosition)
    }
    if (generatedPose.shoulderPosition) {
      setPath(payload, 'subject.pose.shoulder_position', generatedPose.shoulderPosition)
    }
    if (generatedPose.weightDistribution) {
      setPath(payload, 'subject.pose.weight_distribution', generatedPose.weightDistribution)
    }
    if (generatedPose.arms) {
      setPath(payload, 'subject.pose.arms', generatedPose.arms)
    }
    if (generatedPose.sittingPosition) {
      setPath(payload, 'subject.pose.sitting_position', generatedPose.sittingPosition)
    }
  } else {
    // Use component-based resolution
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
  
  // Store default pose for branding (may be overridden by branding logic)
  const defaultPose = {
    arms: generatedPose.arms ?? 'relaxed',
    description: generatedPose.description ?? 'natural'
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
      detailedInstructions: jacketRevealInstructions,
    }
  }
  
  // Set detailed pose instructions on payload
  setPath(payload, 'subject.pose.body_angle', finalPose.bodyAngle)
  setPath(payload, 'subject.pose.head_position', finalPose.headPosition)
  setPath(payload, 'subject.pose.shoulder_position', finalPose.shoulderPosition)
  setPath(payload, 'subject.pose.weight_distribution', finalPose.weightDistribution)
  setPath(payload, 'subject.pose.arms', finalPose.arms)
  setPath(payload, 'subject.pose.description', finalPose.description)

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
      expression: getValueOrDefault(settings.expression, DEFAULTS.expression),
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
      const expression = deserializeExpression(r, DEFAULTS.expression)

      return {
        presetId: (r.presetId as string) || freepackage.defaultPresetId,
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
