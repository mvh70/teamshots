import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import type { GeminiGenerationResult, GeminiReferenceImage, GeminiUsageMetadata, GenerationOptions } from './gemini'

/**
 * Generate images using OpenRouter (routes to providers like Vertex/AI Studio/Replicate)
 */
export async function generateWithGeminiOpenRouter(
  prompt: string,
  images: GeminiReferenceImage[],
  aspectRatio?: string,
  // Note: Resolution is not currently configurable via OpenRouter; included for API parity
  _resolution?: '1K' | '2K' | '4K',
  options?: GenerationOptions
): Promise<GeminiGenerationResult> {
  const apiKey = Env.string('OPENROUTER_API_KEY', '')
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required to use OpenRouter provider')
  }

  // Validate reference images
  if (!images || images.length === 0) {
    Logger.error('generateWithGeminiOpenRouter: No reference images provided!', {
      imagesCount: images?.length || 0
    })
    throw new Error('No reference images provided to OpenRouter')
  }
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

  // Build multimodal content: prompt first, then description + image pairs
  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    { type: 'text', text: prompt }
  ]
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

  const modelFromEnv = Env.string('OPENROUTER_GEMINI_IMAGE_MODEL', 'google/gemini-2.5-flash-image-preview')

  // Build request body with proper OpenRouter API format
  const requestBody: Record<string, unknown> = {
    model: modelFromEnv,
    messages: [
      {
        role: 'user',
        content
      }
    ],
    modalities: ['image', 'text'],
    stream: false
  }

  // Add image_config if aspectRatio is specified
  if (aspectRatio) {
    requestBody.image_config = { aspect_ratio: aspectRatio }
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

    if (message?.images && Array.isArray(message.images)) {
      // Some responses have images in a separate array
      imagesData = message.images
    } else if (Array.isArray(message?.content)) {
      // Some responses have images in content array
      imagesData = message.content.filter((c: { type: string }) => c.type === 'image_url')
    }

    if (!imagesData || imagesData.length === 0) {
      // Extract any text content that might explain why no images were returned
      let textContent: string | undefined
      if (typeof message?.content === 'string') {
        textContent = message.content
      } else if (Array.isArray(message?.content)) {
        const textParts = message.content.filter((c: { type: string; text?: string }) => c.type === 'text')
        textContent = textParts.map((c: { text?: string }) => c.text).join(' ')
      }

      Logger.error('OpenRouter returned no images', {
        model: modelFromEnv,
        hasChoices: !!data.choices,
        hasMessage: !!message,
        messageKeys: message ? Object.keys(message) : [],
        contentType: Array.isArray(message?.content) ? 'array' : typeof message?.content,
        textContent: textContent?.substring(0, 500), // Log any text response that might explain the issue
        fullResponse: JSON.stringify(data).substring(0, 1000) // Log full response for debugging (truncated)
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

    Logger.debug('OpenRouter generation succeeded', {
      provider: 'openrouter',
      model: modelFromEnv,
      imagesGenerated: buffers.length,
      aspectRatio,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      durationMs: usage.durationMs
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
      model: modelFromEnv,
      aspectRatio
    })
    throw error
  }
}
