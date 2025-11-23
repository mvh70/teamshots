import { PhotoStyleSettings } from '@/types/photo-style'
import {
  resolveBodyAngle,
  resolveHeadPosition,
  resolveShoulderPosition,
  resolveWeightDistribution,
  resolveArmPosition,
  resolveSittingPose,
  getExpressionLabel
} from '../elements/pose/config'
import { applyStandardPreset } from '../packages/standard-settings'
import type { StandardPresetConfig } from '../packages/standard-presets'
import { createBasePayload } from './payload'
import { generateShotTypePrompt } from '../elements/shot-type/prompt'
import { getLightingDirectionLabel } from '../elements/shot-type/config'

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
  pose: ResolvedPoseConfig
}

const resolveConfig = (settings: PhotoStyleSettings): ResolvedConfig => {
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
    pose
  }
}

const applyResolvedToPayload = (
  payload: NestedRecord,
  preset: StandardPresetConfig,
  resolved: ResolvedConfig,
  effectiveSettings: PhotoStyleSettings,
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

  // Generate shot type, camera, and lighting prompt using the new decoupled logic
  const shotTypePrompt = generateShotTypePrompt(effectiveSettings)

  setPath(payload, 'framing.shot_type', shotTypePrompt.framing.shot_type)
  setPath(payload, 'framing.crop_points', shotTypePrompt.framing.crop_points)
  setPath(payload, 'framing.composition', shotTypePrompt.framing.composition)

  setPath(payload, 'camera.lens', {
    focal_length_mm: shotTypePrompt.camera.lens.focal_length_mm,
    type: shotTypePrompt.camera.lens.type,
    character: shotTypePrompt.camera.lens.character
  })
  setPath(payload, 'camera.settings.aperture', shotTypePrompt.camera.settings.aperture)
  setPath(payload, 'camera.settings.shutter_speed', shotTypePrompt.camera.settings.shutter_speed)
  setPath(payload, 'camera.settings.iso', preset.defaults.iso ?? 100)

  setPath(payload, 'lighting.quality', shotTypePrompt.lighting.quality)
  setPath(payload, 'lighting.description', shotTypePrompt.lighting.description)
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

  // Use effectiveSettings expression (user's choice) instead of preset defaults
  const expressionLabel = getExpressionLabel(effectiveSettings.expression?.type)
  const payload = createBasePayload({
    preset,
    expressionLabel,
    lightingDirectionLabel: getLightingDirectionLabel(preset.defaults.lighting.direction)
  }) as NestedRecord

  setPath(payload, 'meta', {
    preset: preset.label
  })

  // Resolve pose using preset defaults as a base, but effective settings should be used for the full prompt generation if possible.
  // Actually, `resolveConfig` was taking `presetDefaults` in the old code.
  // But `generateShotTypePrompt` takes `effectiveSettings`.
  // Let's stick to `presetDefaults` for the `resolveConfig` call to match previous behavior for POSE if that was intended,
  // but `applyResolvedToPayload` now takes `effectiveSettings` for the shot type part.
  const presetResolved = resolveConfig(presetDefaults)
  
  // Note: We pass effectiveSettings to applyResolvedToPayload so it can generate the correct shot type prompt
  applyResolvedToPayload(payload, preset, presetResolved, effectiveSettings, expressionLabel, false)

  return {
    preset,
    presetDefaults,
    effectiveSettings,
    payload
  }
}
