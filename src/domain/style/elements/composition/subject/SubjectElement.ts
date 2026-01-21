/**
 * Subject Element
 *
 * Contributes identity preservation and facial accuracy rules to:
 * - person-generation: How to generate the person from selfies
 * - composition: How to refine identity while preserving pose/expression
 *
 * Ensures the generated person matches the selfie references without averaging or blending.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'

export class SubjectElement extends StyleElement {
  readonly id = 'subject'
  readonly name = 'Subject'
  readonly description = 'Identity preservation and facial accuracy'

  // Subject identity rules apply to person generation AND composition
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, generationContext } = context

    // Only contribute if we have selfie references
    const hasSelfies = generationContext.selfieS3Keys && generationContext.selfieS3Keys.length > 0
    if (!hasSelfies) {
      return false
    }

    // Contribute to person generation and composition phases
    return phase === 'person-generation' || phase === 'composition'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase, generationContext } = context

    if (phase === 'person-generation') {
      return this.contributeToPersonGeneration(context)
    }

    if (phase === 'composition') {
      return this.contributeToComposition(context)
    }

    return {}
  }

  /**
   * Person generation phase: How to create the person from selfies
   */
  private contributeToPersonGeneration(context: ElementContext): ElementContribution {
    const { generationContext } = context
    const selfieCount = generationContext.selfieS3Keys?.length || 0
    const hasFaceComposite = !!generationContext.hasFaceComposite
    const hasBodyComposite = !!generationContext.hasBodyComposite

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      selfieCount,
      phase: 'person-generation',
      hasFaceComposite,
      hasBodyComposite,
    }

    if (selfieCount > 0) {
      // Core identity instructions
      instructions.push(
        'Choose the face that best matches the requested pose as the primary likeness',
        'Use remaining selfies to reinforce 3D facial structure, hair, glasses, and fine details',
        'Stay as close as possible to the original selfies - do not invent details unless specified'
      )

      // Reference image usage instructions (based on what composites are available)
      if (hasFaceComposite || hasBodyComposite) {
        if (hasFaceComposite) {
          instructions.push(
            'Use the FACE REFERENCE composite for identity, facial structure, and fine details'
          )
        }
        if (hasBodyComposite) {
          instructions.push(
            'Use the BODY REFERENCE composite to understand body proportions and structure'
          )
        }
      } else {
        // Fallback to combined composite instruction
        instructions.push(
          'Use the stacked selfie reference to recreate the person - choose one as primary face basis'
        )
      }

      // Feature preservation rules
      instructions.push(
        'Preserve all facial features: eyes, nose, mouth, ears, eyebrows, cheeks, chin',
        'Preserve colors: eye color, skin tone, hair color',
        'Preserve unique details: moles, scars, freckles, hairstyle',
        'Preserve accessories exactly as shown: glasses, earrings, watches'
      )

      // Critical constraints
      mustFollow.push(
        'Select ONE selfie as PRIMARY face basis - do NOT average or blend faces into a new person',
        'Do NOT alter the fundamental facial structure',
        'Do NOT add accessories that are not visible in selfies',
        'Do NOT remove accessories that are visible in selfies',
        'The person must be instantly recognizable as the same individual from the selfies',
        'No beautification or idealization - maintain authentic appearance',
        'Realistic skin texture with high-frequency details and natural imperfections',
        'Realistic hair with individual strands and stray hairs visible'
      )
    }

    return {
      instructions,
      mustFollow,
      metadata,
    }
  }

  /**
   * Composition phase: How to refine identity while preserving pose/expression
   *
   * The person from Step 1a may not perfectly match selfies. Step 2 should:
   * - REFINE: head shape, facial structure, proportions, skin texture
   * - PRESERVE: pose, expression, eye direction, clothing, hair style
   */
  private contributeToComposition(context: ElementContext): ElementContribution {
    const { generationContext } = context
    // Use flags passed from Step 2 (composites are passed as function params, not in preparedAssets)
    const hasFaceComposite = !!generationContext.hasFaceComposite
    const hasBodyComposite = !!generationContext.hasBodyComposite

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      phase: 'composition',
      hasFaceComposite,
      hasBodyComposite,
    }

    // Always add the preservation vs refinement rules
    mustFollow.push(
      // What to PRESERVE from BASE IMAGE (pose-related)
      'PRESERVE from BASE IMAGE: pose, expression, eye direction, mouth position, clothing style, body position, crop point, hair style',
      // What to REFINE to match selfies (identity-related)
      'REFINE to match selfies: head shape, facial structure, face proportions, jawline, cheekbones, nose shape, eye spacing, forehead, body proportions, skin texture'
    )

    // Add identity refinement instructions if composites are available
    if (hasFaceComposite || hasBodyComposite) {
      instructions.push(
        'The person in BASE IMAGE may not perfectly match the selfies - your PRIMARY task is to make them match'
      )

      if (hasFaceComposite) {
        instructions.push(
          'FACE REFINEMENT: Modify head shape, facial structure, face proportions, jawline, cheekbones, nose shape, eye spacing, forehead to MATCH the FACE REFERENCE selfies exactly'
        )
      }

      if (hasBodyComposite) {
        instructions.push(
          'BODY REFINEMENT: Adjust body proportions, shoulder width, torso shape, arm thickness to MATCH the BODY REFERENCE selfies'
        )
      }

      instructions.push(
        'SKIN & DETAILS: Match skin texture, skin tone, any visible moles, freckles, or distinctive marks from the selfies',
        'The final result must look like THE PERSON FROM THE SELFIES in the pose/expression/clothing from BASE IMAGE'
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
