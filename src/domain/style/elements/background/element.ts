/**
 * Background Element
 *
 * Contributes background scene and environment rules to background generation.
 * Handles different background types (office, tropical beach, city, neutral, gradient, custom).
 */

import {
  StyleElement,
  ElementContext,
  ElementContribution,
  type PreparedAsset,
} from '../base/StyleElement'
import { hasValue } from '../base/element-types'
import { generateBackgroundPrompt } from './prompt'
import { autoRegisterElement } from '../composition/registry'
import { Logger } from '@/lib/logger'

export class BackgroundElement extends StyleElement {
  readonly id = 'background'
  readonly name = 'Background'
  readonly description = 'Background scene and environment settings'

  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context
    const background = settings.background

    if (!background || !hasValue(background)) {
      return false
    }

    const bgValue = background.value
    const isSimpleBackground = bgValue.type === 'neutral' || bgValue.type === 'gradient'

    if (isSimpleBackground) {
      return phase === 'person-generation' || phase === 'composition'
    } else {
      return phase === 'person-generation' || phase === 'background-generation'
    }
  }

  needsPreparation(context: ElementContext): boolean {
    const { settings } = context
    const background = settings.background

    if (!background || !hasValue(background)) {
      return false
    }

    const bgValue = background.value
    return bgValue.type === 'custom' && !!bgValue.key
  }

  async prepare(context: ElementContext): Promise<PreparedAsset> {
    const { settings, generationContext } = context
    const background = settings.background
    const generationId = generationContext.generationId || 'unknown'

    const downloadAsset = generationContext.downloadAsset as
      | ((key: string) => Promise<{ base64: string; mimeType: string } | null>)
      | undefined

    if (!downloadAsset) {
      throw new Error('BackgroundElement.prepare(): downloadAsset must be provided')
    }

    if (!background || !hasValue(background)) {
      throw new Error('BackgroundElement.prepare(): Background value required')
    }

    const bgValue = background.value

    if (bgValue.type !== 'custom' || !bgValue.key) {
      throw new Error('BackgroundElement.prepare(): Custom background requires a key')
    }

    Logger.info('[BackgroundElement] Downloading custom background', { generationId, backgroundKey: bgValue.key })

    const backgroundImage = await downloadAsset(bgValue.key)
    if (!backgroundImage) {
      throw new Error(`BackgroundElement.prepare(): Failed to download custom background: ${bgValue.key}`)
    }

    return {
      elementId: this.id,
      assetType: 'custom-background',
      data: {
        base64: backgroundImage.base64,
        mimeType: backgroundImage.mimeType,
        s3Key: bgValue.key,
      },
    }
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const background = settings.background

    if (!background || !hasValue(background)) {
      return { mustFollow: [], payload: {} }
    }

    const bgValue = background.value
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = { backgroundType: bgValue.type }

    const bgPrompt = generateBackgroundPrompt(bgValue)

    const payload: Record<string, unknown> = {
      scene: { environment: {} },
    }

    const environment = (payload.scene as Record<string, unknown>).environment as Record<string, unknown>
    if (bgPrompt.location_type) environment.location_type = bgPrompt.location_type
    if (bgPrompt.description) environment.description = bgPrompt.description
    if (bgPrompt.color_palette) environment.color_palette = bgPrompt.color_palette
    if (bgPrompt.branding) environment.branding = bgPrompt.branding

    switch (bgValue.type) {
      case 'office':
      case 'tropical-beach':
      case 'busy-city':
        mustFollow.push(
          'Background must be softer/blurrier than the subject for depth',
          'Subject must integrate naturally with the background environment'
        )
        if (bgValue.prompt) metadata.customPrompt = bgValue.prompt
        break

      case 'neutral':
        mustFollow.push('Background must be smooth and uniform', 'No patterns, textures, or additional elements')
        if (bgValue.color) metadata.backgroundColor = bgValue.color
        break

      case 'gradient':
        mustFollow.push('Gradient must be smooth without banding', 'Gradient transition must be natural and professional')
        if (bgValue.color) metadata.gradientColor = bgValue.color
        break

      case 'custom':
        if (bgValue.key) metadata.customBackgroundKey = bgValue.key
        if (context.phase === 'composition') {
          mustFollow.push(
            'Custom background image must be used exactly as provided',
            'Do not modify or alter the custom background',
            'Subject must be properly integrated with natural lighting/shadows'
          )
          const preparedAssets = context.generationContext.preparedAssets
          const backgroundAsset = preparedAssets?.get(`${this.id}-custom-background`)
          if (backgroundAsset?.data.base64) {
            return {
              mustFollow,
              payload,
              metadata,
              referenceImages: [{
                url: `data:${backgroundAsset.data.mimeType || 'image/png'};base64,${backgroundAsset.data.base64}`,
                description: 'Custom background image - use exactly as provided for the scene',
                type: 'background' as const,
              }],
            }
          }
        }
        break

      default:
        return { mustFollow: [], payload: {} }
    }

    return { mustFollow, payload, metadata }
  }

  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const background = settings.background

    if (!background || !hasValue(background)) return errors

    const bgValue = background.value
    if ((bgValue.type === 'neutral' || bgValue.type === 'gradient') && !bgValue.color) {
      errors.push(`${bgValue.type} background requires a color`)
    }
    if (bgValue.type === 'custom' && !bgValue.key) {
      errors.push('Custom background requires key')
    }

    return errors
  }

  get priority(): number {
    return 70
  }
}

export const backgroundElement = new BackgroundElement()
export default backgroundElement

autoRegisterElement(backgroundElement)
