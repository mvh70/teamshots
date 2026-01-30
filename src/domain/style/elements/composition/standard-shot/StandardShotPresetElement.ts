/**
 * Standard Shot Preset Element
 *
 * Provides scene/environment metadata for standard-shots presets.
 * All other content (pose, expression, lighting, camera, clothing) comes from
 * their respective elements via preset settings.
 *
 * This element ONLY handles:
 * - Scene environment descriptions (not covered by BackgroundElement)
 * - High-level preset context
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import { Logger } from '@/lib/logger'
import { getPresetMetadata, PRESET_METADATA } from '../../preset/presets'

// Valid preset IDs
export type StandardShotPresetId = keyof typeof PRESET_METADATA

export class StandardShotPresetElement extends StyleElement {
  readonly id = 'standard-shot-preset'
  readonly name = 'Standard Shot Preset'
  readonly description = 'Scene metadata for standard shot presets'

  // Runs early to provide scene context
  get priority(): number {
    return 15
  }

  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Only relevant if a standard-shot preset is selected
    const presetId = settings.presetId as StandardShotPresetId | undefined
    if (!presetId || !PRESET_METADATA[presetId]) {
      return false
    }

    // Contribute to composition phase
    return phase === 'composition' || phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const presetId = settings.presetId as StandardShotPresetId
    const metadata = getPresetMetadata(presetId)

    Logger.info('[StandardShotPresetElement] Providing scene metadata', { presetId })

    // Only provide scene/environment context
    // All other content comes from respective elements via preset settings
    return {
      instructions: [
        `Preset: ${presetId.replace(/_/g, ' ')}`,
        metadata.description,
      ],
      mustFollow: [],
      payload: {
        scene: {
          environment: {
            description: metadata.sceneDescription,
            location_type: metadata.locationType,
          }
        }
      },
      metadata: {
        standardShotPreset: presetId,
      }
    }
  }
}

export const standardShotPresetElement = new StandardShotPresetElement()
export default standardShotPresetElement

// Auto-register
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(standardShotPresetElement)
