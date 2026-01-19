/**
 * Camera Settings Element
 *
 * Contributes camera technical specifications to person and background generation.
 * Derives optimal settings based on shot type, background environment, and subject count.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import { deriveCameraSettings } from '../../camera-settings/derive'
import { getBackgroundEnvironment } from '../../background/config'
import { hasValue } from '../../base/element-types'
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

    // Build payload structure for generation
    const payload = {
      camera: {
        lens: {
          focal_length_mm: derived.focalLength,
          character: lensCharacter,
        },
        settings: {
          aperture: `f/${derived.aperture.toFixed(1)}`,
          iso: derived.iso,
        },
        positioning: {
          distance_from_subject_ft: derived.cameraDistance,
          subject_to_background_ft: derived.backgroundDistance,
          height: this.describeCameraHeight(derived.cameraHeight),
        },
        color: {
          white_balance_kelvin: derived.whiteBalance,
        },
      },
    }

    // Note: Specific camera settings (focal length, aperture, positioning) are in the JSON payload
    // Only add critical quality rules that aren't obvious from the JSON structure

    // Phase-specific quality constraints
    if (phase === 'person-generation') {
      mustFollow.push(
        'Subject must be in sharp focus',
        'Apply lens compression and perspective appropriate for the focal length',
        'Depth of field rendering must match aperture specification'
      )
    } else if (phase === 'background-generation') {
      mustFollow.push(
        'Background blur must be consistent with aperture setting',
        'Camera perspective and height must match specified position'
      )
    } else if (phase === 'composition') {
      // Detailed depth of field rendering based on aperture
      const dofDescription = this.describeDepthOfField(derived.aperture)
      mustFollow.push(
        `Apply DEPTH OF FIELD based on the camera aperture (f/${derived.aperture.toFixed(1)}) - ${dofDescription}`,
        'The person should be TACK SHARP while the background is SLIGHTLY SOFTER (not blurred, just gentler focus)',
        'Depth of field must be consistent across composition',
        'Lens character and compression must be uniform',
        'Color temperature must match white balance setting',
        'Camera perspective must be coherent between all elements'
      )

      // CRITICAL: Explicit depth/distance instructions
      // The subject_to_background_ft value in the JSON needs explicit reinforcement
      instructions.push(
        `CRITICAL DEPTH: The subject should appear to be standing approximately ${derived.backgroundDistance} feet from the background wall/surface`,
        `Create VISIBLE SPATIAL SEPARATION between the subject and background - this is NOT a flat backdrop but a 3D scene with ${derived.backgroundDistance} feet of depth`,
        'The shadow from the subject should fall ONTO the background surface at an appropriate distance based on the lighting angle',
        'Use atmospheric perspective: the background should have slightly reduced contrast and saturation compared to the sharp subject in the foreground'
      )
    }

    // Add ISO-specific guidance
    if (derived.iso >= 1600) {
      metadata.highISO = true
    } else if (derived.iso <= 200) {
      metadata.lowISO = true
    }

    return {
      instructions,
      mustFollow,
      payload,
      metadata,
    }
  }

  /**
   * Build CameraSettingsInput from ElementContext
   */
  private buildCameraSettingsInput(context: ElementContext): CameraSettingsInput {
    const { settings } = context

    // Extract shot type
    const shotType = hasValue(settings.shotType) ? settings.shotType.value.type : 'medium-close-up'

    // Extract background environment
    const backgroundType = settings.background?.value?.type
    const backgroundEnvironment = getBackgroundEnvironment(backgroundType)
    const backgroundModifier = settings.background?.value?.modifier

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
