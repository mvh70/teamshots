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
import type { BackgroundSettings } from '@/types/photo-style'
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

    // Skip if no background configured or user-choice (handled elsewhere)
    if (!background || background.type === 'user-choice') {
      return false
    }

    // Simple backgrounds (neutral, gradient) don't need step 1b generation
    const isSimpleBackground = background.type === 'neutral' || background.type === 'gradient'

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

    if (!background) {
      return false
    }

    // Need preparation only for custom backgrounds with a key
    return background.type === 'custom' && !!background.key
  }

  /**
   * Prepare custom background asset in step 0
   *
   * Downloads the custom background image and returns it as a prepared asset
   * for use in background-generation phase
   */
  async prepare(context: ElementContext): Promise<PreparedAsset> {
    const { settings, generationContext } = context
    const background = settings.background!
    const generationId = generationContext.generationId || 'unknown'

    // Type guard for downloadAsset service
    const downloadAsset = generationContext.downloadAsset as
      | ((key: string) => Promise<{ base64: string; mimeType: string } | null>)
      | undefined

    if (!downloadAsset) {
      throw new Error('BackgroundElement.prepare(): downloadAsset must be provided in generationContext')
    }

    if (background.type !== 'custom' || !background.key) {
      throw new Error('BackgroundElement.prepare(): Custom background requires a key')
    }

    Logger.info('[BackgroundElement] Downloading custom background', {
      generationId,
      backgroundKey: background.key,
    })

    // Download custom background
    const backgroundImage = await downloadAsset(background.key)
    if (!backgroundImage) {
      throw new Error(`BackgroundElement.prepare(): Failed to download custom background: ${background.key}`)
    }

    Logger.info('[BackgroundElement] Custom background downloaded successfully', {
      generationId,
      backgroundKey: background.key,
      mimeType: backgroundImage.mimeType,
    })

    // Return prepared asset
    return {
      elementId: this.id,
      assetType: 'custom-background',
      data: {
        base64: backgroundImage.base64,
        mimeType: backgroundImage.mimeType,
        s3Key: background.key,
      },
    }
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const background = settings.background as BackgroundSettings

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      backgroundType: background.type,
    }

    // Generate background prompt for payload
    const bgPrompt = generateBackgroundPrompt(background)

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
    switch (background.type) {
      case 'office':
      case 'tropical-beach':
      case 'busy-city':
        // Complex backgrounds: ensure depth and natural integration
        mustFollow.push(
          'Background must be softer/blurrier than the subject for depth',
          'Subject must integrate naturally with the background environment'
        )
        if (background.prompt) {
          metadata.customPrompt = background.prompt
        }
        break

      case 'neutral':
        mustFollow.push(
          'Background must be smooth and uniform',
          'No patterns, textures, or additional elements'
        )
        if (background.color) {
          metadata.backgroundColor = background.color
        }
        break

      case 'gradient':
        mustFollow.push(
          'Gradient must be smooth without banding',
          'Gradient transition must be natural and professional'
        )
        if (background.color) {
          metadata.gradientColor = background.color
        }
        break

      case 'custom':
        mustFollow.push(
          'Custom background image must be used exactly as provided',
          'Do not modify or alter the custom background',
          'Subject must be properly integrated with natural lighting/shadows'
        )
        if (background.key) {
          metadata.customBackgroundKey = background.key
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

    if (!background) {
      return errors
    }

    // Validate neutral/gradient backgrounds have colors
    if ((background.type === 'neutral' || background.type === 'gradient') && !background.color) {
      errors.push(`${background.type} background requires a color`)
    }

    // Validate custom background has key
    if (background.type === 'custom' && !background.key) {
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
