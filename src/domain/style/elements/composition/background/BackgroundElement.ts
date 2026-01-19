/**
 * Background Element
 *
 * Contributes background scene and environment rules to background generation.
 * Handles different background types (office, tropical beach, city, neutral, gradient, custom).
 *
 * Implements preparation phase to download custom background assets asynchronously.
 */

import {
  StyleElement,
  ElementContext,
  ElementContribution,
  type PreparedAsset,
} from '../../base/StyleElement'
import type { BackgroundSettings, BackgroundValue } from '../../background/types'
import { isUserChoice, hasValue } from '../../base/element-types'
import { generateBackgroundPrompt } from '../../background/prompt'
import { Logger } from '@/lib/logger'

export class BackgroundElement extends StyleElement {
  readonly id = 'background'
  readonly name = 'Background'
  readonly description = 'Background scene and environment settings'

  // Background phase contribution depends on background type
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context
    const background = settings.background

    // Skip if no background configured or no value set
    // (regardless of mode - user-choice with value should still contribute)
    if (!background || !hasValue(background)) {
      return false
    }

    const bgValue = background.value

    // Simple backgrounds (neutral, gradient) don't need step 1b generation
    const isSimpleBackground = bgValue.type === 'neutral' || bgValue.type === 'gradient'

    if (isSimpleBackground) {
      // Simple backgrounds: contribute to person-generation (for originalPrompt) and composition (step 2)
      return phase === 'person-generation' || phase === 'composition'
    } else {
      // Complex backgrounds (custom, office, beach, city): contribute to person-generation (for originalPrompt) and background-generation (step 1b)
      return phase === 'person-generation' || phase === 'background-generation'
    }
  }

  /**
   * Check if this element needs to prepare assets (custom background download)
   */
  needsPreparation(context: ElementContext): boolean {
    const { settings } = context
    const background = settings.background

    if (!background || !hasValue(background)) {
      return false
    }

    const bgValue = background.value

    // Need preparation only for custom backgrounds with a key
    return bgValue.type === 'custom' && !!bgValue.key
  }

  /**
   * Prepare custom background asset in step 0
   *
   * Downloads the custom background image and returns it as a prepared asset
   * for use in background-generation phase
   */
  async prepare(context: ElementContext): Promise<PreparedAsset> {
    const { settings, generationContext } = context
    const background = settings.background
    const generationId = generationContext.generationId || 'unknown'

    // Type guard for downloadAsset service
    const downloadAsset = generationContext.downloadAsset as
      | ((key: string) => Promise<{ base64: string; mimeType: string } | null>)
      | undefined

    if (!downloadAsset) {
      throw new Error('BackgroundElement.prepare(): downloadAsset must be provided in generationContext')
    }

    if (!background || !hasValue(background)) {
      throw new Error('BackgroundElement.prepare(): Background value required')
    }

    const bgValue = background.value

    if (bgValue.type !== 'custom' || !bgValue.key) {
      throw new Error('BackgroundElement.prepare(): Custom background requires a key')
    }

    Logger.info('[BackgroundElement] Downloading custom background', {
      generationId,
      backgroundKey: bgValue.key,
    })

    // Download custom background
    const backgroundImage = await downloadAsset(bgValue.key)
    if (!backgroundImage) {
      throw new Error(`BackgroundElement.prepare(): Failed to download custom background: ${bgValue.key}`)
    }

    Logger.info('[BackgroundElement] Custom background downloaded successfully', {
      generationId,
      backgroundKey: bgValue.key,
      mimeType: backgroundImage.mimeType,
    })

    // Return prepared asset
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

    // Should not reach here without a valid background value due to isRelevantForPhase check
    if (!background || !hasValue(background)) {
      return { instructions: [], mustFollow: [], payload: {} }
    }

    const bgValue = background.value

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      backgroundType: bgValue.type,
    }

    // Generate background prompt for payload
    const bgPrompt = generateBackgroundPrompt(bgValue)

    // Build payload structure
    const payload: Record<string, unknown> = {
      scene: {
        environment: {},
      },
    }

    // Add background properties to payload
    const environment = (payload.scene as Record<string, unknown>).environment as Record<string, unknown>
    if (bgPrompt.location_type) {
      environment.location_type = bgPrompt.location_type
    }
    if (bgPrompt.description) {
      environment.description = bgPrompt.description
    }
    if (bgPrompt.color_palette) {
      environment.color_palette = bgPrompt.color_palette
    }
    if (bgPrompt.branding) {
      environment.branding = bgPrompt.branding
    }

    // Note: Specific background details (location_type, description, color_palette) are in the JSON payload
    // Only add critical quality rules that aren't obvious from the JSON structure

    // Add background-specific quality constraints based on type
    switch (bgValue.type) {
      case 'office':
      case 'tropical-beach':
      case 'busy-city':
        // Complex backgrounds: ensure depth and natural integration
        mustFollow.push(
          'Background must be softer/blurrier than the subject for depth',
          'Subject must integrate naturally with the background environment'
        )
        if (bgValue.prompt) {
          metadata.customPrompt = bgValue.prompt
        }
        break

      case 'neutral':
        mustFollow.push(
          'Background must be smooth and uniform',
          'No patterns, textures, or additional elements'
        )
        if (bgValue.color) {
          metadata.backgroundColor = bgValue.color
        }
        break

      case 'gradient':
        mustFollow.push(
          'Gradient must be smooth without banding',
          'Gradient transition must be natural and professional'
        )
        if (bgValue.color) {
          metadata.gradientColor = bgValue.color
        }
        break

      case 'custom':
        mustFollow.push(
          'Custom background image must be used exactly as provided',
          'Do not modify or alter the custom background',
          'Subject must be properly integrated with natural lighting/shadows'
        )
        if (bgValue.key) {
          metadata.customBackgroundKey = bgValue.key
        }

        // Get prepared custom background from context
        const preparedAssets = context.generationContext.preparedAssets
        const backgroundAsset = preparedAssets?.get(`${this.id}-custom-background`)

        // Add reference image if custom background was prepared
        const referenceImages = []
        if (backgroundAsset?.data.base64) {
          referenceImages.push({
            url: `data:${backgroundAsset.data.mimeType || 'image/png'};base64,${backgroundAsset.data.base64}`,
            description: 'Custom background image - use exactly as provided for the scene',
            type: 'background' as const,
          })

          Logger.info('[BackgroundElement] Added custom background to contribution', {
            generationId: context.generationContext.generationId,
          })

          return {
            instructions,
            mustFollow,
            payload,
            metadata,
            referenceImages,
          }
        }
        break

      default:
        // Unknown background type - skip
        return { instructions: [], mustFollow: [], payload: {} }
    }

    return {
      instructions,
      mustFollow,
      payload,
      metadata,
    }
  }

  /**
   * Validate background settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const background = settings.background

    if (!background || !hasValue(background)) {
      return errors
    }

    const bgValue = background.value

    // Validate neutral/gradient backgrounds have colors
    if ((bgValue.type === 'neutral' || bgValue.type === 'gradient') && !bgValue.color) {
      errors.push(`${bgValue.type} background requires a color`)
    }

    // Validate custom background has key
    if (bgValue.type === 'custom' && !bgValue.key) {
      errors.push('Custom background requires key')
    }

    return errors
  }

  // Medium-low priority - backgrounds set the scene but shouldn't override core composition
  get priority(): number {
    return 70
  }
}

// Export singleton instance
export const backgroundElement = new BackgroundElement()
export default backgroundElement

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Elements self-register on import!
 *
 * When this module is imported, the element automatically registers
 * with the composition registry. No manual registration required!
 */
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(backgroundElement)
