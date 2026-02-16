import type { PhotoStyleSettings } from '@/types/photo-style'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import {
  compositionRegistry,
  type ElementContext,
  type PreparedAsset,
} from '@/domain/style/elements/composition'

export interface GenerationContextForComposition {
  selfieS3Keys: string[]
  generationId?: string
  personId?: string
  teamId?: string
  demographics?: unknown
  preparedAssets?: Map<string, PreparedAsset>
  hasFaceComposite?: boolean
  hasBodyComposite?: boolean
}

export interface ElementContributionResult {
  instructions: string[]
  mustFollow: string[]
  freedom: string[]
  referenceImages: BaseReferenceImage[]
  payload?: Record<string, unknown>
}

export async function composeElementContributions(
  phase: 'person-generation' | 'background-generation' | 'composition' | 'evaluation',
  styleSettings: PhotoStyleSettings,
  generationContext: GenerationContextForComposition
): Promise<ElementContributionResult> {
  const elementContext: ElementContext = {
    phase,
    settings: styleSettings,
    generationContext: {
      selfieS3Keys: generationContext.selfieS3Keys,
      personId: generationContext.personId,
      teamId: generationContext.teamId,
      generationId: generationContext.generationId,
      demographics: generationContext.demographics,
      preparedAssets: generationContext.preparedAssets,
      hasFaceComposite: generationContext.hasFaceComposite,
      hasBodyComposite: generationContext.hasBodyComposite,
    },
    existingContributions: [],
  }

  const contributions = await compositionRegistry.composeContributions(elementContext)

  return {
    instructions: contributions.instructions || [],
    mustFollow: contributions.mustFollow || [],
    freedom: contributions.freedom || [],
    referenceImages: (contributions.referenceImages as unknown as BaseReferenceImage[]) || [],
    payload: contributions.payload,
  }
}
