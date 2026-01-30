/**
 * Lighting Element
 *
 * Contributes lighting setup and quality rules to person and background generation.
 * Handles both explicit lighting types and derived lighting based on environment.
 */

import { StyleElement, ElementContext, ElementContribution } from '../base/StyleElement'
import { deriveLighting } from './derive'
import { getBackgroundEnvironment } from '../background/config'
import { hasValue } from '../base/element-types'
import type { LightingInput } from './types'
import { autoRegisterElement } from '../composition/registry'

export class LightingElement extends StyleElement {
  readonly id = 'lighting'
  readonly name = 'Lighting'
  readonly description = 'Lighting setup, quality, and color temperature'

  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    if (settings.lighting?.mode === 'user-choice') {
      return false
    }

    // Skip person-generation: step1a always uses neutral lighting on grey background,
    // overwriting any element contribution. Only contribute for composition and background.
    return phase === 'background-generation' || phase === 'composition'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase, settings } = context

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {}

    if (settings.lighting?.mode === 'predefined' && settings.lighting.value) {
      const lightingType = settings.lighting.value.type
      metadata.lightingType = lightingType

      const typeInstructions = this.getLightingTypeInstructions(lightingType, phase)
      instructions.push(...typeInstructions.instructions)
      mustFollow.push(...typeInstructions.mustFollow)
    }

    const input = this.buildLightingInput(context)
    const derived = deriveLighting(input)

    metadata.quality = derived.quality
    metadata.direction = derived.direction
    metadata.setup = derived.setup
    metadata.colorTemp = derived.colorTemp
    metadata.description = derived.description

    const payload = {
      lighting: {
        quality: derived.quality,
        direction: derived.direction,
        setup: derived.setup,
        color_temperature: `${derived.colorTemp}K`,
        description: derived.description,
        note: 'The setup describes how light should appear on the subject, NOT visible equipment.',
      },
    }

    // Background-generation: lighting coherence is implied by the derived payload

    if (derived.colorTemp <= 3500) metadata.warmLighting = true
    else if (derived.colorTemp >= 6500) metadata.coolLighting = true

    return { instructions, mustFollow, payload, metadata }
  }

  private getLightingTypeInstructions(type: string, phase: string): { instructions: string[]; mustFollow: string[] } {
    const instructions: string[] = []
    const mustFollow: string[] = []

    switch (type) {
      case 'natural':
        instructions.push('Use natural, realistic lighting that feels organic')
        mustFollow.push('Lighting must appear natural and unforced')
        break
      case 'studio':
        instructions.push('Professional studio lighting setup')
        mustFollow.push('Lighting must be clean and professional')
        break
      case 'soft':
        instructions.push('Soft, flattering lighting with gentle shadow transitions')
        mustFollow.push('Shadow transitions must be soft and gradual', 'Lighting must be flattering and gentle')
        break
      case 'dramatic':
        instructions.push('Dramatic lighting with strong contrast and defined shadows')
        mustFollow.push('High contrast between highlights and shadows required')
        break
    }

    return { instructions, mustFollow }
  }

  private buildLightingInput(context: ElementContext): LightingInput {
    const { settings } = context

    const shotType = hasValue(settings.shotType) ? settings.shotType.value.type : 'medium-close-up'
    const backgroundType = settings.background?.value?.type
    const backgroundEnvironment = getBackgroundEnvironment(backgroundType)
    const backgroundModifier = settings.background?.value?.modifier

    const subjectCountStr = settings.subjectCount || '1'
    let subjectCount = 1
    if (subjectCountStr === '2-3') subjectCount = 2
    else if (subjectCountStr === '4-8') subjectCount = 4
    else if (subjectCountStr === '9+') subjectCount = 9

    const presetId = settings.presetId
    const timeOfDay = (settings as Record<string, unknown>).timeOfDay as string | undefined

    return { backgroundEnvironment, backgroundModifier, timeOfDay, shotType, presetId, subjectCount }
  }

  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const lighting = settings.lighting

    if (!lighting) return errors

    const validModes = ['predefined', 'user-choice']
    if (!validModes.includes(lighting.mode)) {
      errors.push(`Unknown lighting mode: ${lighting.mode}`)
    }

    if (lighting.mode === 'predefined' && lighting.value) {
      const validTypes = ['natural', 'studio', 'soft', 'dramatic']
      if (!validTypes.includes(lighting.value.type)) {
        errors.push(`Unknown lighting type: ${lighting.value.type}`)
      }
    }

    return errors
  }

  get priority(): number {
    return 25
  }
}

export const lightingElement = new LightingElement()
export default lightingElement

autoRegisterElement(lightingElement)
