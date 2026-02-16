import { readFile as fsReadFile } from 'node:fs/promises'

import sharp from 'sharp'

import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai'
import type { Content, GenerateContentResult, Part, GenerativeModel, SafetySetting } from '@google-cloud/vertexai'

import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGeminiRest } from './gemini-rest'
import { isRateLimitError, isTransientServiceError } from '@/lib/rate-limit-retry'
import {
  MODEL_CONFIG,
  STAGE_MODEL,
  STAGE_RESOLUTION,
  DEFAULT_MODEL,
  PROVIDER_FALLBACK_ORDER,
  PROVIDER_DEFAULTS,
  getModelNameForProvider,
  type ModelName,
  type ModelProvider,
  type StageName,
} from './config'
import {
  assertValidModelName,
  extractTextFromResponseParts,
  extractThinkingTextParts,
  isGemini3ModelName,
  logGemini3Thinking,
  validateReferenceImages,
  type GeminiGenerationResult,
  type GeminiReferenceImage,
  type GeminiTextGenerationResult,
  type GeminiTextUsageMetadata,
  type GeminiUsageMetadata,
} from './gemini-shared'

export type {
  GeminiGenerationResult,
  GeminiReferenceImage,
  GeminiTextGenerationResult,
  GeminiTextUsageMetadata,
  GeminiUsageMetadata,
} from './gemini-shared'

const MODEL_CACHE = new Map<string, Promise<GenerativeModel>>()
let cachedProjectId: string | null = null

const CACHED_CREDENTIALS = {
  openrouter: !!Env.string('OPENROUTER_API_KEY', ''),
  vertex: !!Env.string('GOOGLE_APPLICATION_CREDENTIALS', ''),
  rest: !!Env.string('GOOGLE_CLOUD_API_KEY', '') || !!Env.string('GEMINI_API_KEY', ''),
  replicate: !!Env.string('REPLICATE_API_TOKEN', ''),
} as const

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
  const location = Env.string('GOOGLE_LOCATION', 'global')
  const cacheKey = `${location}:${normalizedModelName}`

  const cached = MODEL_CACHE.get(cacheKey)
  if (cached) {
    return cached
  }

  const modelPromise = (async () => {
    const projectId = await resolveProjectId()
    const vertexAI = new VertexAI({ project: projectId, location })

    try {
      const model = vertexAI.getGenerativeModel({ model: normalizedModelName })
      Logger.debug('Successfully initialized Vertex AI model', { modelName: normalizedModelName, location })
      return model
    } catch (error) {
      MODEL_CACHE.delete(cacheKey)
      Logger.error('Failed to initialize Vertex AI model', {
        modelName: normalizedModelName,
        location,
        error: error instanceof Error ? error.message : String(error),
        note: 'If using gemini-3-pro-image-preview, verify it is available in Vertex AI. It may only be available via REST API (ai.google.dev) currently.'
      })
      throw error
    }
  })()

  MODEL_CACHE.set(cacheKey, modelPromise)
  return modelPromise
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
 * Internal result type (without provider info)
 */
interface GeminiGenerationResultInternal {
  images: Buffer[]
  usage: GeminiUsageMetadata
  thinking?: string
}

/**
 * Normalize provider names to the values we persist in cost tracking
 */
function normalizeProvider(provider: ModelProvider): 'vertex' | 'gemini-rest' | 'replicate' | 'openrouter' {
  return provider === 'rest' ? 'gemini-rest' : provider
}

const GEMINI3_THINKING_CONFIG = {
  includeThoughts: true
} as const

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
function buildProviderOrder(model: ModelName): ModelProvider[] {
  // Get model config to check which providers support this model
  const modelConfig = MODEL_CONFIG[model]

  // Build provider list following PROVIDER_FALLBACK_ORDER
  // Only include providers that have credentials AND support this model
  const providers: ModelProvider[] = []

  for (const provider of PROVIDER_FALLBACK_ORDER) {
    const hasCredentials = CACHED_CREDENTIALS[provider]
    const modelSupported = modelConfig.providers[provider] !== null

    if (hasCredentials && modelSupported) {
      providers.push(provider)
    }
  }

  return providers
}

/**
 * When Gemini returns multiple images, sort by pixel count (largest first)
 * so images[0] is always the highest-resolution result.
 */
async function selectLargestImage(result: GeminiGenerationResult): Promise<GeminiGenerationResult> {
  if (result.images.length <= 1) return result

  const withMeta = await Promise.all(
    result.images.map(async (buf, idx) => {
      const meta = await sharp(buf).metadata()
      const pixels = (meta.width || 0) * (meta.height || 0)
      return { buf, idx, pixels, width: meta.width || 0, height: meta.height || 0 }
    })
  )

  withMeta.sort((a, b) => b.pixels - a.pixels)

  Logger.debug('Multiple images returned — sorted by resolution', {
    count: withMeta.length,
    dimensions: withMeta.map(m => `${m.width}x${m.height}`),
    selectedIndex: withMeta[0].idx,
  })

  return { ...result, images: withMeta.map(m => m.buf) }
}

