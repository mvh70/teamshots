import { Logger } from '@/lib/logger'

export interface GeminiReferenceImage {
  name?: string
  mimeType: string
  base64: string
  description?: string
}

export interface GeminiUsageMetadata {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  imagesGenerated: number
  durationMs: number
}

export interface GeminiTextUsageMetadata {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  durationMs: number
}

export interface GeminiGenerationResult {
  images: Buffer[]
  usage: GeminiUsageMetadata
  providerUsed: 'vertex' | 'gemini-rest' | 'replicate' | 'openrouter'
  thinking?: string
}

export interface GeminiTextGenerationResult {
  text: string
  usage: GeminiTextUsageMetadata
  providerUsed: 'vertex' | 'gemini-rest' | 'openrouter'
}

export function isGemini3ModelName(modelName: string): boolean {
  return modelName.toLowerCase().includes('gemini-3')
}

export function extractThinkingTextParts(
  parts: Array<{ text?: string; thought?: boolean }>
): string[] {
  const allTextParts = parts
    .map((part) => part.text)
    .filter((text): text is string => Boolean(text && text.trim().length > 0))

  const thoughtParts = parts
    .filter((part) => part.thought === true)
    .map((part) => part.text)
    .filter((text): text is string => Boolean(text && text.trim().length > 0))

  return thoughtParts.length > 0 ? thoughtParts : allTextParts
}

export function logGemini3Thinking({
  provider,
  modelName,
  texts,
}: {
  provider: 'vertex' | 'gemini-rest' | 'openrouter'
  modelName: string
  texts: string[]
}): string | undefined {
  if (!isGemini3ModelName(modelName)) return undefined
  if (!texts.length) return undefined

  const combined = texts.join('\n\n').trim()
  if (!combined) return undefined

  const maxChars = process.env.NODE_ENV === 'production' ? 500 : 12000
  const truncated = combined.length > maxChars
  const thinkingText = truncated ? `${combined.substring(0, maxChars)}...(truncated)` : combined

  Logger.debug('Gemini-3 thinking output', {
    provider,
    modelName,
    textParts: texts.length,
    thinkingLength: combined.length,
    truncated,
    thinking: thinkingText,
  })

  return combined
}

export function validateReferenceImages(images: GeminiReferenceImage[], source: string): void {
  for (let i = 0; i < images.length; i += 1) {
    const image = images[i]
    if (!image || typeof image !== 'object') {
      throw new Error(`${source}: reference image at index ${i} is not an object`)
    }
    if (!image.base64 || typeof image.base64 !== 'string') {
      throw new Error(`${source}: reference image at index ${i} is missing base64`)
    }
    if (!image.mimeType || typeof image.mimeType !== 'string') {
      throw new Error(`${source}: reference image at index ${i} is missing mimeType`)
    }
  }
}

export function extractTextFromResponseParts(
  parts: Array<{ text?: string; thought?: boolean }>
): string {
  return parts.filter((part) => !part.thought).find((part) => Boolean(part.text))?.text ?? ''
}

export function assertValidModelName(modelName: string): void {
  if (!/^[a-zA-Z0-9._-]+$/.test(modelName)) {
    throw new Error(`Invalid model name: ${modelName}`)
  }
}
