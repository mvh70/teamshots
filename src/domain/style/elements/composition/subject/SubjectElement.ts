/**
 * Subject Element
 *
 * Contributes identity preservation and facial accuracy rules to person generation.
 * Ensures the generated person matches the selfie references without averaging or blending.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'

export class SubjectElement extends StyleElement {
  readonly id = 'subject'
  readonly name = 'Subject'
  readonly description = 'Identity preservation and facial accuracy'

  // Subject identity rules always apply to person generation
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, generationContext } = context

    // Only contribute to person generation
    if (phase !== 'person-generation') {
      return false
    }

    // Only contribute if we have selfie references
    return generationContext.selfieS3Keys && generationContext.selfieS3Keys.length > 0
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { generationContext } = context
    const selfieCount = generationContext.selfieS3Keys?.length || 0

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      selfieCount,
    }

    // Identity source and synthesis task
    if (selfieCount > 0) {
      instructions.push(
        'Attached is a composite of selfies labeled with clear labels (SUBJECT1-SELFIE1, SUBJECT1-SELFIE2, etc.)',
        'Choose the face that best matches the requested pose as the primary likeness',
        'Use remaining selfies to reinforce 3D facial structure, hair, glasses, and fine details',
        'Stay as close as possible to the original selfies - do not invent details unless specified',
        'Preserve all facial features: eyes, nose, mouth, ears, eyebrows, cheeks, chin',
        'Preserve colors: eye color, skin tone, hair color',
        'Preserve unique details: moles, scars, freckles, hairstyle',
        'Preserve accessories exactly as shown: glasses, earrings, watches'
      )

      // Note: Specific feature descriptions (eyes, nose, mouth, skin, hair, accessories) are in instructions above
      // Only add critical quality rules that aren't obvious from the instructions
      mustFollow.push(
        'Do NOT average or blend features in a way that creates a new person',
        'Do NOT alter the fundamental facial structure',
        'Do NOT add accessories that are not visible in selfies',
        'Do NOT remove accessories that are visible in selfies',
        'The person must be instantly recognizable as the same individual from the selfies',
        'No beautification or idealization - maintain authentic appearance'
      )
    }

    return {
      instructions,
      mustFollow,
      metadata,
    }
  }

  /**
   * Validate subject settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []

    // Subject element doesn't have specific settings to validate
    // It relies on the presence of selfie references in the generation context

    return errors
  }

  // Highest priority - subject identity is the most critical element
  get priority(): number {
    return 10
  }
}

// Export singleton instance
export const subjectElement = new SubjectElement()
export default subjectElement

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Elements self-register on import!
 *
 * When this module is imported, the element automatically registers
 * with the composition registry. No manual registration required!
 */
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(subjectElement)
