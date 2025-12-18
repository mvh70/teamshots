/**
 * Aspect Ratio Element
 *
 * Contributes canvas dimensions and composition format rules to all phases.
 * Ensures proper framing and output dimensions across the workflow.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import { resolveAspectRatioConfig } from '../../aspect-ratio/config'

export class AspectRatioElement extends StyleElement {
  readonly id = 'aspect-ratio'
  readonly name = 'Aspect Ratio'
  readonly description = 'Canvas dimensions and format specifications'

  // Aspect ratio affects all phases
  isRelevantForPhase(context: ElementContext): boolean {
    const { settings } = context

    // Skip if no aspect ratio configured
    if (!settings.aspectRatio) {
      return false
    }

    // Relevant for all phases (affects composition throughout)
    return true
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase, settings } = context
    const aspectRatio = settings.aspectRatio!
    const config = resolveAspectRatioConfig(aspectRatio)

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      aspectRatioId: config.id,
      width: config.width,
      height: config.height,
    }

    // Common instructions for all phases
    instructions.push(
      `Generate the image at exactly ${config.width}x${config.height} pixels (${config.id} aspect ratio)`,
      'Fill the entire canvas edge-to-edge with the composition',
      'Do NOT add borders, frames, letterboxing, or black bars'
    )

    mustFollow.push(
      `Output dimensions must be exactly ${config.width}x${config.height} pixels`,
      'Image content must extend to all edges of the canvas',
      `Aspect ratio must be maintained at ${config.id}`
    )

    // Phase-specific instructions
    if (phase === 'person-generation') {
      instructions.push(
        'Ensure the person is framed appropriately for the canvas dimensions',
        'Person should be scaled correctly to fill the frame without being cropped incorrectly'
      )
      mustFollow.push(
        'Person must fit naturally within the canvas dimensions',
        'Framing must respect the aspect ratio constraints'
      )
    } else if (phase === 'background-generation') {
      instructions.push(
        'Background should fill the entire canvas at the specified dimensions',
        'Consider the aspect ratio when positioning background elements'
      )
      mustFollow.push(
        'Background must cover the full canvas without distortion',
        'Background elements must be composed for the aspect ratio'
      )
    } else if (phase === 'composition') {
      instructions.push(
        'Composite the final image to exactly fill the canvas dimensions',
        'Ensure proper scaling and positioning for the aspect ratio'
      )
      mustFollow.push(
        'Final composition must be exactly the specified dimensions',
        'No parts of the composition should be cut off or distorted'
      )
    } else if (phase === 'evaluation') {
      instructions.push(
        'Verify the image dimensions match the specified aspect ratio',
        'Check that the composition works well within the canvas format'
      )
      mustFollow.push(
        'Image dimensions must be validated',
        'Aspect ratio compliance must be confirmed'
      )
    }

    // Add orientation-specific guidance
    const isPortrait = config.height > config.width
    const isLandscape = config.width > config.height
    const isSquare = config.width === config.height

    if (isPortrait) {
      instructions.push('Composition is in portrait orientation - optimize vertical space')
      metadata.orientation = 'portrait'
    } else if (isLandscape) {
      instructions.push('Composition is in landscape orientation - optimize horizontal space')
      metadata.orientation = 'landscape'
    } else if (isSquare) {
      instructions.push('Composition is square - balance all sides equally')
      metadata.orientation = 'square'
    }

    return {
      instructions,
      mustFollow,
      metadata,
    }
  }

  /**
   * Validate aspect ratio settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const aspectRatio = settings.aspectRatio

    if (!aspectRatio) {
      return errors
    }

    // Validate aspect ratio is one of the known formats
    const validRatios = ['9:16', '4:5', '3:4', '2:3', '1:1', '3:2', '4:3', '5:4', '16:9', '21:9']
    if (!validRatios.includes(aspectRatio)) {
      errors.push(`Unknown aspect ratio: ${aspectRatio}`)
    }

    return errors
  }

  // Very high priority - aspect ratio is fundamental to the entire composition
  get priority(): number {
    return 20
  }
}

// Export singleton instance
export const aspectRatioElement = new AspectRatioElement()
export default aspectRatioElement
