import { readFile as fsReadFile } from 'node:fs/promises'

import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai'
import type { Content, GenerateContentResult, Part, GenerativeModel, SafetySetting } from '@google-cloud/vertexai'

import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGeminiRest } from './gemini-rest'
import { isRateLimitError } from '@/lib/rate-limit-retry'

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
   * Preferred provider for this generation.
   * If not available or fails, will fall back to other providers.
   * Use for load balancing: e.g., Step 1a -> 'vertex', Step 1b -> 'openrouter'
   */
  preferredProvider?: 'openrouter' | 'vertex' | 'rest' | 'replicate'
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
 * Build the ordered list of providers to try based on configuration and available credentials
 * @param preferredProvider Optional provider to prioritize first (for load balancing)
 */
function buildProviderOrder(preferredProvider?: GeminiProvider): GeminiProvider[] {
  const hasApiKey = !!Env.string('GOOGLE_CLOUD_API_KEY', '')
  // GOOGLE_APPLICATION_CREDENTIALS JSON file contains project_id, so we only need to check for that
  const hasServiceAccount = !!Env.string('GOOGLE_APPLICATION_CREDENTIALS', '')
  const hasReplicate = !!Env.string('REPLICATE_API_TOKEN', '')
  const hasOpenRouter = !!Env.string('OPENROUTER_API_KEY', '')

  // Use preferred provider if specified, otherwise use env var default
  const primaryProvider = preferredProvider ?? (Env.string('GEMINI_PRIMARY_PROVIDER', 'openrouter') as GeminiProvider)
  const providers: GeminiProvider[] = []

  // Add primary provider first if available
  if (primaryProvider === 'openrouter' && hasOpenRouter) {
    providers.push('openrouter')
  } else if (primaryProvider === 'vertex' && hasServiceAccount) {
    providers.push('vertex')
  } else if (primaryProvider === 'rest' && hasApiKey) {
    providers.push('rest')
  } else if (primaryProvider === 'replicate' && hasReplicate) {
    providers.push('replicate')
  }

  // Add remaining providers as fallbacks (in order of preference)
  if (!providers.includes('openrouter') && hasOpenRouter) {
    providers.push('openrouter')
  }
  if (!providers.includes('vertex') && hasServiceAccount) {
    providers.push('vertex')
  }
  if (!providers.includes('rest') && hasApiKey) {
    providers.push('rest')
  }
  if (!providers.includes('replicate') && hasReplicate) {
    providers.push('replicate')
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
  // Use preferred provider if specified, otherwise use default order
  const providers = options?.preferredProvider
    ? buildProviderOrder(options.preferredProvider)
    : buildProviderOrder()

  if (providers.length === 0) {
    throw new Error(
      'No Gemini API credentials configured. Need one of: ' +
      'OPENROUTER_API_KEY (for OpenRouter), ' +
      'GOOGLE_CLOUD_API_KEY (for AI Studio REST), ' +
      'GOOGLE_APPLICATION_CREDENTIALS (for Vertex AI - project_id is in the JSON), ' +
      'or REPLICATE_API_TOKEN (for Replicate)'
    )
  }

  Logger.debug('Gemini providers configured', {
    providers,
    primaryProvider: providers[0],
    preferredProvider: options?.preferredProvider,
    fallbackCount: providers.length - 1
  })
  
  // Try each provider in order, fallback on rate limit errors
  let lastError: unknown
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    const isLastProvider = i === providers.length - 1
    const providerUsed = normalizeProvider(provider)
    
    try {
      if (provider === 'vertex') {
        Logger.debug(`Using Vertex AI client (provider ${i + 1}/${providers.length})`)
        const result = await generateWithGeminiVertex(prompt, images, aspectRatio, resolution, options)
        return { ...result, providerUsed: 'vertex' }
      } else if (provider === 'rest') {
        Logger.debug(`Using Gemini REST API client (provider ${i + 1}/${providers.length})`)
        const result = await generateWithGeminiRest(prompt, images, aspectRatio, resolution, convertToRestOptions(options))
        return { ...result, providerUsed: 'gemini-rest' }
      } else if (provider === 'replicate') {
        Logger.debug(`Using Replicate API client (provider ${i + 1}/${providers.length})`)
        const { generateWithGeminiReplicate } = await import('./gemini-replicate')
        const result = await generateWithGeminiReplicate(prompt, images, aspectRatio, resolution)
        return { ...result, providerUsed: 'replicate' }
      } else if (provider === 'openrouter') {
        Logger.debug(`Using OpenRouter API client (provider ${i + 1}/${providers.length})`)
        const { generateWithGeminiOpenRouter } = await import('./gemini-openrouter')
        const result = await generateWithGeminiOpenRouter(prompt, images, aspectRatio, resolution, options)
        return { ...result, providerUsed: 'openrouter' }
      }
    } catch (error) {
      // Attach the attempted provider so failure tracking can log it correctly
      if (error && typeof error === 'object') {
        ;(error as { providerUsed?: 'vertex' | 'gemini-rest' | 'replicate' }).providerUsed = providerUsed
      }

      lastError = error
      const rateLimited = isRateLimitError(error)
      
      if (rateLimited && !isLastProvider) {
        Logger.warn('Provider rate limited, falling back to next provider', {
          provider,
          attempt: i + 1,
          totalProviders: providers.length,
          nextProvider: providers[i + 1]
        })
        continue // Try next provider
      }
      
      // If not rate limit, or this is the last provider, throw immediately
      throw error
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('All providers failed')
}

async function generateWithGeminiVertex(
  prompt: string,
  images: GeminiReferenceImage[],
  aspectRatio?: string,
  resolution?: '1K' | '2K' | '4K',
  options?: GenerationOptions
): Promise<GeminiGenerationResultInternal> {
  const startTime = Date.now()
  // Validate images before sending
  if (!images || images.length === 0) {
    Logger.error('generateWithGeminiVertex: No reference images provided!', {
      modelName: Env.string('GEMINI_IMAGE_MODEL'),
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

  const modelName = Env.string('GEMINI_IMAGE_MODEL')
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
  
  if (aspectRatio || (resolution && supportsResolution)) {
    generationConfig.imageConfig = {}
    if (aspectRatio) {
      generationConfig.imageConfig.aspectRatio = aspectRatio
    }
    if (resolution && supportsResolution) {
      generationConfig.imageConfig.imageSize = resolution
    } else if (resolution && !supportsResolution) {
      Logger.warn('Resolution parameter ignored - not supported by model', {
        modelName,
        requestedResolution: resolution
      })
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


