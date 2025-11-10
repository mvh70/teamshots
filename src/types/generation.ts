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

export interface GenerationAssets {
  downloadSelfie: DownloadSelfieFn
  downloadAsset: DownloadAssetFn
  preprocessSelfie: (selfieKey: string) => Promise<Buffer>
}

export interface GenerationContext {
  generationId: string
  personId: string
  userId?: string | null
  prompt?: string | null
  styleSettings: PhotoStyleSettings
  selfieKeys: string[]
  primarySelfieKey: string
  processedSelfies: Record<string, Buffer>
  options: {
    useCompositeReference: boolean
  }
  assets: GenerationAssets
}

export interface GenerationPayload {
  prompt: string
  referenceImages: ReferenceImage[]
  labelInstruction: string
  aspectRatio: string
  aspectRatioDescription: string
}

