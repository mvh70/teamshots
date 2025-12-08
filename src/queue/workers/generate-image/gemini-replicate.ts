/**
 * Replicate API integration for Gemini image generation (Nano Banana)
 * 
 * Uses Replicate's hosted version of Google's Gemini 2.5 Flash Image model
 * (codenamed "nano-banana") as a fallback when Google's direct APIs are rate limited.
 * 
 * Pricing: ~$0.039 per output image
 * 
 * @see https://replicate.com/google/nano-banana
 */

import Replicate from 'replicate'

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
  // Safety settings are not directly supported by Replicate's nano-banana wrapper
  safetySettings?: unknown[]
}

/**
 * Usage metadata returned from Replicate API calls
 */
export interface ReplicateUsageMetadata {
  imagesGenerated: number
  durationMs: number
}

/**
 * Result of a Replicate generation call (internal - without provider info)
 * Note: This matches the shape of GeminiGenerationResult for compatibility
 */
export interface ReplicateGenerationResult {
  images: Buffer[]
  usage: ReplicateUsageMetadata
}

/**
 * Map aspect ratio from our format (e.g., "1:1") to Replicate's format
 * Replicate supports: match_input_image, 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
 */
function mapAspectRatio(aspectRatio?: string): string {
  if (!aspectRatio) return 'match_input_image'
  
  // Replicate uses the same format (e.g., "1:1", "16:9")
  const supportedRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']
  
  if (supportedRatios.includes(aspectRatio)) {
    return aspectRatio
  }
  
  // If not supported, use match_input_image as fallback
  Logger.warn('Unsupported aspect ratio for Replicate, using match_input_image', {
    requestedAspectRatio: aspectRatio,
    supportedRatios
  })
  return 'match_input_image'
}

/**
 * Convert base64 image data to a data URL that Replicate can accept
 */
function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`
}

/**
 * Generate images using Replicate's Nano Banana (Gemini 2.5 Flash Image) API
 * 
 * Returns both the generated images and usage metadata for cost tracking.
 */
export async function generateWithGeminiReplicate(
  prompt: string,
  images: GeminiReferenceImage[],
  aspectRatio?: string,
  resolution?: '1K' | '2K' | '4K'
  // Note: GenerationOptions not supported by Replicate's nano-banana API
): Promise<ReplicateGenerationResult> {
  const startTime = Date.now()
  const apiToken = Env.string('REPLICATE_API_TOKEN', '')
  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN environment variable is required for Replicate API')
  }

  const replicate = new Replicate({
    auth: apiToken
  })

  // Validate images before sending
  if (!images || images.length === 0) {
    Logger.error('generateWithGeminiReplicate: No reference images provided!', {
      imagesCount: images?.length || 0
    })
    throw new Error('No reference images provided to Replicate API')
  }

  // Validate each image has required fields
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    if (!img.base64 || !img.mimeType) {
      Logger.error('generateWithGeminiReplicate: Invalid reference image', {
        index: i,
        hasBase64: !!img.base64,
        hasMimeType: !!img.mimeType,
        description: img.description?.substring(0, 100)
      })
      throw new Error(`Reference image at index ${i} is missing base64 or mimeType`)
    }
  }

  // Convert images to data URLs for Replicate
  const imageInputs = images.map(img => toDataUrl(img.base64, img.mimeType))

  // Build the full prompt including image descriptions
  // Replicate's nano-banana doesn't have separate description fields, so we prepend to prompt
  const imageDescriptions = images
    .filter(img => img.description)
    .map((img, idx) => `[Image ${idx + 1}]: ${img.description}`)
    .join('\n')
  
  const fullPrompt = imageDescriptions 
    ? `${imageDescriptions}\n\n${prompt}`
    : prompt

  Logger.info('Sending Replicate Nano Banana request', {
    model: 'google/nano-banana',
    promptLength: fullPrompt.length,
    imageCount: images.length,
    aspectRatio: mapAspectRatio(aspectRatio),
    imageDetails: images.map((img, idx) => ({
      index: idx,
      mimeType: img.mimeType,
      base64Length: img.base64?.length || 0,
      hasDescription: !!img.description
    }))
  })

  // Note: resolution parameter is not directly supported by Replicate's nano-banana
  // The model generates at its native resolution based on aspect ratio
  if (resolution && resolution !== '1K') {
    Logger.warn('Resolution parameter not supported by Replicate nano-banana, using default', {
      requestedResolution: resolution
    })
  }

  try {
    // Run the model
    const output = await replicate.run('google/nano-banana', {
      input: {
        prompt: fullPrompt,
        image_input: imageInputs,
        aspect_ratio: mapAspectRatio(aspectRatio),
        output_format: 'png' // Use PNG for consistency with our other providers
      }
    })

    // The output is typically a URL or array of URLs
    // We need to fetch the images and convert to Buffer
    const generatedImages: Buffer[] = []

    // Handle different output formats from Replicate
    const outputUrls: string[] = []
    if (typeof output === 'string') {
      outputUrls.push(output)
    } else if (Array.isArray(output)) {
      for (const item of output) {
        if (typeof item === 'string') {
          outputUrls.push(item)
        } else if (item && typeof item === 'object' && 'url' in item) {
          outputUrls.push((item as { url: string }).url)
        }
      }
    } else if (output && typeof output === 'object') {
      // Single object with url property
      if ('url' in output) {
        outputUrls.push((output as { url: string }).url)
      }
    }

    // Fetch each image URL and convert to Buffer
    for (const url of outputUrls) {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          Logger.warn('Failed to fetch generated image from Replicate', {
            url,
            status: response.status
          })
          continue
        }
        const arrayBuffer = await response.arrayBuffer()
        generatedImages.push(Buffer.from(arrayBuffer))
      } catch (fetchError) {
        Logger.warn('Error fetching image from Replicate URL', {
          url,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError)
        })
      }
    }

    const durationMs = Date.now() - startTime
    const usage: ReplicateUsageMetadata = {
      imagesGenerated: generatedImages.length,
      durationMs,
    }

    Logger.debug('Replicate Nano Banana generation completed', {
      outputUrlCount: outputUrls.length,
      imagesGenerated: generatedImages.length,
      durationMs,
    })

    if (generatedImages.length === 0) {
      throw new Error('Replicate API returned no valid images')
    }

    return {
      images: generatedImages,
      usage,
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const rateLimited = isRateLimitError(error)

    if (rateLimited) {
      Logger.error('Replicate API rate limited', {
        error: errorMessage
      })
    } else {
      Logger.error('Replicate Nano Banana generation failed', {
        error: errorMessage
      })
    }
    throw error
  }
}

