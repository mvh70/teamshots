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
import { Logger } from '@/lib/logger'

export class BackgroundElement extends StyleElement {
  readonly id = 'background'
  readonly name = 'Background'
  readonly description = 'Background scene and environment settings'

  // Background only affects background generation phase
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no background configured or user-choice (handled elsewhere)
    if (!settings.background || settings.background.type === 'user-choice') {
      return false
    }

    // Only contribute to background generation
    return phase === 'background-generation'
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

    // Generate background-specific instructions based on type
    switch (background.type) {
      case 'office':
        instructions.push(
          'Create a corporate office environment background',
          'Background should be slightly blurred to keep focus on the subject',
          'Include typical office elements: desks, computers, plants, windows'
        )
        mustFollow.push(
          'Location must be clearly recognizable as a professional office',
          'Background must be softer/blurrier than the subject for depth'
        )
        if (background.prompt) {
          metadata.customPrompt = background.prompt
          instructions.push(`Additional context: ${background.prompt}`)
        }
        break

      case 'tropical-beach':
        instructions.push(
          'Create a tropical beach setting',
          'Include palm trees and ocean in the background',
          'Atmosphere should be soft and dreamy'
        )
        mustFollow.push(
          'Must include recognizable tropical elements (palm trees, ocean, sand)',
          'Background should have natural outdoor lighting'
        )
        break

      case 'busy-city':
        instructions.push(
          'Create a busy urban city street background',
          'Include buildings and people in the background',
          'Background should be blurred for depth of field'
        )
        mustFollow.push(
          'Must show urban environment with buildings',
          'City elements should be clearly present but not distracting'
        )
        break

      case 'neutral':
        instructions.push(
          'Create a studio environment with a neutral solid color background',
          'Background should be smooth and uniform'
        )
        mustFollow.push(
          'Background must be a solid, neutral color',
          'No patterns, textures, or additional elements'
        )
        if (background.color) {
          metadata.backgroundColor = background.color
          instructions.push(`Use ${background.color} as the background color`)
          mustFollow.push(`Background color must be ${background.color}`)
        }
        break

      case 'gradient':
        instructions.push(
          'Create a studio environment with a gradient background',
          'Gradient should transition smoothly from light to dark'
        )
        mustFollow.push(
          'Background must show a clear gradient transition',
          'Gradient should be smooth without banding'
        )
        if (background.color) {
          metadata.gradientColor = background.color
          instructions.push(`Base gradient on ${background.color} color`)
          mustFollow.push(`Gradient must incorporate ${background.color}`)
        }
        break

      case 'custom':
        instructions.push(
          'Use the provided custom background image',
          'Ensure the subject integrates naturally with the custom background',
          'Maintain the composition and framing specified'
        )
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
            metadata,
            referenceImages,
          }
        }
        break

      default:
        // Unknown background type - skip
        return { instructions: [], mustFollow: [] }
    }

    return {
      instructions,
      mustFollow,
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
