import type { PhotoStyleSettings } from '@/types/photo-style'

import {
  resolveShotType,
  resolveFocalLength,
  resolveAperture,
  resolveLightingQuality,
  resolveShutterSpeed,
  getLightingDirectionLabel
} from '../packages/camera-presets'
import {
  resolveBodyAngle,
  resolveHeadPosition,
  resolveShoulderPosition,
  resolveWeightDistribution,
  resolveArmPosition,
  resolveSittingPose,
  getExpressionLabel
} from '../packages/pose-presets'
import { applyStandardPreset } from '../packages/standard-settings'
import type { StandardPresetConfig } from '../packages/standard-presets'
import { createBasePayload } from './payload'

export type PromptPayload = Record<string, unknown>

type NestedRecord = Record<string, unknown>

const isNestedRecord = (value: unknown): value is NestedRecord =>
  typeof value === 'object' && value !== null

const setPath = (obj: NestedRecord, path: string, value: unknown): void => {
  const segments = path.split('.')
  let current: NestedRecord = obj
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]
    const next = current[segment]
    if (!isNestedRecord(next)) {
      const child: NestedRecord = {}
      current[segment] = child
      current = child
    } else {
      current = next
    }
  }
  current[segments[segments.length - 1]] = value
}


interface ResolvedPoseConfig {
  body: ReturnType<typeof resolveBodyAngle>
  head: ReturnType<typeof resolveHeadPosition>
  shoulder: ReturnType<typeof resolveShoulderPosition>
  weight: ReturnType<typeof resolveWeightDistribution>
  arm: ReturnType<typeof resolveArmPosition>
  sitting?: ReturnType<typeof resolveSittingPose>
}

interface ResolvedConfig {
  shotType: ReturnType<typeof resolveShotType>
  focalLength: ReturnType<typeof resolveFocalLength>
  aperture: ReturnType<typeof resolveAperture>
  lighting: ReturnType<typeof resolveLightingQuality>
  shutter: ReturnType<typeof resolveShutterSpeed>
  pose: ResolvedPoseConfig
}

const resolveConfig = (settings: PhotoStyleSettings): ResolvedConfig => {
  const shotType = resolveShotType(settings.shotType?.type)
  const focalLength = resolveFocalLength(settings.focalLength as string | undefined)
  const aperture = resolveAperture(settings.aperture as string | undefined)
  const lighting = resolveLightingQuality(settings.lightingQuality as string | undefined)
  const shutter = resolveShutterSpeed(settings.shutterSpeed as string | undefined)
  const sitting =
    settings.sittingPose && settings.sittingPose !== 'user-choice'
      ? resolveSittingPose(settings.sittingPose as string | undefined)
      : undefined
  const pose: ResolvedPoseConfig = {
    body: resolveBodyAngle(settings.bodyAngle as string | undefined),
    head: resolveHeadPosition(settings.headPosition as string | undefined),
    shoulder: resolveShoulderPosition(settings.shoulderPosition as string | undefined),
    weight: resolveWeightDistribution(settings.weightDistribution as string | undefined),
    arm: resolveArmPosition(settings.armPosition as string | undefined),
    sitting
  }
  return {
    shotType,
    focalLength,
    aperture,
    lighting,
    shutter,
    pose
  }
}

const applyResolvedToPayload = (
  payload: NestedRecord,
  preset: StandardPresetConfig,
  resolved: ResolvedConfig,
  expressionLabel: string,
  skipPoseFields = false
) => {
  // Skip pose fields if a pose preset is being used (will be set by generatePosePrompt)
  if (!skipPoseFields) {
    setPath(payload, 'subject.pose.body_angle', resolved.pose.body.description)
    setPath(payload, 'subject.pose.head_position', resolved.pose.head.description)
    setPath(payload, 'subject.pose.shoulder_position', resolved.pose.shoulder.description)
    setPath(payload, 'subject.pose.weight_distribution', resolved.pose.weight.description)
    setPath(payload, 'subject.pose.arms', resolved.pose.arm.description)
    setPath(payload, 'subject.pose.sitting_position', resolved.pose.sitting?.description)
  }

  setPath(payload, 'framing.shot_type', resolved.shotType.label)
  setPath(payload, 'framing.crop_points', resolved.shotType.framingDescription)
  setPath(payload, 'framing.composition', resolved.shotType.compositionNotes ?? resolved.shotType.framingDescription)

  setPath(payload, 'camera.lens', {
    focal_length_mm: resolved.focalLength.mm,
    type: resolved.focalLength.lensType,
    character: resolved.focalLength.description
  })
  setPath(payload, 'camera.settings.aperture', resolved.aperture.value)
  setPath(payload, 'camera.settings.shutter_speed', resolved.shutter.value)
  setPath(payload, 'camera.settings.iso', preset.defaults.iso ?? 100)

  setPath(payload, 'lighting.quality', resolved.lighting.label)
  setPath(payload, 'lighting.description', resolved.lighting.description)
  setPath(payload, 'subject.pose.expression', expressionLabel)
}


export interface StandardPromptContext {
  preset: StandardPresetConfig
  presetDefaults: PhotoStyleSettings
  effectiveSettings: PhotoStyleSettings
  payload: NestedRecord
}

interface BuildStandardPromptArgs {
  settings: PhotoStyleSettings
  defaultPresetId: string
  presetDefaults: PhotoStyleSettings
}

export function buildStandardPrompt({
  settings,
  defaultPresetId,
  presetDefaults
}: BuildStandardPromptArgs): StandardPromptContext {
  const { preset, settings: effectiveSettings } = applyStandardPreset(
    settings.presetId || defaultPresetId,
    settings
  )

  const expressionLabel = getExpressionLabel(presetDefaults.expression?.type)
  const payload = createBasePayload({
    preset,
    expressionLabel,
    lightingDirectionLabel: getLightingDirectionLabel(preset.defaults.lighting.direction)
  }) as NestedRecord

  setPath(payload, 'meta', {
    preset: preset.label
  })

  const presetResolved = resolveConfig(presetDefaults)
  const hasPosePreset = effectiveSettings.pose?.type && effectiveSettings.pose.type !== 'user-choice'
  applyResolvedToPayload(payload, preset, presetResolved, expressionLabel, hasPosePreset)

  const activeResolved = resolveConfig(effectiveSettings)

  setPath(payload, 'framing.shot_type', activeResolved.shotType.label)
  setPath(payload, 'framing.crop_points', activeResolved.shotType.framingDescription)
  setPath(payload, 'framing.composition', activeResolved.shotType.compositionNotes ?? activeResolved.shotType.framingDescription)

  // Only set pose fields from resolved components if no pose preset is selected
  // Pose presets will be handled by generatePosePrompt in the package-specific buildPrompt functions
  // This prevents component-based resolution from overriding template-based pose instructions
  if (!hasPosePreset) {
    setPath(payload, 'subject.pose.body_angle', activeResolved.pose.body.description)
    setPath(payload, 'subject.pose.head_position', activeResolved.pose.head.description)
    setPath(payload, 'subject.pose.shoulder_position', activeResolved.pose.shoulder.description)
    setPath(payload, 'subject.pose.weight_distribution', activeResolved.pose.weight.description)
    setPath(payload, 'subject.pose.arms', activeResolved.pose.arm.description)
    setPath(payload, 'subject.pose.sitting_position', activeResolved.pose.sitting?.description)
  }

  return {
    preset,
    presetDefaults,
    effectiveSettings,
    payload
  }
}



