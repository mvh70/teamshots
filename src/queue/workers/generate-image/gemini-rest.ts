import { GoogleGenAI, HarmCategory } from '@google/genai'

import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { isRateLimitError } from '@/lib/rate-limit-retry'

export interface GeminiReferenceImage {
  mimeType: string
  base64: string
  description?: string
}

export interface GenerationOptions {
  temperature?: number
  topK?: number
  topP?: number
  seed?: number
  safetySettings?: Array<{
    category: HarmCategory
    threshold: 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE' | 'BLOCK_NONE'
  }>
}

/**
 * Usage metadata returned from Gemini API calls
 */
export interface GeminiUsageMetadata {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  imagesGenerated: number
  durationMs: number
}

/**
 * Result of a Gemini generation call (internal - without provider info)
 */
export interface GeminiGenerationResult {
  images: Buffer[]
  usage: GeminiUsageMetadata
}

// Map Vertex AI safety settings to REST API format
function mapSafetySettings(vertexSettings?: Array<{
  category: HarmCategory
  threshold: 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE' | 'BLOCK_NONE'
}>): Array<{
  category: HarmCategory
  threshold: 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE' | 'BLOCK_NONE'
}> | undefined {
  if (!vertexSettings) return undefined

  return vertexSettings.map(setting => ({
    category: setting.category,
    threshold: setting.threshold === 'BLOCK_ONLY_HIGH' ? 'BLOCK_ONLY_HIGH' :
               setting.threshold === 'BLOCK_MEDIUM_AND_ABOVE' ? 'BLOCK_MEDIUM_AND_ABOVE' :
               setting.threshold === 'BLOCK_LOW_AND_ABOVE' ? 'BLOCK_LOW_AND_ABOVE' :
               'BLOCK_NONE'
  }))
}

/**
 * Direct fetch implementation for Gemini 3 Pro models
 * The @google/genai SDK doesn't support these models yet, so we use direct REST API calls
 * This mirrors the implementation in teamshots-marketing that works successfully
 */
async function generateWithGemini3DirectFetch(
  prompt: string,
  images: GeminiReferenceImage[],
  modelName: string,
  apiKey: string,
  aspectRatio?: string,
  startTime: number = Date.now()
): Promise<GeminiGenerationResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

  Logger.info('Calling Gemini 3 via direct fetch', {
    modelName,
    promptLength: prompt.length,
    referenceImageCount: images.length,
    aspectRatio
  })

  // Build parts array: prompt first, then reference images with descriptions
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt }
  ]

  // Add reference images (selfies, garments, etc.)
  for (const image of images) {
    if (image.description) {
      parts.push({ text: image.description })
    }
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64
      }
    })
  }

  // Build generationConfig with imageConfig for aspect ratio and resolution
  // Gemini 3 uses imageConfig nested inside generationConfig
  // See: https://ai.google.dev/gemini-api/docs/image-generation
  const generationConfig: Record<string, unknown> = {
    responseModalities: ['Text', 'Image']
  }

  // Add imageConfig if aspect ratio is specified
  if (aspectRatio) {
    generationConfig.imageConfig = {
      aspectRatio: aspectRatio // e.g., "3:4", "16:9"
    }
  }

  const requestBody = {
    contents: [{
      parts
    }],
    generationConfig
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      Logger.error('Gemini 3 direct fetch API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        modelName
      })
      throw new Error(`Gemini 3 API error: ${response.status} ${errorText}`)
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string
            inlineData?: { mimeType: string; data: string }
          }>
        }
        finishReason?: string
      }>
      usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
      }
    }

    Logger.debug('Gemini 3 direct fetch response received', {
      modelName,
      hasCandidates: !!data.candidates,
      candidatesLength: data.candidates?.length,
      finishReason: data.candidates?.[0]?.finishReason
    })

    // Extract images from response
    const generatedImages: Buffer[] = []
    const responseParts = data.candidates?.[0]?.content?.parts || []

    for (const part of responseParts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        generatedImages.push(Buffer.from(part.inlineData.data, 'base64'))
        Logger.debug('Gemini 3 returned image', {
          mimeType: part.inlineData.mimeType,
          dataLength: part.inlineData.data.length
        })
      } else if (part.text) {
        Logger.debug('Gemini 3 returned text', {
          textPreview: part.text.substring(0, 200)
        })
      }
    }

    if (generatedImages.length === 0) {
      Logger.error('Gemini 3 returned no images', {
        modelName,
        finishReason: data.candidates?.[0]?.finishReason,
        partsCount: responseParts.length,
        partTypes: responseParts.map(p => p.inlineData ? 'image' : p.text ? 'text' : 'unknown')
      })
      throw new Error('Gemini 3 returned no images')
    }

    const usage: GeminiUsageMetadata = {
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      totalTokens: data.usageMetadata?.totalTokenCount,
      imagesGenerated: generatedImages.length,
      durationMs: Date.now() - startTime
    }

    Logger.info('Gemini 3 direct fetch succeeded', {
      modelName,
      imagesGenerated: generatedImages.length,
      durationMs: usage.durationMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens
    })

    return {
      images: generatedImages,
      usage
    }
  } catch (error) {
    Logger.error('Gemini 3 direct fetch failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      modelName
    })
    throw error
  }
}

