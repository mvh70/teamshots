/**
 * Subject Element
 *
 * Contributes identity preservation and facial accuracy rules to:
 * - person-generation: How to generate the person from selfies
 * - composition: How to refine identity while preserving pose/expression
 */

import { StyleElement, ElementContext, ElementContribution } from '../base/StyleElement'
import { autoRegisterElement } from '../composition/registry'
import { generateSubjectCompositionPrompt, generateSubjectPersonPrompt } from './prompt'
import type { DemographicProfile } from '@/domain/selfie/selfieDemographics'

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
    const demographics = this.extractDemographicProfile(generationContext.demographics)

    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      selfieCount,
      phase: 'person-generation',
      hasFaceComposite,
      hasBodyComposite,
      hasCombinedOnly: !hasFaceComposite && !hasBodyComposite,
      hasDemographics: !!demographics,
    }

    if (selfieCount === 0) return { metadata }

    const subjectPrompt = generateSubjectPersonPrompt({
      selfieCount,
      hasFaceComposite,
      hasBodyComposite,
      demographics,
    })
    mustFollow.push(...subjectPrompt.mustFollow)

    const subjectPayload: Record<string, unknown> = {
      identity: subjectPrompt.identityPayload
    }
    if (subjectPrompt.demographicGuidance) {
      subjectPayload.demographic_guidance = subjectPrompt.demographicGuidance
    }

    return {
      mustFollow,
      payload: { subject: subjectPayload },
      metadata,
    }
  }

  private contributeToComposition(context: ElementContext): ElementContribution {
    const { generationContext } = context
    const hasFaceComposite = !!generationContext.hasFaceComposite
    const hasBodyComposite = !!generationContext.hasBodyComposite

    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = { phase: 'composition', hasFaceComposite, hasBodyComposite }

    const subjectPrompt = generateSubjectCompositionPrompt({
      hasFaceComposite,
      hasBodyComposite,
    })
    mustFollow.push(...subjectPrompt.mustFollow)

    return {
      mustFollow,
      payload: { subject: { identity: subjectPrompt.identityPayload } },
      metadata,
    }
  }

  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    return []
  }

  get priority(): number {
    return 10
  }

  private extractDemographicProfile(raw: unknown): DemographicProfile | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return undefined
    }

    const source = raw as Record<string, unknown>
    const profile: DemographicProfile = {}

    if (typeof source.gender === 'string' && source.gender !== 'unknown') {
      profile.gender = source.gender as DemographicProfile['gender']
    }

    if (typeof source.ageRange === 'string') {
      profile.ageRange = source.ageRange
    } else if (typeof source.age_range === 'string') {
      profile.ageRange = source.age_range
    }

    if (typeof source.ethnicity === 'string' && source.ethnicity !== 'unknown') {
      profile.ethnicity = source.ethnicity as DemographicProfile['ethnicity']
    }

    if (!profile.gender && !profile.ageRange && !profile.ethnicity) {
      return undefined
    }

    return profile
  }
}

export const subjectElement = new SubjectElement()
export default subjectElement

autoRegisterElement(subjectElement)
