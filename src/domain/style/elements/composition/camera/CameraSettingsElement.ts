/**
 * Camera Settings Element
 *
 * Contributes camera technical specifications to person and background generation.
 * Derives optimal settings based on shot type, background environment, and subject count.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import { deriveCameraSettings } from '../../camera-settings/derive'
import { getBackgroundEnvironment } from '../../background/config'
import type { CameraSettingsInput } from '../../camera-settings/types'

export class CameraSettingsElement extends StyleElement {
  readonly id = 'camera-settings'
  readonly name = 'Camera Settings'
  readonly description = 'Camera technical specifications (lens, aperture, positioning)'

  // Camera settings affect person generation, background generation, and composition
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase } = context

    // Camera settings contribute to most phases except evaluation
    return (
      phase === 'person-generation' ||
      phase === 'background-generation' ||
      phase === 'composition'
    )
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase, settings } = context

    // Build camera settings input from context
    const input = this.buildCameraSettingsInput(context)

    // Derive optimal camera settings
    const derived = deriveCameraSettings(input)

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      focalLength: derived.focalLength,
      aperture: derived.aperture,
      iso: derived.iso,
      whiteBalance: derived.whiteBalance,
      cameraDistance: derived.cameraDistance,
      backgroundDistance: derived.backgroundDistance,
      cameraHeight: derived.cameraHeight,
    }

    // Describe lens character based on focal length
    const lensCharacter = this.describeLensCharacter(derived.focalLength)

    // Common camera instructions for all phases
    instructions.push(
      `Camera lens: ${derived.focalLength}mm focal length (${lensCharacter})`,
      `Camera aperture: f/${derived.aperture.toFixed(1)} (${this.describeDepthOfField(derived.aperture)})`,
      `Camera position: ${derived.cameraDistance}ft from subject, ${this.describeCameraHeight(derived.cameraHeight)}`,
      `Subject separation: ${derived.backgroundDistance}ft from background`
    )

    // Phase-specific instructions
    if (phase === 'person-generation') {
      instructions.push(
        'Apply lens compression and perspective appropriate for the focal length',
        'Consider depth of field when rendering foreground and subject sharpness',
        `ISO ${derived.iso}: Render with appropriate noise/grain characteristics`,
        `White balance ${derived.whiteBalance}K: Color temperature must match this setting`
      )
      mustFollow.push(
        `Lens compression must match ${derived.focalLength}mm perspective`,
        `Depth of field must match f/${derived.aperture.toFixed(1)} aperture`,
        'Subject must be in sharp focus',
        `Camera height perspective must be ${this.describeCameraHeight(derived.cameraHeight)}`
      )

      // Add focal length specific rules
      if (derived.focalLength <= 35) {
        mustFollow.push('Wide-angle lens distortion is acceptable but should be subtle')
      } else if (derived.focalLength >= 85) {
        mustFollow.push('Portrait lens compression should flatten features slightly')
      }

      // Add aperture-specific rules
      if (derived.aperture <= 2.8) {
        instructions.push('Very shallow depth of field - background should be strongly blurred')
        mustFollow.push('Background bokeh must be pronounced with smooth blur')
      } else if (derived.aperture >= 8.0) {
        instructions.push('Deep depth of field - more elements should be in focus')
        mustFollow.push('Greater depth of field with less background separation')
      }
    } else if (phase === 'background-generation') {
      instructions.push(
        'Background should reflect the specified camera distance and depth of field',
        `Apply appropriate blur based on ${derived.backgroundDistance}ft separation and f/${derived.aperture.toFixed(1)} aperture`,
        `Render background with ISO ${derived.iso} noise characteristics`,
        `White balance ${derived.whiteBalance}K must be consistent with lighting`
      )
      mustFollow.push(
        'Background blur must be consistent with the aperture setting',
        `Background must be positioned ${derived.backgroundDistance}ft behind subject position`,
        'Camera perspective and height must match the specified position'
      )

      // Depth of field guidance for background
      if (derived.aperture <= 2.8) {
        mustFollow.push('Background must be significantly out of focus with smooth bokeh')
      } else if (derived.aperture >= 5.6) {
        instructions.push('Background shows more detail with moderate sharpness')
      }
    } else if (phase === 'composition') {
      instructions.push(
        'Ensure consistent depth of field between person and background layers',
        'Match lens compression and perspective across all elements',
        `Maintain ${derived.whiteBalance}K white balance throughout the composition`,
        'Verify camera positioning and height perspective is consistent'
      )
      mustFollow.push(
        'Depth of field must be consistent across composition',
        'Lens character and compression must be uniform',
        'Color temperature must match white balance setting',
        'Camera perspective must be coherent between all elements'
      )
    }

    // Add ISO-specific guidance
    if (derived.iso >= 1600) {
      instructions.push('Higher ISO - render with subtle film grain or digital noise')
      metadata.highISO = true
    } else if (derived.iso <= 200) {
      instructions.push('Low ISO - image should be clean with minimal noise')
      metadata.lowISO = true
    }

    return {
      instructions,
      mustFollow,
      metadata,
    }
  }

  /**
   * Build CameraSettingsInput from ElementContext
   */
  private buildCameraSettingsInput(context: ElementContext): CameraSettingsInput {
    const { settings } = context

    // Extract shot type
    const shotType = settings.shotType?.type || 'medium-close-up'

    // Extract background environment
    const backgroundType = settings.background?.type
    const backgroundEnvironment = getBackgroundEnvironment(backgroundType)
    const backgroundModifier = settings.background?.modifier

    // Extract subject count (parse string to number)
    const subjectCountStr = settings.subjectCount || '1'
    let subjectCount = 1
    if (subjectCountStr === '2-3') subjectCount = 2
    else if (subjectCountStr === '4-8') subjectCount = 4
    else if (subjectCountStr === '9+') subjectCount = 9

    // Extract preset ID if available
    const presetId = settings.presetId

    // Extract timeOfDay and platform from extended settings
    const timeOfDay = (settings as Record<string, unknown>).timeOfDay as string | undefined
    const platform = (settings as Record<string, unknown>).platform as string | undefined

    return {
      shotType,
      backgroundEnvironment,
      backgroundModifier,
      subjectCount,
      timeOfDay,
      platform,
      presetId,
    }
  }

  /**
   * Describe lens character based on focal length
   */
  private describeLensCharacter(focalLength: number): string {
    if (focalLength <= 35) {
      return 'wide-angle with expanded field of view'
    }
    if (focalLength <= 50) {
      return 'standard with natural perspective'
    }
    if (focalLength <= 85) {
      return 'portrait with flattering compression'
    }
    if (focalLength <= 105) {
      return 'telephoto portrait with strong compression'
    }
    return 'long telephoto with dramatic compression'
  }

  /**
   * Describe depth of field based on aperture
   */
  private describeDepthOfField(aperture: number): string {
    if (aperture <= 2.0) {
      return 'very shallow depth of field'
    }
    if (aperture <= 2.8) {
      return 'shallow depth of field'
    }
    if (aperture <= 5.6) {
      return 'moderate depth of field'
    }
    if (aperture <= 8.0) {
      return 'deep depth of field'
    }
    return 'very deep depth of field'
  }

  /**
   * Describe camera height
   */
  private describeCameraHeight(height: string): string {
    const heightMap: Record<string, string> = {
      'eye_level': 'at subject eye level',
      'chest_level': 'at subject chest level',
      'waist_level': 'at subject waist level',
      'slightly_above_eye': 'slightly above subject eye level',
      'slightly_below_eye': 'slightly below subject eye level',
    }
    return heightMap[height] || 'at subject eye level'
  }

  /**
   * Validate camera settings (no explicit settings to validate - all derived)
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []

    // Camera settings are derived dynamically, so no direct validation needed
    // However, we can validate the inputs used for derivation

    // Validate subject count if present
    if (settings.subjectCount) {
      const validCounts = ['1', '2-3', '4-8', '9+']
      if (!validCounts.includes(settings.subjectCount)) {
        errors.push(`Invalid subject count: ${settings.subjectCount}`)
      }
    }

    return errors
  }

  // High priority - camera settings are fundamental to the technical rendering
  get priority(): number {
    return 30
  }
}

// Export singleton instance
export const cameraSettingsElement = new CameraSettingsElement()
export default cameraSettingsElement

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Elements self-register on import!
 *
 * When this module is imported, the element automatically registers
 * with the composition registry. No manual registration required!
 */
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(cameraSettingsElement)