/**
 * Generate images using Google Gemini REST API client
 * This uses the @google/genai package for direct REST API access
 *
 * Supports both text-to-image and image-to-image generation:
 * - gemini-2.5-flash / gemini-2.5-flash-image: Fast, 1K resolution (auto-normalized for REST API)
 * - gemini-3-pro-image: Advanced, up to 4K resolution
 *
 * Note: Vertex AI model names ending in "-image" are automatically normalized to their base
 * model names for REST API compatibility (e.g., "gemini-2.5-flash-image" → "gemini-2.5-flash").
 * Image generation is enabled via the responseModalities configuration.
 *
 * Note: Uses non-streaming API as image generation doesn't work with streaming.
 * See: https://ai.google.dev/gemini-api/docs/image-generation
 *
 * Returns both the generated images and usage metadata for cost tracking.
 */
export async function generateWithGeminiRest(
  prompt: string,
  images: GeminiReferenceImage[],
  aspectRatio?: string,
  resolution?: '1K' | '2K' | '4K',
  options?: GenerationOptions
): Promise<GeminiGenerationResult> {
  const startTime = Date.now()
  // Support both GOOGLE_CLOUD_API_KEY and GEMINI_API_KEY
  const apiKey = Env.string('GOOGLE_CLOUD_API_KEY', '') || Env.string('GEMINI_API_KEY', '')
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY or GEMINI_API_KEY environment variable is required for REST API client')
  }

  let modelName = Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash')

  // Normalize Vertex AI model names ending in "-image" to base model names for REST API
  // e.g., "gemini-2.5-flash-image" → "gemini-2.5-flash"
  // REST API uses the base model name with responseModalities to enable image generation
  // NOTE: Don't normalize Gemini 3 models - they use "-image-preview" as part of the actual model name
  if (modelName.endsWith('-image') && !modelName.includes('gemini-3')) {
    modelName = modelName.slice(0, -6) // Remove '-image' suffix
    Logger.debug('Normalized model name for REST API', {
      original: Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash'),
      normalized: modelName
    })
  }

  // Use direct fetch for Gemini 3 models (SDK doesn't support them properly yet)
  const isGemini3Model = modelName.includes('gemini-3-pro')
  if (isGemini3Model) {
    return generateWithGemini3DirectFetch(prompt, images, modelName, apiKey, aspectRatio, startTime)
  }

  // Initialize the REST API client
  const ai = new GoogleGenAI({
    apiKey: apiKey,
  })

  // Set up generation config based on user's example
  const generationConfig = {
    maxOutputTokens: 32768,
    temperature: options?.temperature ?? 1,
    topP: options?.topP ?? 0.95,
    imageConfig: {
      aspectRatio: aspectRatio ?? "1:1",
      imageSize: resolution ?? "1K",
      outputMimeType: "image/png",
    },
  }

  // Default safety settings - permissive to match Vertex AI behavior
  const defaultSafetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: 'BLOCK_ONLY_HIGH' as const,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: 'BLOCK_ONLY_HIGH' as const,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: 'BLOCK_ONLY_HIGH' as const,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: 'BLOCK_ONLY_HIGH' as const,
    },
  ]

  const safetySettings = mapSafetySettings(options?.safetySettings) || defaultSafetySettings

  // Validate images before sending
  if (!images || images.length === 0) {
    Logger.error('generateWithGeminiRest: No reference images provided!', {
      modelName,
      imagesCount: images?.length || 0
    })
    throw new Error('No reference images provided to Gemini API')
  }

  // Validate each image has required fields and log missing descriptions
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    if (!img.base64 || !img.mimeType) {
      Logger.error('generateWithGeminiRest: Invalid reference image', {
        index: i,
        hasBase64: !!img.base64,
        hasMimeType: !!img.mimeType,
        description: img.description?.substring(0, 100)
      })
      throw new Error(`Reference image at index ${i} is missing base64 or mimeType`)
    }
    // Warn if description is missing (critical for model understanding)
    if (!img.description || img.description.trim().length === 0) {
      Logger.warn('generateWithGeminiRest: Reference image missing description', {
        index: i,
        mimeType: img.mimeType,
        base64Length: img.base64.length,
        note: 'Model may not understand the purpose of this image without a description'
      })
    }
  }

  // Build the contents array
  // Match Vertex AI behavior: add description as text part before each image
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt }
  ]
  
  for (const image of images) {
    // Add description as text part before image (if present)
    if (image.description) {
      parts.push({ text: image.description })
    }
    // Add image data
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64
      }
    })
  }
  
  const contents = [
    {
      role: 'user' as const,
      parts
    }
  ]

  const imageParts = contents[0].parts.filter(p => 'inlineData' in p)
  const textParts = contents[0].parts.filter(p => 'text' in p)
  
  // Log detailed structure to verify descriptions are included
  // Verify that each image has a description text part before it
  const expectedTextParts = 1 + images.filter(img => img.description).length // prompt + descriptions
  const expectedImageParts = images.length
  
  if (textParts.length !== expectedTextParts) {
    Logger.warn('generateWithGeminiRest: Unexpected text parts count', {
      expected: expectedTextParts,
      actual: textParts.length,
      note: 'Some image descriptions may be missing'
    })
  }
  
  if (imageParts.length !== expectedImageParts) {
    Logger.warn('generateWithGeminiRest: Unexpected image parts count', {
      expected: expectedImageParts,
      actual: imageParts.length
    })
  }
  
  Logger.info('Sending Gemini REST API request', {
    modelName,
    partsCount: contents[0].parts.length,
    textPartsCount: textParts.length,
    expectedTextParts,
    imagePartsCount: imageParts.length,
    expectedImageParts,
    partsStructure: contents[0].parts.map((part, idx) => {
      if ('text' in part) {
        const isPrompt = idx === 0
        const isDescription = !isPrompt && part.text.includes('REFERENCE IMAGE') || part.text.includes('Company logo') || part.text.includes('Custom background') || part.text.includes('FORMAT')
        return {
          index: idx,
          type: isPrompt ? 'prompt' : (isDescription ? 'description' : 'text'),
          preview: part.text.substring(0, 150) + (part.text.length > 150 ? '...' : ''),
          length: part.text.length
        }
      } else if ('inlineData' in part) {
        return {
          index: idx,
          type: 'image',
          mimeType: part.inlineData.mimeType,
          dataLength: part.inlineData.data.length
        }
      }
      return { index: idx, type: 'unknown' }
    }),
    imageDetails: images.map((img, idx) => ({
      index: idx,
      mimeType: img.mimeType,
      base64Length: img.base64?.length || 0,
      hasDescription: !!img.description,
      description: img.description?.substring(0, 150) || 'NO_DESCRIPTION'
    })),
    hasAspectRatio: !!aspectRatio,
    hasResolution: !!resolution,
    generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
  })

  try {
    const req = {
      model: modelName,
      contents,
      generationConfig,
      safetySettings,
      // Required for image generation - tells API to return images
      config: {
        responseModalities: ['TEXT', 'IMAGE'] as string[],
      },
    }

    // Use non-streaming for image generation (per official docs)
    // Image generation doesn't work properly with streaming
    const response = await ai.models.generateContent(req)

    // Extract generated images from response
    const generatedImages: Buffer[] = []

    // Extract usage metadata
    let inputTokens: number | undefined
    let outputTokens: number | undefined
    let totalTokens: number | undefined

    // Log response structure
    Logger.debug('Gemini REST API response received', {
      modelName,
      hasCandidates: !!response?.candidates,
      candidatesLength: response?.candidates?.length,
      hasContent: !!response?.candidates?.[0]?.content,
      hasParts: !!response?.candidates?.[0]?.content?.parts,
      partsLength: response?.candidates?.[0]?.content?.parts?.length,
      partTypes: response?.candidates?.[0]?.content?.parts?.map(p => 
        p.inlineData ? 'inlineData' : (p as { text?: string }).text ? 'text' : 'unknown'
      ),
      finishReason: (response?.candidates?.[0] as { finishReason?: string })?.finishReason,
      safetyRatings: (response?.candidates?.[0] as { safetyRatings?: unknown[] })?.safetyRatings,
      hasUsageMetadata: !!response?.usageMetadata,
    })

    // Extract images from parts (per official documentation)
    if (response?.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          Logger.debug('Gemini returned text part', { 
            textPreview: (part.text as string).substring(0, 200) 
          })
        } else if (part.inlineData?.data) {
          generatedImages.push(Buffer.from(part.inlineData.data, 'base64'))
          Logger.debug('Gemini returned image part', {
            dataLength: part.inlineData.data.length,
            mimeType: part.inlineData.mimeType
          })
        }
      }
    }
    
    // Extract usage metadata
    if (response?.usageMetadata) {
      inputTokens = response.usageMetadata.promptTokenCount
      outputTokens = response.usageMetadata.candidatesTokenCount
      totalTokens = response.usageMetadata.totalTokenCount
    }

    // Extract finish reason for better error reporting
    const finishReason = (response?.candidates?.[0] as { finishReason?: string })?.finishReason
    const safetyRatings = (response?.candidates?.[0] as { safetyRatings?: unknown[] })?.safetyRatings

    // If no images were generated, log the full response for debugging
    if (generatedImages.length === 0) {
      Logger.error('Gemini REST API returned no images - inspecting response', {
        modelName,
        hasResponse: !!response,
        finishReason: finishReason || 'UNKNOWN',
        safetyRatings: safetyRatings ? JSON.stringify(safetyRatings) : undefined,
        hasCandidates: !!response?.candidates,
        candidatesLength: response?.candidates?.length,
        hasContent: !!response?.candidates?.[0]?.content,
        hasParts: !!response?.candidates?.[0]?.content?.parts,
        partsLength: response?.candidates?.[0]?.content?.parts?.length,
        responsePreview: JSON.stringify(response, null, 2).substring(0, 2000),
        promptLength: prompt.length,
        imageCount: images.length,
        aspectRatio,
        resolution,
      })
    }

    const durationMs = Date.now() - startTime
    const usage: GeminiUsageMetadata = {
      inputTokens,
      outputTokens,
      totalTokens,
      imagesGenerated: generatedImages.length,
      durationMs,
    }

    Logger.debug('Gemini REST API generation completed', {
      modelName,
      imagesGenerated: generatedImages.length,
      inputTokens,
      outputTokens,
      durationMs,
      finishReason: finishReason || 'SUCCESS',
    })

    // If no images were generated, throw an error with detailed context
    if (generatedImages.length === 0) {
      const errorMessage = finishReason === 'IMAGE_OTHER'
        ? `Gemini REST API failed to generate image (IMAGE_OTHER finish reason). This typically indicates the model encountered an issue processing the prompt or reference images. Model: ${modelName}, AspectRatio: ${aspectRatio}, Resolution: ${resolution}. Prompt length: ${prompt.length} chars, Reference images: ${images.length}.`
        : `Gemini REST API returned no images. Model: ${modelName}, FinishReason: ${finishReason || 'UNKNOWN'}, AspectRatio: ${aspectRatio}, Resolution: ${resolution}. Check logs for response structure details.`
      
      throw new Error(errorMessage)
    }

    return {
      images: generatedImages,
      usage,
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isRateLimit = isRateLimitError(error)
    
    if (isRateLimit) {
      // For rate limit errors, log without stack trace
      Logger.error('Gemini REST API rate limited (429)', {
        modelName,
        error: errorMessage
      })
    } else {
      Logger.error('Gemini REST API generation failed', {
        modelName,
        error: errorMessage,
        note: 'If using gemini-3-pro-image-preview, ensure it\'s available via REST API.'
      })
    }
    throw error
  }
}