function extensionFromMimeType(mimeType?: string): string {
  const normalized = (mimeType || '').toLowerCase()
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('webp')) return 'webp'
  if (normalized.includes('gif')) return 'gif'
  if (normalized.includes('bmp')) return 'bmp'
  return 'jpg'
}

function slugifyAttachmentName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\\/]/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function inferAttachmentName(image: GeminiReferenceImage, index: number): string {
  const extension = extensionFromMimeType(image.mimeType)
  const explicit = typeof image.name === 'string' ? image.name.trim() : ''

  if (explicit) {
    if (/\.[a-z0-9]+$/i.test(explicit)) return explicit
    return `${explicit}.${extension}`
  }

  const description = typeof image.description === 'string' ? image.description.trim() : ''
  if (description) {
    const quoted = description.match(/labeled\s+"([^"]+)"/i)?.[1] || description.match(/"([^"]+)"/)?.[1]
    const prefix = quoted || description.split(/[.:\-]/)[0]
    const slug = slugifyAttachmentName(prefix).slice(0, 64)
    if (slug) {
      return `${slug}.${extension}`
    }
  }

  return `reference-${index + 1}.${extension}`
}

function summarizeAttachment(
  image: GeminiReferenceImage,
  index: number
): {
  index: number
  name: string
  mimeType: string
  approxSizeKb: number
  description?: string
} {
  return {
    index: index + 1,
    name: inferAttachmentName(image, index),
    mimeType: image.mimeType,
    approxSizeKb: Math.round((image.base64.length * 0.75) / 1024),
    description: image.description ? image.description.substring(0, 140) : undefined,
  }
}

function logRequestAttachments(params: {
  requestType: 'image' | 'text'
  model: ModelName
  stage?: StageName
  prompt: string
  images: GeminiReferenceImage[]
}): void {
  const { requestType, model, stage, prompt, images } = params
  const attachments = images.map((image, index) => summarizeAttachment(image, index))

  Logger.info('Gemini request payload attachments', {
    requestType,
    model,
    stage,
    promptLength: prompt.length,
    attachmentCount: attachments.length,
    attachments,
  })
}

