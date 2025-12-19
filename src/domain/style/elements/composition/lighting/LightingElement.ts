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

    // Add detailed lighting instructions
    instructions.push(
      `Lighting quality: ${derived.quality}`,
      `Light direction: ${derived.direction}`,
      `Color temperature: ${derived.colorTemp}K`,
      derived.description
    )

    // Add setup details
    if (derived.setup.length > 0) {
      instructions.push('Lighting setup:')
      derived.setup.forEach((item) => {
        instructions.push(`  - ${item}`)
      })
    }

    // Phase-specific instructions
    if (phase === 'person-generation') {
      instructions.push(
        'Apply lighting direction and quality to subject facial features',
        'Ensure proper catchlights in eyes from main light source',
        'Shadow falloff should match the lighting quality',
        'Skin tones must reflect the color temperature accurately'
      )
      mustFollow.push(
        'Lighting must originate from the specified direction',
        'Shadow quality must match the lighting type (soft/hard)',
        `Color temperature must be consistent at ${derived.colorTemp}K`,
        'Catchlights in eyes must be present and realistic'
      )

      // Quality-specific rules
      if (derived.quality.includes('Soft') || derived.quality.includes('Diffused')) {
        mustFollow.push('Shadow transitions must be gradual and soft')
      } else if (derived.quality.includes('Dramatic')) {
        instructions.push('Strong shadows and highlights for dramatic effect')
        mustFollow.push('High contrast between lit and shadow areas')
      }

      // Direction-specific guidance
      if (derived.direction.includes('Rembrandt')) {
        instructions.push('Create characteristic Rembrandt triangle on shadow-side cheek')
      } else if (derived.direction.includes('Loop')) {
        instructions.push('Small shadow from nose angling down toward mouth corner')
      } else if (derived.direction.includes('Frontal')) {
        instructions.push('Minimize facial shadows with even frontal illumination')
      }
    } else if (phase === 'background-generation') {
      instructions.push(
        'Background lighting must match the primary lighting setup',
        'Ambient light quality should be consistent with the scene',
        `Background color temperature must match ${derived.colorTemp}K`,
        'Background illumination should support the main subject lighting'
      )
      mustFollow.push(
        'Background lighting must be coherent with subject lighting direction',
        'Lighting quality must be consistent across the scene',
        `Color temperature ${derived.colorTemp}K must be maintained`,
        'Ambient light should enhance rather than conflict with main lighting'
      )

      // Environment-specific guidance
      if (input.backgroundEnvironment === 'studio') {
        instructions.push('Studio background with controlled gradient lighting')
        mustFollow.push('Background must show studio lighting characteristics')
      } else if (input.backgroundEnvironment === 'outdoor') {
        instructions.push('Natural outdoor ambient light matching time of day')
        if (input.timeOfDay === 'golden_hour' || input.timeOfDay === 'sunset') {
          mustFollow.push('Warm golden tones in ambient light')
        }
      } else if (input.backgroundEnvironment === 'indoor') {
        instructions.push('Indoor ambient light with natural falloff')
      }
    } else if (phase === 'composition') {
      instructions.push(
        'Ensure lighting direction is consistent between person and background',
        'Match color temperature across all compositional elements',
        'Verify shadow direction and quality alignment',
        'Maintain consistent ambient light levels'
      )
      mustFollow.push(
        'Light direction must be coherent across composition',
        `Color temperature ${derived.colorTemp}K must be uniform`,
        'Shadow characteristics must match between layers',
        'No lighting inconsistencies or mismatched light sources'
      )
    }

    // Color temperature guidance
    if (derived.colorTemp <= 3500) {
      instructions.push('Warm color cast - render with golden/orange tones')
      metadata.warmLighting = true
    } else if (derived.colorTemp >= 6500) {
      instructions.push('Cool color cast - render with blue/cyan tones')
      metadata.coolLighting = true
    }

    return {
      instructions,
      mustFollow,
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
