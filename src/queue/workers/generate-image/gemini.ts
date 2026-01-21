import { readFile as fsReadFile } from 'node:fs/promises'

import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai'
import type { Content, GenerateContentResult, Part, GenerativeModel, SafetySetting } from '@google-cloud/vertexai'

import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGeminiRest } from './gemini-rest'
import { isRateLimitError, isTransientServiceError } from '@/lib/rate-limit-retry'
import {
  MODEL_CONFIG,
  STAGE_MODEL,
  DEFAULT_MODEL,
  PROVIDER_FALLBACK_ORDER,
  PROVIDER_DEFAULTS,
  getModelNameForProvider,
  type ModelName,
  type ModelProvider,
  type StageName,
} from './config'

export interface GeminiReferenceImage {
  mimeType: string
  base64: string
  description?: string
}

const MODEL_CACHE = new Map<string, GenerativeModel>()
let cachedProjectId: string | null = null
let cachedLocation: string | null = null

async function resolveProjectId(): Promise<string> {
  if (cachedProjectId) {
    return cachedProjectId
  }

  let projectId = Env.string('GOOGLE_PROJECT_ID', '')
  if (!projectId) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (credentialsPath) {
      try {
        const credentialsContent = await fsReadFile(credentialsPath, 'utf-8')
        const credentials = JSON.parse(credentialsContent) as { project_id?: string }
        if (credentials.project_id) {
          projectId = credentials.project_id
        }
      } catch (error) {
        Logger.warn('Failed to read project ID from service account credentials', {
          credentialsPath,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  if (!projectId) {
    throw new Error(
      'GOOGLE_PROJECT_ID is not set in environment and could not be extracted from GOOGLE_APPLICATION_CREDENTIALS. Please set GOOGLE_PROJECT_ID in your .env file or deployment environment variables.'
    )
  }

  cachedProjectId = projectId
  return projectId
}

export async function getVertexGenerativeModel(modelName: string): Promise<GenerativeModel> {
  // Use model name exactly as provided - trust .env values are correct
  const normalizedModelName = modelName.trim()

  const cached = MODEL_CACHE.get(normalizedModelName)
  if (cached) {
    return cached
  }

  const projectId = await resolveProjectId()
  const location = Env.string('GOOGLE_LOCATION', 'global')
  
  // Clear cache if location changed (models are location-specific)
  if (cachedLocation !== null && cachedLocation !== location) {
    Logger.warn('Location changed, clearing model cache', {
      oldLocation: cachedLocation,
      newLocation: location
    })
    MODEL_CACHE.clear()
  }
  cachedLocation = location
  
  
  const vertexAI = new VertexAI({ project: projectId, location })
  
  try {
    const model = vertexAI.getGenerativeModel({ model: normalizedModelName })
    MODEL_CACHE.set(normalizedModelName, model)
    Logger.debug('Successfully initialized Vertex AI model', { modelName: normalizedModelName, location })
    return model
  } catch (error) {
    Logger.error('Failed to initialize Vertex AI model', {
      modelName: normalizedModelName,
      location,
      error: error instanceof Error ? error.message : String(error),
      note: 'If using gemini-3-pro-image-preview, verify it is available in Vertex AI. It may only be available via REST API (ai.google.dev) currently.'
    })
    throw error
  }
}

export interface GenerationOptions {
  temperature?: number
  topK?: number
  topP?: number
  seed?: number
  safetySettings?: SafetySetting[]
  /**
   * Generation stage - determines which model to use from STAGE_MODEL config.
   * Providers are tried in PROVIDER_FALLBACK_ORDER, skipping those without
   * credentials or model support.
   */
  stage?: StageName
}

/**
 * Usage metadata returned from generation calls
 */
export interface GeminiUsageMetadata {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  imagesGenerated: number
  durationMs: number
}

/**
 * Usage metadata for text-only generation calls
 */
export interface GeminiTextUsageMetadata {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  durationMs: number
}

/**
 * Result of a text generation call with usage metadata
 */
export interface GeminiTextGenerationResult {
  text: string
  usage: GeminiTextUsageMetadata
  providerUsed: 'vertex' | 'gemini-rest' | 'openrouter'
}

/**
 * Internal result type (without provider info)
 */
interface GeminiGenerationResultInternal {
  images: Buffer[]
  usage: GeminiUsageMetadata
}

/**
 * Result of a generation call with usage metadata
 */
export interface GeminiGenerationResult extends GeminiGenerationResultInternal {
  providerUsed: 'vertex' | 'gemini-rest' | 'replicate' | 'openrouter'  // Track which provider actually succeeded
}

/**
 * Provider types for Gemini image generation
 */
type GeminiProvider = 'vertex' | 'rest' | 'replicate' | 'openrouter'

/**
 * Normalize provider names to the values we persist in cost tracking
 */
function normalizeProvider(provider: GeminiProvider): 'vertex' | 'gemini-rest' | 'replicate' | 'openrouter' {
  return provider === 'rest' ? 'gemini-rest' : provider
}

/**
 * Convert Vertex AI safety settings to REST API format
 */
function convertToRestOptions(options?: GenerationOptions) {
  if (!options) return undefined
  return {
    ...options,
    safetySettings: options.safetySettings?.map(setting => ({
      category: setting.category,
      threshold: (setting.threshold === HarmBlockThreshold.BLOCK_ONLY_HIGH ? 'BLOCK_ONLY_HIGH' :
                 setting.threshold === HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE ? 'BLOCK_MEDIUM_AND_ABOVE' :
                 setting.threshold === HarmBlockThreshold.BLOCK_LOW_AND_ABOVE ? 'BLOCK_LOW_AND_ABOVE' :
                 'BLOCK_NONE') as 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE' | 'BLOCK_NONE'
    }))
  }
}

/**
 * Build the ordered list of providers to try based on PROVIDER_FALLBACK_ORDER and available credentials.
 * Providers are tried in the order defined in config, skipping those without credentials or model support.
 * @param model The canonical model name from MODEL_CONFIG
 */
function buildProviderOrder(model: ModelName): GeminiProvider[] {
  // Check available credentials
  const credentials: Record<ModelProvider, boolean> = {
    openrouter: !!Env.string('OPENROUTER_API_KEY', ''),
    vertex: !!Env.string('GOOGLE_APPLICATION_CREDENTIALS', ''),
    rest: !!Env.string('GOOGLE_CLOUD_API_KEY', '') || !!Env.string('GEMINI_API_KEY', ''),
    replicate: !!Env.string('REPLICATE_API_TOKEN', ''),
  }

  // Get model config to check which providers support this model
  const modelConfig = MODEL_CONFIG[model]

  // Build provider list following PROVIDER_FALLBACK_ORDER
  // Only include providers that have credentials AND support this model
  const providers: GeminiProvider[] = []

  for (const provider of PROVIDER_FALLBACK_ORDER) {
    const hasCredentials = credentials[provider]
    const modelSupported = modelConfig.providers[provider] !== null

    if (hasCredentials && modelSupported) {
      providers.push(provider as GeminiProvider)
    }
  }

  return providers
}

export async function generateWithGemini(
  prompt: string,
  images: GeminiReferenceImage[],
  aspectRatio?: string,
  resolution?: '1K' | '2K' | '4K',
  options?: GenerationOptions
): Promise<GeminiGenerationResult> {
  // Resolve model from stage config, or use default
  const model: ModelName = options?.stage
    ? STAGE_MODEL[options.stage]
    : DEFAULT_MODEL

  // Build provider order based on PROVIDER_FALLBACK_ORDER from config
  const providers = buildProviderOrder(model)

  if (providers.length === 0) {
    throw new Error(
      `No Gemini API credentials configured for model "${model}". Need one of: ` +
      'OPENROUTER_API_KEY (for OpenRouter), ' +
      'GOOGLE_CLOUD_API_KEY (for AI Studio REST), ' +
      'GOOGLE_APPLICATION_CREDENTIALS (for Vertex AI - project_id is in the JSON), ' +
      'or REPLICATE_API_TOKEN (for Replicate)'
    )
  }

  // Only log provider config at debug level
  Logger.debug('Gemini providers', { providers: providers.join(','), model, stage: options?.stage })

  // Try each provider in order, fallback on rate limit errors
  let lastError: unknown
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    const isLastProvider = i === providers.length - 1
    const providerUsed = normalizeProvider(provider)

    // Get the provider-specific model name
    const providerModelName = getModelNameForProvider(model, provider as ModelProvider)
    if (!providerModelName) {
      Logger.warn(`Model ${model} not available on ${provider}, skipping`, { model, provider })
      continue
    }

    Logger.info(`Attempting provider ${i + 1}/${providers.length}`, {
      provider,
      providerUsed,
      model,
      providerModelName,
      isLastProvider
    })

    try {
      if (provider === 'vertex') {
        Logger.debug(`Using Vertex AI client (provider ${i + 1}/${providers.length})`, { providerModelName })
        const result = await generateWithGeminiVertex(prompt, images, providerModelName, aspectRatio, resolution, options)
        return { ...result, providerUsed: 'vertex' }
      } else if (provider === 'rest') {
        Logger.debug(`Using Gemini REST API client (provider ${i + 1}/${providers.length})`, { providerModelName })
        const result = await generateWithGeminiRest(prompt, images, providerModelName, aspectRatio, resolution, convertToRestOptions(options))
        return { ...result, providerUsed: 'gemini-rest' }
      } else if (provider === 'replicate') {
        Logger.debug(`Using Replicate API client (provider ${i + 1}/${providers.length})`, { providerModelName })
        const { generateWithGeminiReplicate } = await import('./gemini-replicate')
        const result = await generateWithGeminiReplicate(prompt, images, providerModelName, aspectRatio, resolution)
        return { ...result, providerUsed: 'replicate' }
      } else if (provider === 'openrouter') {
        Logger.debug(`Using OpenRouter API client (provider ${i + 1}/${providers.length})`, { providerModelName })
        const { generateWithGeminiOpenRouter } = await import('./gemini-openrouter')
        const result = await generateWithGeminiOpenRouter(prompt, images, providerModelName, aspectRatio, resolution, options)
        return { ...result, providerUsed: 'openrouter' }
      }
    } catch (error) {
      // Attach the attempted provider so failure tracking can log it correctly
      if (error && typeof error === 'object') {
        ;(error as { providerUsed?: 'vertex' | 'gemini-rest' | 'replicate' | 'openrouter' }).providerUsed = providerUsed
      }

      lastError = error
      const rateLimited = isRateLimitError(error)
      const serviceError = isTransientServiceError(error)

      // Check if this is a transient IMAGE_OTHER error from OpenRouter or Replicate
      // Be more defensive - check for "returned no images" OR "IMAGE_OTHER" in the message
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isImageOtherError = (
        (errorMessage.includes('OpenRouter returned no images') ||
         errorMessage.includes('returned no images') ||
         errorMessage.includes('returned no image URLs') || // Replicate error
         errorMessage.includes('IMAGE_OTHER')) &&
        (provider === 'openrouter' || provider === 'replicate')
      )

      // Check if this is a safety filter error - different providers have different thresholds
      const isSafetyError = (
        errorMessage.includes('flagged as sensitive') ||
        errorMessage.includes('SAFETY') ||
        errorMessage.includes('content policy') ||
        errorMessage.includes('blocked_reason') ||
        errorMessage.toLowerCase().includes('safety')
      )

      // Check if this is a geo-restriction or provider-specific limitation error
      // These are provider limitations, not terminal failures - should fallback to another provider
      const isGeoRestrictionError = (
        errorMessage.includes('not available in your country') ||
        errorMessage.includes('FAILED_PRECONDITION') ||
        errorMessage.includes('not available in your region') ||
        errorMessage.includes('geo-restricted')
      )

      Logger.info('Provider failed - checking fallback eligibility', {
        provider,
        providerUsed,
        model,
        providerModelName,
        rateLimited,
        serviceError,
        isImageOtherError,
        isSafetyError,
        isGeoRestrictionError,
        isLastProvider,
        errorMessage: error instanceof Error ? error.message.substring(0, 200) : String(error).substring(0, 200),
        willFallback: (rateLimited || serviceError || isImageOtherError || isSafetyError || isGeoRestrictionError) && !isLastProvider
      })

      // Fall back to next provider if rate limited OR service error OR transient image generation failure OR safety filter OR geo-restriction
      // (different providers have different thresholds and regional availability)
      if ((rateLimited || serviceError || isImageOtherError || isSafetyError || isGeoRestrictionError) && !isLastProvider) {
        const reason = rateLimited
          ? 'rate limited'
          : serviceError
            ? 'service unavailable (503)'
            : isGeoRestrictionError
              ? 'geo-restricted or not available in region'
              : isSafetyError
              ? 'content safety filter triggered'
              : 'returned no images (IMAGE_OTHER)'
        Logger.warn(`Provider ${reason}, falling back to next provider`, {
          provider,
          providerUsed,
          model,
          reason,
          attempt: i + 1,
          totalProviders: providers.length,
          nextProvider: providers[i + 1],
          errorMessage: error instanceof Error ? error.message : String(error)
        })
        continue // Try next provider
      }

      // If not a fallback-eligible error, or this is the last provider, throw immediately
      Logger.error('No fallback available - throwing error', {
        provider,
        providerUsed,
        model,
        isLastProvider,
        rateLimited,
        serviceError,
        isImageOtherError
      })
      throw error
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('All providers failed')
}

/**
 * Generate text response using Gemini with multi-provider fallback.
 * Used for evaluation steps that need text-only responses (not image generation).
 * Supports multi-modal input (text + images for evaluation).
 */
export async function generateTextWithGemini(
  prompt: string,
  images: GeminiReferenceImage[],
  options?: GenerationOptions
): Promise<GeminiTextGenerationResult> {
  // Resolve model from stage config, or use evaluation model as default
  const model: ModelName = options?.stage
    ? STAGE_MODEL[options.stage]
    : 'gemini-2.5-flash' // Default to text model for evaluation

  // Build provider order based on PROVIDER_FALLBACK_ORDER from config
  // Filter out replicate since it doesn't support text-only generation
  const allProviders = buildProviderOrder(model)
  const providers = allProviders.filter(p => p !== 'replicate') as Exclude<GeminiProvider, 'replicate'>[]

  if (providers.length === 0) {
    throw new Error(
      `No Gemini API credentials configured for text model "${model}". Need one of: ` +
      'OPENROUTER_API_KEY (for OpenRouter), ' +
      'GOOGLE_CLOUD_API_KEY (for AI Studio REST), ' +
      'or GOOGLE_APPLICATION_CREDENTIALS (for Vertex AI)'
    )
  }

  Logger.debug('Text generation providers', { providers: providers.join(','), model, stage: options?.stage })

  // Try each provider in order, fallback on rate limit errors
  let lastError: unknown
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    const isLastProvider = i === providers.length - 1
    const providerUsed = normalizeProvider(provider) as 'vertex' | 'gemini-rest' | 'openrouter'

    // Get the provider-specific model name
    const providerModelName = getModelNameForProvider(model, provider as ModelProvider)
    if (!providerModelName) {
      Logger.warn(`Model ${model} not available on ${provider}, skipping`, { model, provider })
      continue
    }

    Logger.debug(`Text gen: Attempting provider ${i + 1}/${providers.length}`, {
      provider,
      providerUsed,
      model,
      providerModelName,
    })

    try {
      if (provider === 'vertex') {
        const result = await generateTextWithGeminiVertex(prompt, images, providerModelName, options)
        return { ...result, providerUsed: 'vertex' }
      } else if (provider === 'rest') {
        const result = await generateTextWithGeminiRestInternal(prompt, images, providerModelName, options)
        return { ...result, providerUsed: 'gemini-rest' }
      } else if (provider === 'openrouter') {
        const result = await generateTextWithGeminiOpenRouterInternal(prompt, images, providerModelName, options)
        return { ...result, providerUsed: 'openrouter' }
      }
    } catch (error) {
      lastError = error
      const rateLimited = isRateLimitError(error)
      const serviceError = isTransientServiceError(error)

      Logger.info('Text gen provider failed - checking fallback', {
        provider,
        model,
        rateLimited,
        serviceError,
        isLastProvider,
        errorMessage: error instanceof Error ? error.message.substring(0, 200) : String(error).substring(0, 200),
      })

      if ((rateLimited || serviceError) && !isLastProvider) {
        Logger.warn(`Text gen provider ${rateLimited ? 'rate limited' : 'service error'}, falling back`, {
          provider,
          nextProvider: providers[i + 1],
        })
        continue
      }

      throw error
    }
  }

  throw lastError || new Error('All text generation providers failed')
}

/**
 * Generate text using Vertex AI directly
 */
async function generateTextWithGeminiVertex(
  prompt: string,
  images: GeminiReferenceImage[],
  modelName: string,
  options?: GenerationOptions
): Promise<Omit<GeminiTextGenerationResult, 'providerUsed'>> {
  const startTime = Date.now()
  const model = await getVertexGenerativeModel(modelName)

  const parts: Part[] = [{ text: prompt }]
  for (const image of images) {
    if (image.description) {
      parts.push({ text: image.description })
    }
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
  }

  const contents: Content[] = [{ role: 'user', parts }]

  const generationConfig: { temperature?: number; topK?: number; topP?: number } = {}
  if (options?.temperature !== undefined) generationConfig.temperature = options.temperature
  if (options?.topK !== undefined) generationConfig.topK = options.topK
  if (options?.topP !== undefined) generationConfig.topP = options.topP

  const response = await model.generateContent({
    contents,
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  })

  const responseParts = response.response.candidates?.[0]?.content?.parts ?? []
  const textPart = responseParts.find((part) => Boolean(part.text))?.text ?? ''
  const usageMetadata = response.response.usageMetadata

  return {
    text: textPart,
    usage: {
      inputTokens: usageMetadata?.promptTokenCount,
      outputTokens: usageMetadata?.candidatesTokenCount,
      totalTokens: usageMetadata?.totalTokenCount,
      durationMs: Date.now() - startTime,
    },
  }
}

/**
 * Generate text using Gemini REST API
 */
async function generateTextWithGeminiRestInternal(
  prompt: string,
  images: GeminiReferenceImage[],
  modelName: string,
  options?: GenerationOptions
): Promise<Omit<GeminiTextGenerationResult, 'providerUsed'>> {
  const startTime = Date.now()
  const apiKey = Env.string('GOOGLE_CLOUD_API_KEY', '') || Env.string('GEMINI_API_KEY', '')
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY or GEMINI_API_KEY required for REST API')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt }
  ]
  for (const image of images) {
    if (image.description) {
      parts.push({ text: image.description })
    }
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
  }

  const requestBody: Record<string, unknown> = {
    contents: [{ parts }],
  }

  if (options?.temperature !== undefined || options?.topK !== undefined || options?.topP !== undefined) {
    requestBody.generationConfig = {
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.topK !== undefined && { topK: options.topK }),
      ...(options.topP !== undefined && { topP: options.topP }),
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini REST API error: ${response.status} ${errorText}`)
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
  }

  const textPart = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? ''

  return {
    text: textPart,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      totalTokens: data.usageMetadata?.totalTokenCount,
      durationMs: Date.now() - startTime,
    },
  }
}

/**
 * Generate text using OpenRouter API
 */
async function generateTextWithGeminiOpenRouterInternal(
  prompt: string,
  images: GeminiReferenceImage[],
  modelName: string,
  options?: GenerationOptions
): Promise<Omit<GeminiTextGenerationResult, 'providerUsed'>> {
  const startTime = Date.now()
  const apiKey = Env.string('OPENROUTER_API_KEY', '')
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY required for OpenRouter')
  }

  // Build multimodal content
  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    { type: 'text', text: prompt }
  ]

  for (const image of images) {
    if (image.description) {
      content.push({ type: 'text', text: image.description })
    }
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` }
    })
  }

  const requestBody: Record<string, unknown> = {
    model: modelName,
    messages: [{ role: 'user', content }],
    stream: false,
  }

  if (options?.temperature !== undefined) requestBody.temperature = options.temperature
  if (options?.topP !== undefined) requestBody.top_p = options.topP
  if (options?.topK !== undefined) requestBody.top_k = options.topK

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': Env.string('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
      'X-Title': 'TeamShots',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`)
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }

  const textContent = data.choices?.[0]?.message?.content ?? ''

  // Throw error on empty response so fallback can kick in
  if (!textContent) {
    throw new Error('OpenRouter API error: 503 Empty response - no text content returned')
  }

  return {
    text: textContent,
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
      durationMs: Date.now() - startTime,
    },
  }
}

async function generateWithGeminiVertex(
  prompt: string,
  images: GeminiReferenceImage[],
  modelName: string,
  aspectRatio?: string,
  resolution?: '1K' | '2K' | '4K',
  options?: GenerationOptions
): Promise<GeminiGenerationResultInternal> {
  const startTime = Date.now()
  // Validate images before sending
  if (!images || images.length === 0) {
    Logger.error('generateWithGeminiVertex: No reference images provided!', {
      modelName,
      imagesCount: images?.length || 0
    })
    throw new Error('No reference images provided to Gemini API')
  }

  // Validate each image has required fields
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    if (!img.base64 || !img.mimeType) {
      Logger.error('generateWithGeminiVertex: Invalid reference image', {
        index: i,
        hasBase64: !!img.base64,
        hasMimeType: !!img.mimeType,
        description: img.description?.substring(0, 100)
      })
      throw new Error(`Reference image at index ${i} is missing base64 or mimeType`)
    }
  }

  const model = await getVertexGenerativeModel(modelName)

  const parts: Part[] = [{ text: prompt }]
  for (const image of images) {
    if (image.description) {
      parts.push({ text: image.description })
    }
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
  }

  Logger.debug('Sending Gemini Vertex AI request', {
    modelName,
    partsCount: parts.length,
    hasTextPrompt: parts.some(p => 'text' in p),
    imageCount: parts.filter(p => 'inlineData' in p).length,
    imageDetails: images.map((img, idx) => ({
      index: idx,
      mimeType: img.mimeType,
      base64Length: img.base64?.length || 0,
      description: img.description?.substring(0, 80) || 'NO_DESCRIPTION'
    })),
    hasAspectRatio: !!aspectRatio,
    hasResolution: !!resolution
  })

  const contents: Content[] = [
    {
      role: 'user',
      parts
    }
  ]

  // Build generation config with imageConfig if aspectRatio or resolution is provided
  // Note: Resolution is primarily supported by Gemini 3 Pro Image Preview models
  // Vertex AI API uses camelCase (imageSize) to match aspectRatio pattern
  const normalizedModelName = modelName.toLowerCase()
  const supportsResolution = normalizedModelName.includes('gemini-3-pro-image') || 
                             normalizedModelName.includes('gemini-3-pro-image-preview')
  
  const generationConfig: {
    temperature?: number
    topK?: number
    topP?: number
    candidateCount?: number
    imageConfig?: {
      aspectRatio?: string
      imageSize?: '1K' | '2K' | '4K'
      denoisingStrength?: number
    }
  } = {}
  
  // Add generation parameters if provided
  if (options?.temperature !== undefined) generationConfig.temperature = options.temperature
  if (options?.topK !== undefined) generationConfig.topK = options.topK
  if (options?.topP !== undefined) generationConfig.topP = options.topP
  
  // Apply resolution using default from PROVIDER_DEFAULTS if not explicitly provided
  const effectiveResolution = resolution ?? PROVIDER_DEFAULTS.vertex.resolution

  if (aspectRatio || supportsResolution) {
    generationConfig.imageConfig = {}
    if (aspectRatio) {
      generationConfig.imageConfig.aspectRatio = aspectRatio
    }
    if (supportsResolution) {
      generationConfig.imageConfig.imageSize = effectiveResolution
    }
  }

  // Default safety settings - permissive to match likely AI Studio behavior for creative tasks
  // Unless overridden by options
  const defaultSafetySettings: SafetySetting[] = [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
  ]

  const safetySettings = options?.safetySettings || defaultSafetySettings

  // Log request structure for debugging (without sensitive data)
  Logger.debug('Sending Gemini image generation request', {
    modelName: normalizedModelName,
    partsCount: parts.length,
    hasTextPrompt: parts.some(p => 'text' in p),
    imageCount: parts.filter(p => 'inlineData' in p).length,
    hasAspectRatio: !!aspectRatio,
    hasResolution: !!resolution,
    generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
  })

  try {
    const response: GenerateContentResult = await model.generateContent({
      contents,
      safetySettings,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(Object.keys(generationConfig).length > 0 ? { generationConfig: generationConfig as any } : {})
    })

    const candidate = response.response.candidates?.[0]
    const finishReason = candidate?.finishReason ? String(candidate.finishReason) : undefined
    const safetyRatings = candidate?.safetyRatings
    const responseParts = candidate?.content?.parts ?? []
    const generatedImages: Buffer[] = []
    for (const part of responseParts) {
      if (part.inlineData?.data) {
        generatedImages.push(Buffer.from(part.inlineData.data, 'base64'))
      }
    }

    // Extract usage metadata if available
    const usageMetadata = response.response.usageMetadata
    const durationMs = Date.now() - startTime

    const usage: GeminiUsageMetadata = {
      inputTokens: usageMetadata?.promptTokenCount,
      outputTokens: usageMetadata?.candidatesTokenCount,
      totalTokens: usageMetadata?.totalTokenCount,
      imagesGenerated: generatedImages.length,
      durationMs,
    }

    Logger.debug('Gemini Vertex AI generation completed', {
      modelName: normalizedModelName,
      imagesGenerated: generatedImages.length,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      durationMs,
      finishReason: finishReason || 'SUCCESS',
    })

    // If no images were generated, log detailed error and throw
    if (generatedImages.length === 0) {
      Logger.error('Gemini Vertex AI returned no images - inspecting response', {
        modelName: normalizedModelName,
        finishReason: finishReason || 'UNKNOWN',
        safetyRatings: safetyRatings ? JSON.stringify(safetyRatings) : undefined,
        hasCandidates: !!response.response.candidates,
        candidatesLength: response.response.candidates?.length,
        hasContent: !!candidate?.content,
        hasParts: !!candidate?.content?.parts,
        partsLength: candidate?.content?.parts?.length,
        promptLength: prompt.length,
        imageCount: images.length,
        aspectRatio,
        resolution,
      })

      const finishReasonStr = finishReason || 'UNKNOWN'
      const errorMessage = finishReasonStr === 'IMAGE_OTHER'
        ? `Gemini Vertex AI failed to generate image (IMAGE_OTHER finish reason). This typically indicates the model encountered an issue processing the prompt or reference images. Model: ${normalizedModelName}, AspectRatio: ${aspectRatio}, Resolution: ${resolution}. Prompt length: ${prompt.length} chars, Reference images: ${images.length}.`
        : `Gemini Vertex AI returned no images. Model: ${normalizedModelName}, FinishReason: ${finishReasonStr}, AspectRatio: ${aspectRatio}, Resolution: ${resolution}. Check logs for response structure details.`
      
      throw new Error(errorMessage)
    }

    return {
      images: generatedImages,
      usage,
    }
  } catch (error) {
    // Extract comprehensive error details
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Build detailed error info
    const errorDetails: Record<string, unknown> = {
      message: errorMessage,
      name: error instanceof Error ? error.name : 'Unknown',
      stack: errorStack,
    }
    
    // Extract all enumerable properties from error object
    if (error && typeof error === 'object') {
      // Capture common error properties
      if ('status' in error) errorDetails.status = error.status
      if ('statusCode' in error) errorDetails.statusCode = error.statusCode
      if ('statusText' in error) errorDetails.statusText = error.statusText
      if ('code' in error) errorDetails.code = error.code
      if ('response' in error) {
        try {
          // Try to stringify response, but handle circular refs
          const responseStr = typeof error.response === 'string' 
            ? error.response 
            : JSON.stringify(error.response, null, 2)
          errorDetails.response = responseStr.length > 2000 
            ? responseStr.substring(0, 2000) + '...[truncated]' 
            : responseStr
        } catch {
          errorDetails.response = String(error.response).substring(0, 2000)
        }
      }
      if ('cause' in error) {
        try {
          errorDetails.cause = typeof error.cause === 'string'
            ? error.cause
            : JSON.stringify(error.cause, null, 2)
        } catch {
          errorDetails.cause = String(error.cause)
        }
      }
      if ('details' in error) {
        try {
          errorDetails.details = typeof error.details === 'string'
            ? error.details
            : JSON.stringify(error.details, null, 2)
        } catch {
          errorDetails.details = String(error.details)
        }
      }
      
      // Capture any other enumerable properties
      for (const [key, value] of Object.entries(error)) {
        if (!['message', 'name', 'stack'].includes(key) && !(key in errorDetails)) {
          try {
            errorDetails[key] = typeof value === 'string' 
              ? value 
              : JSON.stringify(value, null, 2)
          } catch {
            errorDetails[key] = String(value)
          }
        }
      }
    }
    
    // Check if this is a JSON parsing error (likely HTML response)
    if (errorMessage.includes('Unexpected token') && (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('<!doctype'))) {
      const location = Env.string('GOOGLE_LOCATION', 'global')
      
      // Log full error details
      Logger.error('Vertex AI returned HTML instead of JSON - possible location/endpoint issue', {
        modelName,
        location,
        ...errorDetails,
        suggestion: location === 'global' 
          ? 'The "global" location may not be supported by the Vertex AI SDK. Try using a regional location like "us-central1" instead.'
          : 'Verify that the location and model are available in your project.'
      })
      
      // Also log to console with full details for debugging
      console.error('\n=== FULL ERROR DETAILS ===')
      console.error('Error Object:', error)
      console.error('Error Details:', JSON.stringify(errorDetails, null, 2))
      console.error('========================\n')
      
      throw new Error(
        `Vertex AI API error: Received HTML response instead of JSON. ` +
        `This may indicate an invalid location or endpoint configuration. ` +
        `Current location: "${location}". ` +
        `If using "global", try switching to a regional location like "us-central1". ` +
        `Original error: ${errorMessage}`
      )
    }
    
    // Check if this is a rate limit error (429) - filter out stack trace
    const isRateLimit = isRateLimitError(error)
    
    if (isRateLimit) {
      // For rate limit errors, log without stack trace
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { stack, ...errorDetailsWithoutStack } = errorDetails
      Logger.error('Gemini image generation rate limited (429)', {
        modelName,
        ...errorDetailsWithoutStack
      })
    } else {
      // Log all other errors with full details
      Logger.error('Gemini image generation failed', {
        modelName,
        ...errorDetails
      })
      
      // Also log to console for full visibility (only for non-rate-limit errors)
      console.error('\n=== FULL ERROR DETAILS ===')
      console.error('Error Object:', error)
      console.error('Error Details:', JSON.stringify(errorDetails, null, 2))
      console.error('========================\n')
    }

    throw error
  }
}


