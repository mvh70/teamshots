import { PhotoStyleSettings, ExpressionType, ShotTypeValue } from '@/types/photo-style'
import { StandardPresetConfig } from './index'
import { shotTypeSuggestedAspectRatio } from '../elements/shot-type/config'
import { predefined, hasValue, isUserChoice } from '../elements/base/element-types'

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
    shotType: predefined({ type: preset.defaults.shotType as ShotTypeValue }),
    // focalLength, aperture, lightingQuality, shutterSpeed are now dynamically derived
    pose: predefined({ type: preset.defaults.pose.type }),
    expression: predefined({ type: (preset.defaults.expression ?? 'genuine_smile') as ExpressionType })
  }

  if (preset.defaults.aspectRatio) {
    defaults.aspectRatio = preset.defaults.aspectRatio
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
    settings.shotType = predefined({ type: preset.defaults.shotType as ShotTypeValue })
  }

  // Camera defaults
  if (!settings.aspectRatio) {
    if (preset.defaults.aspectRatio) {
      settings.aspectRatio = preset.defaults.aspectRatio
    }
  }

  const resolvedShotType = hasValue(settings.shotType) ? settings.shotType.value.type : undefined
  if (resolvedShotType && !isUserChoice(settings.shotType)) {
    const canonicalAspectRatio = shotTypeSuggestedAspectRatio(resolvedShotType).id
    if (settings.aspectRatio !== canonicalAspectRatio) {
      settings.aspectRatio = canonicalAspectRatio
    }
  }

  // focalLength, aperture, lightingQuality, shutterSpeed are now dynamically derived
  // by camera-settings and lighting elements

  // Pose defaults
  if (!settings.pose) {
    settings.pose = predefined({ type: preset.defaults.pose.type })
  }

  // Expression defaults
  if (!settings.expression || !settings.expression.value?.type) {
    settings.expression = predefined({ type: (preset.defaults.expression ?? 'genuine_smile') as ExpressionType })
  }

  return { preset, settings }
}
