import { PhotoStyleSettings } from '@/types/photo-style'
import { StandardPresetConfig, getStandardPreset } from './standard-presets'
import { shotTypeSuggestedAspectRatio } from '../elements/shot-type/config'

function cloneSettings(settings: PhotoStyleSettings): PhotoStyleSettings {
  return JSON.parse(JSON.stringify(settings)) as PhotoStyleSettings
}

export interface AppliedStandardPreset {
  preset: StandardPresetConfig
  settings: PhotoStyleSettings
}

export function getDefaultPresetSettings(presetId: string): PhotoStyleSettings {
  const preset = getStandardPreset(presetId)

  const defaults: PhotoStyleSettings = {
    presetId: preset.id,
    shotType: { type: preset.defaults.shotType },
    focalLength: preset.defaults.focalLength,
    aperture: preset.defaults.aperture,
    lightingQuality: preset.defaults.lighting.quality,
    shutterSpeed: preset.defaults.shutterSpeed,
    bodyAngle: preset.defaults.pose.bodyAngle,
    headPosition: preset.defaults.pose.headPosition,
    shoulderPosition: preset.defaults.pose.shoulderPosition,
    weightDistribution: preset.defaults.pose.weightDistribution,
    armPosition: preset.defaults.pose.armPosition,
    expression: { type: preset.defaults.pose.expression }
  }

  if (preset.defaults.aspectRatio) {
    defaults.aspectRatio = preset.defaults.aspectRatio
  }

  if (preset.defaults.pose.sittingPose) {
    defaults.sittingPose = preset.defaults.pose.sittingPose
  }

  return defaults
}

export function applyStandardPreset(
  presetId: string | undefined,
  styleSettings: PhotoStyleSettings
): AppliedStandardPreset {
  const preset = getStandardPreset(presetId)
  const settings = cloneSettings(styleSettings)

  if (!settings.presetId) {
    settings.presetId = preset.id
  }

  // Shot type
  if (!settings.shotType) {
    settings.shotType = { type: preset.defaults.shotType }
  }

  // Camera defaults
  if (!settings.aspectRatio) {
    if (preset.defaults.aspectRatio) {
      settings.aspectRatio = preset.defaults.aspectRatio
    }
  }

  const resolvedShotType = settings.shotType?.type
  if (resolvedShotType && resolvedShotType !== 'user-choice') {
    const canonicalAspectRatio = shotTypeSuggestedAspectRatio(resolvedShotType).id
    if (settings.aspectRatio !== canonicalAspectRatio) {
      settings.aspectRatio = canonicalAspectRatio
    }
  }

  if (!settings.focalLength) {
    settings.focalLength = preset.defaults.focalLength
  }

  if (!settings.aperture) {
    settings.aperture = preset.defaults.aperture
  }

  if (!settings.lightingQuality) {
    settings.lightingQuality = preset.defaults.lighting.quality
  }

  if (!settings.shutterSpeed) {
    settings.shutterSpeed = preset.defaults.shutterSpeed
  }

  // Pose defaults - skip if pose preset is selected to avoid overriding template settings
  const hasPosePreset = settings.pose?.type && settings.pose.type !== 'user-choice'
  if (!hasPosePreset) {
    if (!settings.bodyAngle) {
    settings.bodyAngle = preset.defaults.pose.bodyAngle
  }

  if (!settings.headPosition) {
    settings.headPosition = preset.defaults.pose.headPosition
  }

  if (!settings.shoulderPosition) {
    settings.shoulderPosition = preset.defaults.pose.shoulderPosition
  }

  if (!settings.weightDistribution) {
    settings.weightDistribution = preset.defaults.pose.weightDistribution
  }

  if (!settings.armPosition) {
    settings.armPosition = preset.defaults.pose.armPosition
  }

  if (!settings.sittingPose && preset.defaults.pose.sittingPose) {
    settings.sittingPose = preset.defaults.pose.sittingPose
  }

  if (!settings.expression || !settings.expression.type) {
    settings.expression = { type: preset.defaults.pose.expression }
  }
  }

  return { preset, settings }
}

