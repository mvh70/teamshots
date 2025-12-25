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
import type { LightingInput } from '../../lighting/types'

export class LightingElement extends StyleElement {
  readonly id = 'lighting'
  readonly name = 'Lighting'
  readonly description = 'Lighting setup, quality, and color temperature'

  // Lighting affects person generation, background generation, and composition
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if user-choice (will be derived by system)
    if (settings.lighting?.type === 'user-choice') {
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

    // Handle explicit lighting type if set
    if (settings.lighting && settings.lighting.type !== 'user-choice') {
      const lightingType = settings.lighting.type
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
      },
    }

    // Note: Specific lighting details (quality, direction, color temperature, setup) are in the JSON payload
    // Only add critical quality rules that aren't obvious from the JSON structure

    // Phase-specific quality constraints
    if (phase === 'person-generation') {
      mustFollow.push(
        'Lighting must be professional and flattering',
        'Catchlights in eyes must be present and realistic',
        'Shadow falloff must match lighting quality specification'
      )
    } else if (phase === 'background-generation') {
      mustFollow.push(
        'Background lighting must be coherent with subject lighting direction',
        'Lighting quality must be consistent across the scene'
      )
    } else if (phase === 'composition') {
      mustFollow.push(
        'Light direction must be coherent across composition',
        'Color temperature must be uniform throughout',
        'Shadow characteristics must match between layers',
        'No lighting inconsistencies or mismatched light sources'
      )

      // Detailed composition lighting instructions
      instructions.push(
        'Ensure LIGHTING WRAP: The key light should illuminate the person brightly while creating natural falloff on the background',
        'Apply subtle EDGE LIGHTING or rim light on the person\'s shoulders/hair to separate them from the background and enhance three-dimensionality'
      )
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

    // Validate lighting type
    const validTypes = ['natural', 'studio', 'soft', 'dramatic', 'user-choice']
    if (!validTypes.includes(lighting.type)) {
      errors.push(`Unknown lighting type: ${lighting.type}`)
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
