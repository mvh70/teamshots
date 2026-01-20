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
import { PROVIDER_DEFAULTS } from './config'

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
 * Generate images using Replicate's Nano Banana models (Gemini on Replicate)
 *
 * Supported models:
 * - google/nano-banana: Gemini 2.5 Flash Image
 * - google/nano-banana-pro: Gemini 3 Pro Image
 *
 * Returns both the generated images and usage metadata for cost tracking.
 */
export async function generateWithGeminiReplicate(
  prompt: string,
  images: GeminiReferenceImage[],
  modelName: string, // Replicate model name (e.g., 'google/nano-banana' or 'google/nano-banana-pro')
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

  // Use provided resolution or default from config
  const effectiveResolution = resolution ?? PROVIDER_DEFAULTS.replicate.resolution
  const isPro = modelName.includes('pro')

  Logger.info('Sending Replicate request', {
    model: modelName,
    isPro,
    promptLength: fullPrompt.length,
    imageCount: images.length,
    aspectRatio: mapAspectRatio(aspectRatio),
    resolution: isPro ? effectiveResolution : 'not supported (regular nano-banana)',
    imageDetails: images.map((img, idx) => ({
      index: idx,
      mimeType: img.mimeType,
      base64Length: img.base64?.length || 0,
      hasDescription: !!img.description
    }))
  })

  try {
    Logger.info('Starting Replicate prediction', {
      model: modelName,
      isPro,
      promptLength: fullPrompt.length,
      imageCount: imageInputs.length,
      aspectRatio: mapAspectRatio(aspectRatio),
      resolution: isPro ? effectiveResolution : 'not supported'
    })

    // Run the model with extended timeout for long-running predictions
    // Nano Banana Pro can take 60-120 seconds to complete
    
    // Build input parameters based on model
    const input: Record<string, unknown> = {
      prompt: fullPrompt,
      image_input: imageInputs,  // Replicate uses 'image_input' for multi-image input
      aspect_ratio: mapAspectRatio(aspectRatio),
      output_format: 'png' // Use PNG for consistency with our other providers
    }
    
    // Only nano-banana-pro supports resolution parameter (and it's called "resolution" not "output_resolution")
    if (isPro && effectiveResolution) {
      input.resolution = effectiveResolution
    }
    
    const output = await replicate.run(modelName as `${string}/${string}`, {
      input,
      // Configure polling to wait longer for generation to complete
      wait: {
        mode: "poll",
        interval: 5000  // Poll every 5 seconds
      }
    }) as any

    // DIAGNOSTIC: Log the complete output object structure to understand what nano-banana returns
    Logger.info('Replicate prediction completed - FULL OUTPUT INSPECTION', {
      model: modelName,
      outputType: typeof output,
      isArray: Array.isArray(output),
      outputKeys: output && typeof output === 'object' && !Array.isArray(output) ? Object.keys(output) : [],
      outputString: JSON.stringify(output, null, 2).substring(0, 2000),
      durationMs: Date.now() - startTime
    })

    Logger.info('Replicate prediction completed', {
      model: modelName,
      outputType: typeof output,
      isArray: Array.isArray(output),
      outputKeys: output && typeof output === 'object' && !Array.isArray(output) ? Object.keys(output) : [],
      outputSample: typeof output === 'string' ? output.substring(0, 100) : JSON.stringify(output).substring(0, 200),
      durationMs: Date.now() - startTime
    })

    // The output is typically a URL or array of URLs
    // We need to fetch the images and convert to Buffer
    const generatedImages: Buffer[] = []

    // Handle different output formats from Replicate
    const outputUrls: string[] = []
    
    // Log raw output for debugging
    Logger.debug('Replicate raw output', {
      model: modelName,
      outputType: typeof output,
      isArray: Array.isArray(output),
      outputLength: Array.isArray(output) ? output.length : undefined,
      output: JSON.stringify(output).substring(0, 500)
    })
    
    if (typeof output === 'string') {
      // Simple string URL
      outputUrls.push(output)
    } else if (Array.isArray(output)) {
      // Array of URLs or objects
      for (const item of output) {
        if (typeof item === 'string') {
          outputUrls.push(item)
        } else if (item && typeof item === 'object') {
          // Check various possible property names
          if ('url' in item && typeof item.url === 'string') {
            outputUrls.push(item.url)
          } else if ('uri' in item && typeof (item as {uri: unknown}).uri === 'string') {
            outputUrls.push((item as {uri: string}).uri)
          } else if ('output' in item && typeof (item as {output: unknown}).output === 'string') {
            outputUrls.push((item as {output: string}).output)
          }
        }
      }
    } else if (output && typeof output === 'object') {
      // Single object - check various property names
      const obj = output as Record<string, unknown>
      if ('url' in obj && typeof obj.url === 'string') {
        outputUrls.push(obj.url)
      } else if ('uri' in obj && typeof obj.uri === 'string') {
        outputUrls.push(obj.uri)
      } else if ('output' in obj && typeof obj.output === 'string') {
        outputUrls.push(obj.output)
      } else if ('output' in obj && Array.isArray(obj.output)) {
        // Output might be nested
        for (const item of obj.output) {
          if (typeof item === 'string') {
            outputUrls.push(item)
          }
        }
      } else if ('files' in obj && Array.isArray(obj.files)) {
        // Some models return 'files' array
        for (const item of obj.files) {
          if (typeof item === 'string') {
            outputUrls.push(item)
          } else if (item && typeof item === 'object' && 'url' in item && typeof (item as {url: unknown}).url === 'string') {
            outputUrls.push((item as {url: string}).url)
          }
        }
      } else if ('images' in obj && Array.isArray(obj.images)) {
        // Some models return 'images' array
        for (const item of obj.images) {
          if (typeof item === 'string') {
            outputUrls.push(item)
          } else if (item && typeof item === 'object' && 'url' in item && typeof (item as {url: unknown}).url === 'string') {
            outputUrls.push((item as {url: string}).url)
          }
        }
      } else if ('result' in obj && typeof obj.result === 'string') {
        // Some models use 'result'
        outputUrls.push(obj.result)
      } else if ('result' in obj && Array.isArray(obj.result)) {
        // Or result array
        for (const item of obj.result) {
          if (typeof item === 'string') {
            outputUrls.push(item)
          }
        }
      }
    }
    
    if (outputUrls.length === 0) {
      Logger.error('Could not extract any URLs from Replicate output', {
        model: modelName,
        outputType: typeof output,
        outputStructure: JSON.stringify(output).substring(0, 1000)
      })
    }

    Logger.info('Replicate returned URLs', {
      model: modelName,
      urlCount: outputUrls.length,
      urls: outputUrls.map(url => ({
        full: url,
        host: new URL(url).hostname,
        path: new URL(url).pathname.substring(0, 50) + '...'
      }))
    })

    // Fetch each image URL and convert to Buffer
    // Add timeout and retry logic to handle transient network issues
    const FETCH_TIMEOUT_MS = 30000 // 30 seconds
    const MAX_FETCH_RETRIES = 3
    const RETRY_DELAY_MS = 1000 // 1 second between retries
    
    for (const url of outputUrls) {
      let imageBuffer: Buffer | null = null
      let lastError: Error | null = null
      
      // Retry loop for fetching the image
      for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
          
          Logger.debug('Fetching Replicate image', {
            url: url.substring(0, 100) + '...',
            attempt,
            maxRetries: MAX_FETCH_RETRIES
          })
          
          const response = await fetch(url, { signal: controller.signal })
          clearTimeout(timeoutId)
          
          if (!response.ok) {
            Logger.warn('Failed to fetch generated image from Replicate', {
              url: url.substring(0, 100) + '...',
              status: response.status,
              statusText: response.statusText,
              attempt
            })
            
            // If server error (5xx) or rate limit (429), retry
            if (response.status >= 500 || response.status === 429) {
              if (attempt < MAX_FETCH_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt))
                continue
              }
            }
            
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
            break // Don't retry on 4xx errors
          }
          
          const arrayBuffer = await response.arrayBuffer()
          imageBuffer = Buffer.from(arrayBuffer)
          
          Logger.info('Successfully fetched Replicate image', {
            url: url.substring(0, 100) + '...',
            attempt,
            sizeBytes: imageBuffer.length
          })
          
          break // Success - exit retry loop
          
        } catch (fetchError) {
          const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError)
          const isTimeout = fetchError instanceof Error && fetchError.name === 'AbortError'
          
          lastError = fetchError instanceof Error ? fetchError : new Error(errorMsg)
          
          Logger.warn('Error fetching image from Replicate URL', {
            url: url.substring(0, 100) + '...',
            error: errorMsg,
            timeout: isTimeout,
            timeoutMs: FETCH_TIMEOUT_MS,
            attempt,
            maxRetries: MAX_FETCH_RETRIES,
            willRetry: attempt < MAX_FETCH_RETRIES
          })
          
          // Wait before retry
          if (attempt < MAX_FETCH_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt))
          }
        }
      }
      
      if (imageBuffer) {
        generatedImages.push(imageBuffer)
      } else {
        Logger.error('Failed to fetch Replicate image after all retries', {
          url: url.substring(0, 100) + '...',
          maxRetries: MAX_FETCH_RETRIES,
          lastError: lastError?.message
        })
      }
    }

    const durationMs = Date.now() - startTime
    const usage: ReplicateUsageMetadata = {
      imagesGenerated: generatedImages.length,
      durationMs,
    }

    Logger.debug('Replicate generation completed', {
      model: modelName,
      outputUrlCount: outputUrls.length,
      imagesGenerated: generatedImages.length,
      durationMs,
    })

    if (generatedImages.length === 0) {
      // Provide more context about what went wrong
      const errorDetails = outputUrls.length > 0
        ? `Replicate returned ${outputUrls.length} URL(s) but all failed to download. Check network connectivity and Replicate CDN availability.`
        : 'Replicate API completed but returned no image URLs in the output.'
      
      Logger.error('Replicate image fetch failed', {
        model: modelName,
        outputUrlCount: outputUrls.length,
        urls: outputUrls,
        durationMs,
        errorDetails
      })
      
      throw new Error(errorDetails)
    }

    return {
      images: generatedImages,
      usage,
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const rateLimited = isRateLimitError(error)

    // Capture detailed error information
    const errorDetails: Record<string, unknown> = {
      model: modelName,
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      promptLength: fullPrompt.length,
      imageCount: images.length,
      aspectRatio: mapAspectRatio(aspectRatio),
      resolution: effectiveResolution
    }

    // If the error object has additional properties, capture them
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>
      if (err.status) errorDetails.httpStatus = err.status
      if (err.response) {
        errorDetails.response = typeof err.response === 'string' 
          ? err.response.substring(0, 500) 
          : JSON.stringify(err.response).substring(0, 500)
      }
      if (err.prediction) {
        const pred = err.prediction as Record<string, unknown>
        errorDetails.predictionId = pred.id
        errorDetails.predictionStatus = pred.status
        errorDetails.predictionError = pred.error
      }
    }

    if (rateLimited) {
      Logger.error('Replicate API rate limited', errorDetails)
    } else {
      Logger.error('Replicate generation failed - DETAILED', errorDetails)
    }
    throw error
  }
}

