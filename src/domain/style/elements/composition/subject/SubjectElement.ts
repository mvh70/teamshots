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
        'Synthesize a single, photorealistic, and coherent identity from these images',
        'Use the selfie that most resembles the requested pose as a basis',
        'Use other selfies to reinforce 3D structure and facial detail'
      )

      mustFollow.push(
        'Do NOT average or blend features in a way that creates a new person',
        'Do NOT alter the fundamental facial structure',
        'Identity must match the selfie references exactly'
      )
    }

    // Face feature preservation
    instructions.push(
      'Carefully preserve all facial features from the source selfies:',
      '- Form of eyes, nose, mouth, ears, eyebrows, cheeks, and chin',
      '- Color of eyes, skin tone, and hair color',
      '- Unique skin details like moles, scars, or freckles',
      '- Hair style and any other unique features visible in selfies'
    )

    mustFollow.push(
      'Eyes must match shape, color, and expression from selfies',
      'Nose structure must be identical to source selfies',
      'Mouth shape and size must match selfies exactly',
      'Skin tone and texture must match source selfies',
      'Hair color, style, and texture must match selfies',
      'All moles, freckles, scars, and unique features must be preserved',
      'Facial proportions must match the original person'
    )

    // Accessory preservation
    instructions.push(
      'If the person wears glasses in the selfies, add exactly the same glasses to the resulting image',
      'If the person has earrings or a watch in the selfies, add exactly the same accessories'
    )

    mustFollow.push(
      'Glasses must match the exact style from selfies (if present)',
      'All visible accessories must be included and matched exactly',
      'Do NOT add accessories that are not visible in selfies',
      'Do NOT remove accessories that are visible in selfies'
    )

    // General identity rules
    mustFollow.push(
      'The person must be instantly recognizable as the same individual from the selfies',
      'No beautification or idealization - maintain authentic appearance',
      'Facial features must appear natural and not artificially enhanced',
      'The generated person must look like they could be in a real photograph with the same individual'
    )

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
