/**
 * Standard Shots Package Server
 *
 * Extends the client package with server-side generation capabilities.
 * Uses element-driven settings: each preset defines PhotoStyleSettings
 * that elements read and use to build prompts.
 */

import { standardShots } from './index'
import { BasePackageServer } from '../../base/BasePackageServer'
import type { GenerationContext, GenerationPayload } from '@/types/generation'
import type { ServerStylePackage } from '../types'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { Logger } from '@/lib/logger'
import { getPresetSettings } from '../../elements/preset/presets'

// Element imports - ensure they're registered
import '../../elements/subject/element'
import '../../elements/composition/standard-shot/StandardShotPresetElement'
import '../../elements/pose/element'
import '../../elements/expression/element'
import '../../elements/lighting/element'
import '../../elements/camera-settings/element'
import '../../elements/shot-type/element'
import '../../elements/aspect-ratio/element'
import '../../elements/background/element'
import '../../elements/clothing/element'
import '../../elements/rendering/film-type/FilmTypeElement'
import '../../elements/quality/GlobalQualityElement'

export type StandardShotsServerPackage = typeof standardShots & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

/**
 * Server implementation for Standard Shots package
 */
class StandardShotsServer extends BasePackageServer {
  constructor() {
    super(standardShots)
    Logger.info('[StandardShotsServer] Initialized with element-driven presets')
  }

  /**
   * Override to apply preset-specific settings
   *
   * The preset ID determines ALL settings (pose, expression, lighting, etc.)
   * Elements then read these settings and build prompts.
   */
  protected resolveEffectiveSettings(userSettings: PhotoStyleSettings): PhotoStyleSettings {
    // Get base settings from parent (package defaults)
    const base = super.resolveEffectiveSettings(userSettings)

    // Determine which preset to use
    const presetId = userSettings.presetId || base.presetId || 'LINKEDIN_NEUTRAL_STUDIO'

    // Get preset-specific settings
    const presetSettings = getPresetSettings(presetId)

    // Merge: base < preset settings
    // Preset settings override base settings
    const effective: PhotoStyleSettings = {
      ...base,
      ...presetSettings,
      presetId,
    }

    Logger.info('[StandardShotsServer] Resolved settings for preset', {
      presetId,
      clothing: effective.clothing,
      background: effective.background,
    })

    return effective
  }
}

// Create server instance
const serverInstance = new StandardShotsServer()

// Export the server package
export const standardShotsServer: StandardShotsServerPackage = {
  ...standardShots,
  buildGenerationPayload: (context: GenerationContext) => serverInstance.buildGenerationPayload(context)
}

export default standardShotsServer
