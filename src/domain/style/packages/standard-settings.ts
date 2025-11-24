import { PhotoStyleSettings } from '@/types/photo-style'
import { StandardPresetConfig } from './index'
import { shotTypeSuggestedAspectRatio } from '../elements/shot-type/config'

function cloneSettings(settings: PhotoStyleSettings): PhotoStyleSettings {
  return JSON.parse(JSON.stringify(settings)) as PhotoStyleSettings
}

export interface AppliedStandardPreset {
  preset: StandardPresetConfig
  settings: PhotoStyleSettings
}

/**
 * Gets the default settings for a preset.
 * NOW REQUIRES explicitly passing the preset config object,
 * as presets are no longer looked up from a global registry.
 */
export function getDefaultPresetSettings(preset: StandardPresetConfig): PhotoStyleSettings {
  const defaults: PhotoStyleSettings = {
    presetId: preset.id,
    shotType: { type: preset.defaults.shotType },
    // focalLength, aperture, lightingQuality, shutterSpeed are now dynamically derived
    // Initialize pose with nested granular defaults
    pose: {
      type: 'user-choice',
      bodyAngle: preset.defaults.pose.bodyAngle,
      headPosition: preset.defaults.pose.headPosition,
      shoulderPosition: preset.defaults.pose.shoulderPosition,
      weightDistribution: preset.defaults.pose.weightDistribution,
      armPosition: preset.defaults.pose.armPosition,
      // sittingPose is optional, added below if present
    },
    expression: { type: preset.defaults.pose.expression ?? 'user-choice' }
  }

  if (preset.defaults.aspectRatio) {
    defaults.aspectRatio = preset.defaults.aspectRatio
  }

  if (preset.defaults.pose.sittingPose && defaults.pose) {
    defaults.pose.sittingPose = preset.defaults.pose.sittingPose
  }

  return defaults
}

/**
 * Applies a standard preset to settings.
 * NOW REQUIRES passing the preset object map (from the package) to look up the preset.
 */
export function applyStandardPreset(
  presetId: string | undefined,
  styleSettings: PhotoStyleSettings,
  availablePresets: Record<string, StandardPresetConfig>
): AppliedStandardPreset {
  const preset = (presetId ? availablePresets[presetId] : undefined) || Object.values(availablePresets)[0]
  
  if (!preset) {
    throw new Error(`Preset ${presetId} not found and no defaults available`)
  }

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

  // focalLength, aperture, lightingQuality, shutterSpeed are now dynamically derived
  // by camera-settings and lighting elements

  // Initialize pose object if missing
  if (!settings.pose) {
    settings.pose = { type: 'user-choice' }
  }

  // Pose defaults - skip if pose preset is selected to avoid overriding template settings
  const hasPosePreset = settings.pose.type && settings.pose.type !== 'user-choice'
  if (!hasPosePreset) {
    if (!settings.pose.bodyAngle) {
      settings.pose.bodyAngle = preset.defaults.pose.bodyAngle
    }

    if (!settings.pose.headPosition) {
      settings.pose.headPosition = preset.defaults.pose.headPosition
    }

    if (!settings.pose.shoulderPosition) {
      settings.pose.shoulderPosition = preset.defaults.pose.shoulderPosition
    }

    if (!settings.pose.weightDistribution) {
      settings.pose.weightDistribution = preset.defaults.pose.weightDistribution
    }

    if (!settings.pose.armPosition) {
      settings.pose.armPosition = preset.defaults.pose.armPosition
    }

    if (!settings.pose.sittingPose && preset.defaults.pose.sittingPose) {
      settings.pose.sittingPose = preset.defaults.pose.sittingPose
    }

    if (!settings.expression || !settings.expression.type) {
      settings.expression = { type: preset.defaults.pose.expression ?? 'user-choice' }
    }
  }

  return { preset, settings }
}
