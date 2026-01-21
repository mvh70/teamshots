/**
 * Lighting Element
 *
 * Contributes lighting setup and quality rules to person and background generation.
 * Handles both explicit lighting types (natural, studio, soft, dramatic) and derived lighting
 * based on environment, time of day, and scene requirements.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import { deriveLighting } from '../../lighting/derive'
import { getBackgroundEnvironment } from '../../background/config'
import { hasValue } from '../../base/element-types'
import type { LightingInput } from '../../lighting/types'

export class LightingElement extends StyleElement {
  readonly id = 'lighting'
  readonly name = 'Lighting'
  readonly description = 'Lighting setup, quality, and color temperature'

  // Lighting affects person generation, background generation, and composition
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if user-choice (will be derived by system)
    if (settings.lighting?.mode === 'user-choice') {
      return false
    }

    // Lighting contributes to most phases except evaluation
    return (
      phase === 'person-generation' ||
      phase === 'background-generation' ||
      phase === 'composition'
    )
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase, settings } = context

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {}

    // Handle explicit lighting type if set (predefined mode with a value)
    if (settings.lighting?.mode === 'predefined' && settings.lighting.value) {
      const lightingType = settings.lighting.value.type
      metadata.lightingType = lightingType

      // Add type-specific instructions
      const typeInstructions = this.getLightingTypeInstructions(lightingType, phase)
      instructions.push(...typeInstructions.instructions)
      mustFollow.push(...typeInstructions.mustFollow)
    }

    // Also derive detailed lighting settings from context for additional guidance
    const input = this.buildLightingInput(context)
    const derived = deriveLighting(input)

    // Add derived lighting details to metadata
    metadata.quality = derived.quality
    metadata.direction = derived.direction
    metadata.setup = derived.setup
    metadata.colorTemp = derived.colorTemp
    metadata.description = derived.description

    // Build payload structure for generation
    const payload = {
      lighting: {
        quality: derived.quality,
        direction: derived.direction,
        setup: derived.setup,
        color_temperature: `${derived.colorTemp}K`,
        description: derived.description,
        note: 'The setup describes how light should appear on the subject, NOT visible equipment. No softboxes, umbrellas, studio lights, lamps, light fixtures, or photography equipment should be visible in the image.',
      },
    }

    // Note: Specific lighting details (quality, direction, color temperature, setup) are in the JSON payload
    // Only add critical quality rules that aren't obvious from the JSON structure

    // Phase-specific quality constraints
    if (phase === 'person-generation') {
      // Step 1a uses neutral/even lighting (final scene lighting applied in Step 2)
      mustFollow.push(
        'Neutral, even lighting with no harsh shadows - final scene lighting applied in composition',
        'Catchlights in eyes must be present and realistic',
        'No studio lighting equipment visible (softboxes, umbrellas, reflectors, lights)'
      )
    } else if (phase === 'background-generation') {
      // Background needs lighting coherence constraint
      mustFollow.push(
        'No studio lighting equipment, softboxes, umbrellas, reflectors, lamps, light fixtures, or photography gear visible in the image'
      )
      mustFollow.push(
        'Background lighting must be coherent with subject lighting direction',
        'Lighting quality must be consistent across the scene'
      )
    } else if (phase === 'composition') {
      // Composition phase: lighting matching is handled by the hardcoded Compositing Instructions
      // in v3-step2-final-composition.ts (Color Matching, Global Grading, Shadows sections).
      // We only contribute metadata here to avoid duplication.
      // The lighting JSON payload already specifies direction, quality, and color temperature.
    }

    // Color temperature guidance
    if (derived.colorTemp <= 3500) {
      metadata.warmLighting = true
    } else if (derived.colorTemp >= 6500) {
      metadata.coolLighting = true
    }

    return {
      instructions,
      mustFollow,
      payload,
      metadata,
    }
  }

  /**
   * Get lighting type-specific instructions
   */
  private getLightingTypeInstructions(
    type: string,
    phase: string
  ): { instructions: string[]; mustFollow: string[] } {
    const instructions: string[] = []
    const mustFollow: string[] = []

    switch (type) {
      case 'natural':
        instructions.push(
          'Use natural, realistic lighting that feels organic',
          'Lighting should appear as if from natural sources (sun, windows, ambient)'
        )
        mustFollow.push(
          'Lighting must appear natural and unforced',
          'No obvious artificial lighting artifacts'
        )
        break

      case 'studio':
        instructions.push(
          'Professional studio lighting setup with controlled illumination',
          'Clean, polished lighting typical of commercial photography'
        )
        mustFollow.push(
          'Lighting must be clean and professional',
          'Studio-quality illumination with proper fill and rim lights'
        )
        break

      case 'soft':
        instructions.push(
          'Soft, flattering lighting with gentle shadow transitions',
          'Diffused light sources creating smooth gradations'
        )
        mustFollow.push(
          'Shadow transitions must be soft and gradual',
          'No harsh or abrupt lighting edges',
          'Lighting must be flattering and gentle'
        )
        break

      case 'dramatic':
        instructions.push(
          'Dramatic lighting with strong contrast and defined shadows',
          'Bold light and shadow interplay for impact'
        )
        mustFollow.push(
          'High contrast between highlights and shadows required',
          'Shadows must be defined and purposeful',
          'Dramatic mood must be conveyed through lighting'
        )
        break
    }

    return { instructions, mustFollow }
  }

  /**
   * Build LightingInput from ElementContext
   */
  private buildLightingInput(context: ElementContext): LightingInput {
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

    // Extract timeOfDay from extended settings
    const timeOfDay = (settings as Record<string, unknown>).timeOfDay as string | undefined

    return {
      backgroundEnvironment,
      backgroundModifier,
      timeOfDay,
      shotType,
      presetId,
      subjectCount,
    }
  }

  /**
   * Validate lighting settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const lighting = settings.lighting

    if (!lighting) {
      return errors
    }

    // Validate mode
    const validModes = ['predefined', 'user-choice']
    if (!validModes.includes(lighting.mode)) {
      errors.push(`Unknown lighting mode: ${lighting.mode}`)
    }

    // Validate lighting type if predefined with a value
    if (lighting.mode === 'predefined' && lighting.value) {
      const validTypes = ['natural', 'studio', 'soft', 'dramatic']
      if (!validTypes.includes(lighting.value.type)) {
        errors.push(`Unknown lighting type: ${lighting.value.type}`)
      }
    }

    return errors
  }

  // High priority - lighting is fundamental to the visual rendering
  get priority(): number {
    return 25
  }
}

// Export singleton instance
export const lightingElement = new LightingElement()
export default lightingElement

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Elements self-register on import!
 *
 * When this module is imported, the element automatically registers
 * with the composition registry. No manual registration required!
 */
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(lightingElement)