export async function generateWithGemini(
  prompt: string,
  images: GeminiReferenceImage[],
  aspectRatio?: string,
  resolution?: '1K' | '2K' | '4K',
  options?: GenerationOptions
): Promise<GeminiGenerationResult> {
  // Resolve model and resolution from stage config
  const model: ModelName = options?.stage
    ? STAGE_MODEL[options.stage]
    : DEFAULT_MODEL
  const effectiveResolution = resolution ?? (options?.stage ? STAGE_RESOLUTION[options.stage] : undefined)

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
  logRequestAttachments({
    requestType: 'image',
    model,
    stage: options?.stage,
    prompt,
    images,
  })

  // Try each provider in order, fallback on rate limit errors
  let lastError: unknown
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    const isLastProvider = i === providers.length - 1
    const providerUsed = normalizeProvider(provider)

    // Get the provider-specific model name
    const providerModelName = getModelNameForProvider(model, provider)
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
        const result = await generateWithGeminiVertex(prompt, images, providerModelName, aspectRatio, effectiveResolution, options)
        return await selectLargestImage({ ...result, providerUsed: 'vertex' })
      } else if (provider === 'rest') {
        Logger.debug(`Using Gemini REST API client (provider ${i + 1}/${providers.length})`, { providerModelName })
        const result = await generateWithGeminiRest(prompt, images, providerModelName, aspectRatio, effectiveResolution, convertToRestOptions(options))
        return await selectLargestImage({ ...result, providerUsed: 'gemini-rest' })
      } else if (provider === 'replicate') {
        Logger.debug(`Using Replicate API client (provider ${i + 1}/${providers.length})`, { providerModelName })
        const { generateWithGeminiReplicate } = await import('./gemini-replicate')
        const result = await generateWithGeminiReplicate(prompt, images, providerModelName, aspectRatio, effectiveResolution)
        return await selectLargestImage({ ...result, providerUsed: 'replicate' })
      } else if (provider === 'openrouter') {
        Logger.debug(`Using OpenRouter API client (provider ${i + 1}/${providers.length})`, { providerModelName })
        const { generateWithGeminiOpenRouter } = await import('./gemini-openrouter')
        const result = await generateWithGeminiOpenRouter(prompt, images, providerModelName, aspectRatio, effectiveResolution, options)
        return await selectLargestImage({ ...result, providerUsed: 'openrouter' })
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
        errorMessage.includes('OpenRouter returned no images') ||
        errorMessage.includes('returned no images') ||
        errorMessage.includes('returned no image URLs') || // Replicate error
        errorMessage.includes('IMAGE_OTHER')
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
  const providers = allProviders.filter(
    (provider): provider is Exclude<ModelProvider, 'replicate'> => provider !== 'replicate'
  )

  if (providers.length === 0) {
    throw new Error(
      `No Gemini API credentials configured for text model "${model}". Need one of: ` +
      'OPENROUTER_API_KEY (for OpenRouter), ' +
      'GOOGLE_CLOUD_API_KEY (for AI Studio REST), ' +
      'or GOOGLE_APPLICATION_CREDENTIALS (for Vertex AI)'
    )
  }

  Logger.debug('Text generation providers', { providers: providers.join(','), model, stage: options?.stage })
  logRequestAttachments({
    requestType: 'text',
    model,
    stage: options?.stage,
    prompt,
    images,
  })

  // Try each provider in order, fallback on rate limit errors
  let lastError: unknown
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    const isLastProvider = i === providers.length - 1
    const providerUsed = normalizeProvider(provider) as 'vertex' | 'gemini-rest' | 'openrouter'

    // Get the provider-specific model name
    const providerModelName = getModelNameForProvider(model, provider)
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

  const generationConfig: {
    temperature?: number
    topK?: number
    topP?: number
    thinkingConfig?: {
      includeThoughts?: boolean
    }
  } = {}
  if (options?.temperature !== undefined) generationConfig.temperature = options.temperature
  if (options?.topK !== undefined) generationConfig.topK = options.topK
  if (options?.topP !== undefined) generationConfig.topP = options.topP
  if (isGemini3ModelName(modelName)) generationConfig.thinkingConfig = GEMINI3_THINKING_CONFIG

  const TEXT_TIMEOUT_MS = 60000
  const response = await Promise.race([
    model.generateContent({
      contents,
      ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Vertex text request timed out after ${TEXT_TIMEOUT_MS}ms`)), TEXT_TIMEOUT_MS)
    ),
  ])

  const responseParts = response.response.candidates?.[0]?.content?.parts ?? []
  const thinkingTextParts = extractThinkingTextParts(
    responseParts as Array<{ text?: string; thought?: boolean }>
  )
  logGemini3Thinking({
    provider: 'vertex',
    modelName,
    texts: thinkingTextParts
  })
  const nonThoughtParts = responseParts as Array<{ text?: string; thought?: boolean }>
  const textPart = extractTextFromResponseParts(nonThoughtParts)
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
  assertValidModelName(modelName)

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`

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
    contents: [{ role: 'user', parts }],
  }

  const generationConfig: Record<string, unknown> = {}
  if (options?.temperature !== undefined) generationConfig.temperature = options.temperature
  if (options?.topK !== undefined) generationConfig.topK = options.topK
  if (options?.topP !== undefined) generationConfig.topP = options.topP
  if (isGemini3ModelName(modelName)) generationConfig.thinkingConfig = GEMINI3_THINKING_CONFIG

  if (Object.keys(generationConfig).length > 0) {
    requestBody.generationConfig = generationConfig
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini REST API error: ${response.status} ${errorText}`)
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
  }

  const responseParts = data.candidates?.[0]?.content?.parts ?? []
  const thinkingTextParts = extractThinkingTextParts(
    responseParts as Array<{ text?: string; thought?: boolean }>
  )
  logGemini3Thinking({
    provider: 'gemini-rest',
    modelName,
    texts: thinkingTextParts
  })
  const nonThoughtParts = responseParts as Array<{ text?: string; thought?: boolean }>
  const textPart = extractTextFromResponseParts(nonThoughtParts)

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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': Env.string('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
      'X-Title': 'TeamShots',
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId)
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

  validateReferenceImages(images, 'generateWithGeminiVertex')

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
    thinkingConfig?: {
      includeThoughts?: boolean
    }
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
  if (isGemini3ModelName(modelName)) generationConfig.thinkingConfig = GEMINI3_THINKING_CONFIG
  
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
    const IMAGE_TIMEOUT_MS = 120000
    const response: GenerateContentResult = await Promise.race([
      model.generateContent({
        contents,
        safetySettings,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(Object.keys(generationConfig).length > 0 ? { generationConfig: generationConfig as any } : {})
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Vertex image request timed out after ${IMAGE_TIMEOUT_MS}ms`)), IMAGE_TIMEOUT_MS)
      ),
    ])

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

    const thinkingTextParts = extractThinkingTextParts(
      responseParts as Array<{ text?: string; thought?: boolean }>
    )
    const thinking = logGemini3Thinking({
      provider: 'vertex',
      modelName: normalizedModelName,
      texts: thinkingTextParts
    })

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
      thinking,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorObject = error as {
      name?: unknown
      code?: unknown
      status?: unknown
      statusCode?: unknown
      statusText?: unknown
    }
    const errorDetails: Record<string, unknown> = {
      message: errorMessage,
      name: typeof errorObject?.name === 'string' ? errorObject.name : 'Unknown',
      code: errorObject?.code,
      status: errorObject?.status ?? errorObject?.statusCode,
      statusText: errorObject?.statusText,
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
      Logger.error('Gemini image generation rate limited (429)', {
        modelName,
        ...errorDetails
      })
    } else {
      Logger.error('Gemini image generation failed', {
        modelName,
        ...errorDetails
      })
    }

    throw error
  }
}
