import type { PhotoStyleSettings } from '@/types/photo-style'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import { CLIENT_PACKAGES } from '@/domain/style/packages'
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
  packageId?: string
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
  const pkg = generationContext.packageId
    ? CLIENT_PACKAGES[generationContext.packageId]
    : undefined

  const elementContext: ElementContext = {
    phase,
    settings: styleSettings,
    packageContext: generationContext.packageId
      ? {
          packageId: generationContext.packageId,
          ...(pkg?.requiredElements ? { activeElements: pkg.requiredElements } : {}),
        }
      : undefined,
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
