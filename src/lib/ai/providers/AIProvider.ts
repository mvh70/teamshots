/**
 * AI Provider Abstraction Layer
 * 
 * This interface allows swapping between different AI providers (Gemini, OpenAI, Stability, etc.)
 * without changing the core generation logic.
 */

export interface AIProviderConfig {
  apiKey: string
  model?: string
  timeout?: number
  maxRetries?: number
}

export interface GenerateImageInput {
  selfieUrl: string
  prompt: string
  options?: {
    aspectRatio?: string
    numVariations?: number
    style?: string
    negativePrompt?: string
    seed?: number
    [key: string]: unknown
  }
}

export interface GeneratedImage {
  url: string
  s3Key?: string
  metadata?: {
    seed?: number
    prompt?: string
    model?: string
    [key: string]: unknown
  }
}

export interface ProviderResult {
  success: boolean
  images: GeneratedImage[]
  cost?: number // USD cost for this generation
  metadata?: {
    provider: string
    model: string
    duration?: number // milliseconds
    tokensUsed?: number
    [key: string]: unknown
  }
  error?: AIProviderError
}

export interface AIProviderError {
  code: string
  message: string
  retryable: boolean
  originalError?: unknown
}

export abstract class AIProvider {
  protected config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.config = config
  }

  /**
   * Generate images based on input selfie and prompt
   */
  abstract generateImage(input: GenerateImageInput): Promise<ProviderResult>

  /**
   * Check if the provider is properly configured and accessible
   */
  abstract healthCheck(): Promise<boolean>

  /**
   * Get provider name
   */
  abstract getProviderName(): string

  /**
   * Normalize provider-specific errors to common format
   */
  protected normalizeError(error: unknown): AIProviderError {
    // Default implementation - should be overridden by specific providers
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      code: 'UNKNOWN_ERROR',
      message: errorMessage || 'An unknown error occurred',
      retryable: false,
      originalError: error
    }
  }
}

