/**
 * Shot Type Element
 *
 * Contributes shot framing and composition rules to different workflow phases.
 * Ensures consistent framing from person generation through final composition.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import { resolveShotType, type ShotTypeConfig } from '../../shot-type/config'
import { hasValue } from '../../base/element-types'

export class ShotTypeElement extends StyleElement {
  readonly id = 'shot-type'
  readonly name = 'Shot Type'
  readonly description = 'Controls framing and composition based on shot type'

  // Shot type affects person generation, composition, and evaluation
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase } = context
    return (
      phase === 'person-generation' ||
      phase === 'composition' ||
      phase === 'evaluation'
    )
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase, settings } = context

    // Resolve shot type configuration
    const shotTypeValue = hasValue(settings.shotType) ? settings.shotType.value.type : undefined
    const shotType = resolveShotType(shotTypeValue)

    if (phase === 'person-generation') {
      return this.contributeToPersonGeneration(shotType)
    }

    if (phase === 'composition') {
      return this.contributeToComposition(shotType)
    }

    if (phase === 'evaluation') {
      return this.contributeToEvaluation(shotType)
    }

    return {}
  }

  /**
   * Person generation phase contribution
   * Provides framing and composition rules for the initial person image
   */
  private contributeToPersonGeneration(shotType: ShotTypeConfig): ElementContribution {
    // Note: Specific framing details (shot type, crop points, composition) are in the JSON payload
    // Only add critical quality rules that aren't obvious from the JSON structure

    const mustFollow: string[] = [
      'Person must fill frame according to shot type specifications',
      'Framing must be accurate and professional',
      `Frame MUST match the specified crop points exactly: ${shotType.framingDescription}`,
    ]

    // Add explicit negative constraints for tighter shots to prevent over-showing
    if (shotType.id === 'medium-shot') {
      mustFollow.push(
        'CRITICAL: Cut the frame at waist level (belly button). Do NOT show hips, thighs, knees, or legs.',
        'The lower frame edge should be at the natural waistline, NOT lower'
      )
    } else if (shotType.id === 'medium-close-up') {
      mustFollow.push(
        'CRITICAL: Frame from top of head to mid-chest. Do NOT show below the chest.',
        'Torso and arms should be minimal - this is a headshot, not a bust portrait'
      )
    } else if (shotType.id === 'three-quarter') {
      mustFollow.push(
        'CRITICAL: Frame to mid-thigh level. Feet must NOT be visible.',
        'Show from head to mid-thigh, full arms included'
      )
    }

    return {
      mustFollow,

      payload: {
        framing: {
          shot_type: shotType.id,
          crop_points: shotType.framingDescription,
          composition: shotType.compositionNotes ?? shotType.framingDescription,
        },
      },

      metadata: {
        shotTypeId: shotType.id,
        framingDescription: shotType.framingDescription,
        compositionNotes: shotType.compositionNotes,
      },
    }
  }

  /**
   * Composition phase contribution
   * Ensures framing is maintained when composing person with background
   */
  private contributeToComposition(shotType: ShotTypeConfig): ElementContribution {
    const shotTypeLabel = shotType.id.replace(/-/g, ' ')
    const mustFollow: string[] = [
      `Maintain ${shotTypeLabel} framing from person image`,
      'Do not reframe, zoom in/out, or crop the person',
      'Person scale and framing must remain exactly as provided',
      `The person was generated with specific crop points: ${shotType.framingDescription}. These MUST be preserved.`,
    ]

    // Add explicit reminders for specific shot types to prevent frame creep
    if (shotType.id === 'medium-shot') {
      mustFollow.push(
        'The person is framed from head to waist (belly button level). Do NOT extend the frame to show hips, thighs, or legs.'
      )
    } else if (shotType.id === 'medium-close-up') {
      mustFollow.push(
        'The person is framed from head to mid-chest. Do NOT extend the frame to show waist or torso.'
      )
    }

    return {
      mustFollow,

      freedom: [
        'Adjust background scale or positioning to complement framing',
        'Fine-tune lighting to match background environment',
      ],

      metadata: {
        shotTypeId: shotType.id,
        preserveFraming: true,
      },
    }
  }

  /**
   * Evaluation phase contribution
   * Provides framing tolerance for validation
   */
  private contributeToEvaluation(shotType: ShotTypeConfig): ElementContribution {
    // Define framing tolerance based on shot type
    const tolerance = this.getFramingTolerance(shotType.id)

    return {
      metadata: {
        shotTypeId: shotType.id,
        expectedFraming: tolerance.bounds,
        tolerance: tolerance.value,
        description: shotType.framingDescription,
      },
    }
  }

  /**
   * Get framing tolerance bounds for evaluation
   */
  private getFramingTolerance(shotTypeId: string) {
    const tolerances: Record<
      string,
      { bounds: { minY: number; maxY: number }; value: number }
    > = {
      'extreme-close-up': {
        bounds: { minY: 0.15, maxY: 0.85 },
        value: 0.10,
      },
      'close-up': {
        bounds: { minY: 0.10, maxY: 0.90 },
        value: 0.10,
      },
      'medium-close-up': {
        bounds: { minY: 0.10, maxY: 0.90 },
        value: 0.12,
      },
      'medium-shot': {
        bounds: { minY: 0.10, maxY: 0.90 },
        value: 0.15,
      },
      'three-quarter': {
        bounds: { minY: 0.08, maxY: 0.92 },
        value: 0.15,
      },
      'full-length': {
        bounds: { minY: 0.05, maxY: 0.95 },
        value: 0.10,
      },
      'wide-shot': {
        bounds: { minY: 0.05, maxY: 0.95 },
        value: 0.15,
      },
    }

    return (
      tolerances[shotTypeId] || {
        bounds: { minY: 0.10, maxY: 0.90 },
        value: 0.15,
      }
    )
  }

  /**
   * Validate shot type settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []

    if (!hasValue(settings.shotType)) {
      // Not an error - will use default
      return errors
    }

    const shotTypeValue = settings.shotType.value.type

    // Try to resolve - if it doesn't throw, it's valid
    try {
      const resolved = resolveShotType(shotTypeValue)
      if (!resolved) {
        errors.push(`Invalid shot type: ${shotTypeValue}`)
      }
    } catch (error) {
      errors.push(`Failed to resolve shot type: ${shotTypeValue}`)
    }

    return errors
  }

  // Lower priority - camera settings should be established early
  get priority(): number {
    return 40
  }
}

// Export singleton instance
export const shotTypeElement = new ShotTypeElement()
export default shotTypeElement

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Elements self-register on import!
 *
 * When this module is imported, the element automatically registers
 * with the composition registry. No manual registration required!
 */
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(shotTypeElement)
