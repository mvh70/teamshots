import type { PhotoStyleSettings } from './photo-style'

export type DownloadSelfieFn = (key: string) => Promise<{ base64: string; mimeType: string }>

export type DownloadAssetFn = (
  key: string
) => Promise<{ base64: string; mimeType: string } | null>

export interface ReferenceImage {
  name?: string
  label?: string
  mimeType: string
  base64: string
  description?: string
}

export interface GenerationContext {
  generationId: string
  personId: string
  userId?: string | null
  prompt?: string | null
  demographics?: {
    gender?: string
    ageRange?: string
    ethnicity?: string
  }
  styleSettings: PhotoStyleSettings
  selfieKeys: string[]
  processedSelfies: Record<string, Buffer>
  selfieTypeMap?: Record<string, string>
  options: {
    workflowVersion?: 'v3'
  }
}

export interface GenerationPayload {
  prompt: string
  mustFollowRules: string[]
  freedomRules: string[]
  referenceImages: ReferenceImage[]
  labelInstruction?: string
  aspectRatio: string
  aspectRatioDescription: string
  faceComposite?: ReferenceImage
  bodyComposite?: ReferenceImage
  selfieComposite?: ReferenceImage
}

export interface EvaluationFeedback {
  status: 'Approved' | 'Not Approved'
  reason: string
  failedCriteria?: string[]
  suggestedAdjustments?: string
}

export interface Step7Output {
  refinedBuffer: Buffer
  allImageBuffers?: Buffer[]
  thinking?: string
}

export interface Step8Output {
  evaluation: EvaluationFeedback
}
