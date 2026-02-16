/**
 * Shot Type Element
 *
 * Contributes shot framing and composition rules to different workflow phases.
 * Ensures consistent framing from person generation through final composition.
 */

import { StyleElement, ElementContext, ElementContribution } from '../base/StyleElement'
import { resolveShotType, type ShotTypeConfig } from './config'
import { hasValue } from '../base/element-types'
import { autoRegisterElement } from '../composition/registry'

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
    // Person-generation phase: framing rules are handled by:
    // - getStep1aShotTypeFramingConstraint() in shot-type/prompt.ts
    //   which applies shot-type-specific body boundary instructions
    // - JSON framing section (shot_type, crop_points, composition)
    //
    // We only contribute the payload and metadata here to avoid duplication.
    // The hardcoded bodyBoundaryInstruction is comprehensive and shot-type-specific.

    return {
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
    // Composition phase: framing preservation is handled by
    // getStep2ShotTypeFramingConstraint() in shot-type/prompt.ts.
    //
    // We only contribute metadata here to avoid duplication.
    // Note: We intentionally do NOT add "Adjust background scale or positioning" freedom
    // as it conflicts with Hard Constraint #2 (preserve background content exactly).

    return {
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

autoRegisterElement(shotTypeElement)
