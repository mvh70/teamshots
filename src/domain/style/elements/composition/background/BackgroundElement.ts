/**
 * Background Element
 *
 * Contributes background scene and environment rules to background generation.
 * Handles different background types (office, tropical beach, city, neutral, gradient, custom).
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import type { BackgroundSettings } from '@/types/photo-style'

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
