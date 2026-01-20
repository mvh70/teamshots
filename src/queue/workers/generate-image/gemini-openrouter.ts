import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { PROVIDER_DEFAULTS } from './config'
import type { GeminiGenerationResult, GeminiReferenceImage, GeminiUsageMetadata, GenerationOptions } from './gemini'

/**
 * Generate images using OpenRouter (routes to providers like Vertex/AI Studio/Replicate)
 */
export async function generateWithGeminiOpenRouter(
  prompt: string,
  images: GeminiReferenceImage[],
  modelName: string,
  aspectRatio?: string,
  resolution?: '1K' | '2K' | '4K',
  options?: GenerationOptions
): Promise<GeminiGenerationResult> {
  const apiKey = Env.string('OPENROUTER_API_KEY', '')
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required to use OpenRouter provider')
  }

  // Validate reference images (if provided)
  if (images && images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      if (!img.base64 || !img.mimeType) {
        Logger.error('generateWithGeminiOpenRouter: Invalid reference image', {
          index: i,
          hasBase64: !!img.base64,
          hasMimeType: !!img.mimeType,
          description: img.description?.substring(0, 100)
        })
        throw new Error(`Reference image at index ${i} is missing base64 or mimeType`)
      }
    }
  }

  // Build multimodal content: prompt first, then description + image pairs (if any)
  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    { type: 'text', text: prompt }
  ]

  // Add reference images if provided
  if (images && images.length > 0) {
    for (const image of images) {
      if (image.description) {
        content.push({ type: 'text', text: image.description })
      }
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${image.mimeType};base64,${image.base64}`
        }
      })
    }
  }

  // Build request body with proper OpenRouter API format
  const requestBody: Record<string, unknown> = {
    model: modelName,
    messages: [
      {
        role: 'user',
        content
      }
    ],
    modalities: ['image', 'text'],
    stream: false
  }

  // Add image_config if aspectRatio or resolution is specified
  const effectiveResolution = resolution ?? PROVIDER_DEFAULTS.openrouter.resolution
  if (aspectRatio || effectiveResolution) {
    const imageConfig: Record<string, string> = {}
    if (aspectRatio) {
      imageConfig.aspect_ratio = aspectRatio
    }
    if (effectiveResolution) {
      imageConfig.image_size = effectiveResolution
    }
    requestBody.image_config = imageConfig
  }

  // Add generation options if provided
  if (options?.temperature !== undefined) requestBody.temperature = options.temperature
  if (options?.topP !== undefined) requestBody.top_p = options.topP
  if (options?.topK !== undefined) requestBody.top_k = options.topK
  if (options?.seed !== undefined) requestBody.seed = options.seed

  const startTime = Date.now()
  try {
    // Use direct fetch to OpenRouter API instead of SDK to support all parameters
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Env.string('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
        'X-Title': 'TeamShots'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      Logger.error('OpenRouter API request failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: Array<{ type: string; image_url?: { url?: string } }> | string
          images?: Array<{ image_url?: { url?: string } }>
        }
      }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
      }
    }

    const usage: GeminiUsageMetadata = {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
      imagesGenerated: 0, // Will be updated below
      durationMs: Date.now() - startTime
    }

    const message = data.choices?.[0]?.message

    // Extract images from response - they can be in different formats
    let imagesData: Array<{ image_url?: { url?: string } }> = []

    // Debug: Log the full response structure to understand what OpenRouter returns
    Logger.debug('OpenRouter response structure', {
      model: modelName,
      hasChoices: !!data.choices,
      choicesCount: data.choices?.length,
      hasMessage: !!message,
      messageKeys: message ? Object.keys(message) : [],
      hasMessageImages: !!(message as { images?: unknown })?.images,
      messageImagesCount: Array.isArray((message as { images?: unknown[] })?.images) 
        ? (message as { images: unknown[] }).images.length 
        : 0,
      contentType: Array.isArray(message?.content) ? 'array' : typeof message?.content,
      contentLength: Array.isArray(message?.content) ? message.content.length : 0,
      contentTypes: Array.isArray(message?.content) 
        ? message.content.map((c: { type?: string }) => c.type) 
        : [],
      usage: data.usage,
    })

    if (message?.images && Array.isArray(message.images)) {
      // Some responses have images in a separate array
      imagesData = message.images
      Logger.debug('OpenRouter: Found images in message.images array', { count: imagesData.length })
    } else if (Array.isArray(message?.content)) {
      // Some responses have images in content array
      imagesData = message.content.filter((c: { type: string }) => c.type === 'image_url')
      Logger.debug('OpenRouter: Found images in message.content array', { 
        totalContentItems: message.content.length,
        imageUrlItems: imagesData.length,
      })
    }

    if (!imagesData || imagesData.length === 0) {
      // Extract any text content that might explain why no images were returned
      let textContent: string | undefined
      if (typeof message?.content === 'string') {
        textContent = message.content
      } else if (Array.isArray(message?.content)) {
        type TextPart = { type: string; text?: string }
        const textParts = message.content.filter((c): c is TextPart => 
          typeof c === 'object' && c !== null && 'type' in c && c.type === 'text'
        )
        textContent = textParts.map((c) => c.text).filter(Boolean).join(' ')
      }

      // Some providers/models may return base64 image data URLs embedded in text content
      // (e.g. markdown or raw "data:image/png;base64,..." strings). Attempt to recover.
      if (textContent) {
        const dataUrlMatches = Array.from(
          textContent.matchAll(/data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g)
        )
        if (dataUrlMatches.length > 0) {
          const recovered = dataUrlMatches.map((m) => {
            const base64 = m[2]
            return Buffer.from(base64, 'base64')
          })
          usage.imagesGenerated = recovered.length
          Logger.warn('OpenRouter returned images embedded in text content; recovered via data URL parsing', {
            model: modelName,
            recoveredCount: recovered.length,
          })
          return {
            images: recovered,
            usage,
            providerUsed: 'openrouter',
          }
        }
      }

      Logger.error('OpenRouter returned no images - DETAILED DEBUG', {
        model: modelName,
        aspectRatio,
        referenceImageCount: images.length,
        referenceImageSizes: images.map(img => ({
          mimeType: img.mimeType,
          base64Length: img.base64?.length || 0,
          description: img.description?.substring(0, 80)
        })),
        promptLength: prompt.length,
        hasChoices: !!data.choices,
        choicesCount: data.choices?.length,
        hasMessage: !!message,
        messageKeys: message ? Object.keys(message) : [],
        contentType: Array.isArray(message?.content) ? 'array' : typeof message?.content,
        contentLength: Array.isArray(message?.content) ? message.content.length : 0,
        textContent: textContent?.substring(0, 500),
        usage: data.usage,
        fullResponse: JSON.stringify(data).substring(0, 2000) // Increased from 1000 to 2000
      })
      throw new Error(`OpenRouter returned no images${textContent ? `: ${textContent.substring(0, 200)}` : ''}`)
    }

    const buffers = imagesData.map((img) => {
      const dataUrl = img.image_url?.url || ''
      if (!dataUrl.includes('base64,')) {
        Logger.error('Invalid image data URL format', { dataUrl: dataUrl.substring(0, 100) })
        throw new Error('Invalid image data returned from OpenRouter - expected base64 data URL')
      }
      const base64 = dataUrl.split('base64,')[1]
      if (!base64) {
        throw new Error('Invalid image data returned from OpenRouter - missing base64 data')
      }
      return Buffer.from(base64, 'base64')
    })

    usage.imagesGenerated = buffers.length

    Logger.info('OpenRouter: SUCCESS', {
      images: buffers.length,
      duration: `${Math.round((usage.durationMs || 0) / 1000)}s`
    })

    return {
      images: buffers,
      usage,
      providerUsed: 'openrouter'
    }
  } catch (error) {
    Logger.error('OpenRouter generation failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      model: modelName,
      aspectRatio
    })
    throw error
  }
}
