/**
 * Subject Element
 *
 * Contributes identity preservation and facial accuracy rules to:
 * - person-generation: How to generate the person from selfies
 * - composition: How to refine identity while preserving pose/expression
 */

import { StyleElement, ElementContext, ElementContribution } from '../base/StyleElement'
import { autoRegisterElement } from '../composition/registry'

export class SubjectElement extends StyleElement {
  readonly id = 'subject'
  readonly name = 'Subject'
  readonly description = 'Identity preservation and facial accuracy'

  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, generationContext } = context
    const hasSelfies = generationContext.selfieS3Keys && generationContext.selfieS3Keys.length > 0
    if (!hasSelfies) return false
    return phase === 'person-generation' || phase === 'composition'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase } = context
    if (phase === 'person-generation') return this.contributeToPersonGeneration(context)
    if (phase === 'composition') return this.contributeToComposition(context)
    return {}
  }

  private contributeToPersonGeneration(context: ElementContext): ElementContribution {
    const { generationContext } = context
    const selfieCount = generationContext.selfieS3Keys?.length || 0
    const hasFaceComposite = !!generationContext.hasFaceComposite
    const hasBodyComposite = !!generationContext.hasBodyComposite
    const hasCombinedOnly = !hasFaceComposite && !hasBodyComposite

    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      selfieCount, phase: 'person-generation', hasFaceComposite, hasBodyComposite, hasCombinedOnly,
    }

    if (selfieCount === 0) return { metadata }

    const identityPayload: Record<string, unknown> = {
      source: 'attached selfies',
      primary_rule: 'Select ONE selfie as primary face basis - never average or blend faces into a new person',
      recognition: 'The result must be instantly recognizable as this specific person',
    }

    const composites: string[] = []
    if (hasFaceComposite) composites.push('FACE COMPOSITE for facial structure, features, skin texture')
    if (hasBodyComposite) composites.push('BODY COMPOSITE for body proportions, posture, hands')
    if (hasCombinedOnly) composites.push('SELFIE COMPOSITE as reference for complete subject')
    if (composites.length > 0) identityPayload.composites = composites

    // Identity preservation rules — single source via mustFollow only
    // (Previously duplicated in both payload.preservation and mustFollow)
    mustFollow.push(
      'Do NOT alter the fundamental facial structure from the selfies',
      'Do NOT add or remove accessories not shown in selfies (glasses, earrings, watches)',
      'No beautification or idealization - preserve authentic appearance including moles, scars, freckles',
      'Preserve exact colors: eye color, skin tone, hair color'
    )

    return {
      mustFollow,
      payload: { subject: { identity: identityPayload } },
      metadata,
    }
  }

  private contributeToComposition(context: ElementContext): ElementContribution {
    const { generationContext } = context
    const hasFaceComposite = !!generationContext.hasFaceComposite
    const hasBodyComposite = !!generationContext.hasBodyComposite

    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = { phase: 'composition', hasFaceComposite, hasBodyComposite }

    const identityPayload: Record<string, unknown> = {
      source: 'attached selfies',
      preserve_from_base: ['pose', 'expression', 'eye direction', 'clothing', 'body position', 'hair style'],
      refine_to_match_selfies: ['facial structure', 'head shape', 'skin texture', 'distinctive marks'],
    }

    const composites: string[] = []
    if (hasFaceComposite) composites.push('FACE COMPOSITE to refine head shape, facial structure, proportions')
    if (hasBodyComposite) composites.push('BODY COMPOSITE to adjust body proportions and hands')
    if (composites.length > 0) identityPayload.composites = composites

    mustFollow.push(
      'PRESERVE from BASE: pose, expression, eye direction, clothing, body position, hair style',
      'REFINE to match selfies: facial structure, head shape, skin texture, distinctive marks'
    )

    return {
      mustFollow,
      payload: { subject: { identity: identityPayload } },
      metadata,
    }
  }

  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    return []
  }

  get priority(): number {
    return 10
  }
}

export const subjectElement = new SubjectElement()
export default subjectElement

autoRegisterElement(subjectElement)
