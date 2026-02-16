import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'

export interface PersistedImageReference {
  key: string
  mimeType: string
  description?: string
}

export interface V3CachedPayload {
  prompt: string
  mustFollowRules: string[]
  freedomRules: string[]
  aspectRatio: string
  aspectRatioDescription: string
}

export interface CanonicalStepRules {
  mustFollowRules: string[]
  freedomRules: string[]
}

export interface CanonicalStep2Artifacts extends CanonicalStepRules {
  payloadOverlay?: string
}

export interface CanonicalPromptState {
  prompt: string
  step1aArtifacts: CanonicalStepRules
  step2Artifacts: CanonicalStep2Artifacts
  step3EvalArtifacts: CanonicalStepRules
  version: number
  promptHash: string
  createdAt: string
}

export interface V3WorkflowState {
  cachedPayload?: V3CachedPayload
  canonicalPromptState?: CanonicalPromptState
  apiCallBudget?: {
    used: number
    max: number
  }
  step1a?: {
    personImage: PersistedImageReference
    personAssetId?: string
    clothingLogoReference?: BaseReferenceImage
    backgroundLogoReference?: BaseReferenceImage
    evaluatorComments?: string[]
  }
}
