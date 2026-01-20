import { PhotoStyleSettings } from './photo-style'

export type DownloadSelfieFn = (key: string) => Promise<{ base64: string; mimeType: string }>

export type DownloadAssetFn = (
  key: string
) => Promise<{ base64: string; mimeType: string } | null>

export interface ReferenceImage {
  mimeType: string
  base64: string
  description?: string
}


export interface GenerationContext {
  generationId: string
  personId: string
  userId?: string | null
  prompt?: string | null
  styleSettings: PhotoStyleSettings
  selfieKeys: string[]
  processedSelfies: Record<string, Buffer>
  selfieTypeMap?: Record<string, string> // Map of S3 key to selfie type for split composites
  options: {
    workflowVersion?: 'v3' // Workflow version to determine labelInstruction generation
  }
}

export interface GenerationPayload {
  prompt: string // JSON only (no rules)
  mustFollowRules: string[] // Must follow rules from elements
  freedomRules: string[] // Freedom rules from elements
  referenceImages: ReferenceImage[]
  labelInstruction?: string // Optional for V3 (V3 builds its own prompt structure)
  aspectRatio: string
  aspectRatioDescription: string
  // Split selfie composites for focused reference
  faceComposite?: ReferenceImage // Face-focused composite (front_view + side_view selfies)
  bodyComposite?: ReferenceImage // Body-focused composite (partial_body + full_body selfies)
  selfieComposite?: ReferenceImage // Combined fallback composite
}

// V2 Workflow Types

export interface EvaluationFeedback {
  status: 'Approved' | 'Not Approved'
  reason: string
  failedCriteria?: string[]
  suggestedAdjustments?: string
}

export interface Step1Input {
  selfieReferences: ReferenceImage[]
  basePrompt: string
  styleSettings: PhotoStyleSettings
  logoReference?: ReferenceImage
  aspectRatio: string
  resolution?: '1K' | '2K' | '4K'
}

export interface Step1Output {
  personBuffer: Buffer
  personBase64: string
  personPrompt: string
}

export interface Step2Input {
  personBuffer: Buffer
  personBase64: string
  selfieReferences: ReferenceImage[]
  generationPrompt: string
  logoReference?: ReferenceImage
  brandingPosition?: string
}

export interface Step2Output {
  evaluation: EvaluationFeedback
}

export interface Step3Input {
  styleSettings: PhotoStyleSettings
  basePrompt: string
  downloadAsset: DownloadAssetFn
}

export interface Step3Output {
  backgroundBuffer?: Buffer
  backgroundInstructions?: string
  logoBuffer?: Buffer
}

export interface Step4Input {
  backgroundBuffer?: Buffer
  backgroundInstructions?: string
  logoBuffer?: Buffer
  brandingPosition?: string
}

export interface Step4Output {
  isValid: boolean
  reason?: string
}

export interface Step5Input {
  personBuffer: Buffer
  backgroundBuffer?: Buffer
  backgroundInstructions?: string
  logoBuffer?: Buffer
  basePrompt: string
  aspectRatio: string
  aspectRatioDescription: string
  expectedWidth: number
  expectedHeight: number
  resolution?: '1K' | '2K' | '4K'
  styleSettings?: PhotoStyleSettings
  shotDescription?: string
}

export interface Step5Output {
  compositionBuffer: Buffer
  compositionBase64: string
}

export interface Step6Input {
  compositionBuffer: Buffer
  compositionBase64: string
  personReference: ReferenceImage
  backgroundReference?: ReferenceImage
  logoReference?: ReferenceImage
  generationPrompt: string
}

export interface Step6Output {
  evaluation: EvaluationFeedback
}

export interface Step7Input {
  compositionBuffer: Buffer
  selfieReferences: ReferenceImage[]
  aspectRatio: string
  resolution?: '1K' | '2K' | '4K'
}

export interface Step7Output {
  refinedBuffer: Buffer
  refinedBase64: string
  allImageBuffers?: Buffer[] // All images returned by the model (for debugging)
}

export interface Step8Input {
  refinedBuffer: Buffer
  refinedBase64: string
  selfieReferences: ReferenceImage[]
  expectedWidth: number
  expectedHeight: number
  aspectRatio: string
}

export interface Step8Output {
  evaluation: EvaluationFeedback
}

export interface RetryContext {
  attempt: number
  maxAttempts: number
  previousFeedback?: EvaluationFeedback
}

