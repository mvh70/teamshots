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
 * Generate images using Google Gemini REST API client
 * This uses the @google/genai package for direct REST API access
 */
export async function generateWithGeminiRest(
  prompt: string,
  images: GeminiReferenceImage[],
  aspectRatio?: string,
  resolution?: '1K' | '2K' | '4K',
  options?: GenerationOptions
): Promise<Buffer[]> {
  const apiKey = Env.string('GOOGLE_CLOUD_API_KEY')
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY environment variable is required for REST API client')
  }

  const modelName = Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash')

  // Initialize the REST API client
  const ai = new GoogleGenAI({
    apiKey: apiKey,
  })

  // Set up generation config based on user's example
  const generationConfig = {
    maxOutputTokens: 32768,
    temperature: options?.temperature ?? 1,
    topP: options?.topP ?? 0.95,
    responseModalities: ["TEXT", "IMAGE"] as const,
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
    }

    const streamingResp = await ai.models.generateContentStream(req)

    // Collect all chunks
    const chunks: Array<{
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              data?: string
            }
          }>
        }
      }>
    }> = []
    for await (const chunk of streamingResp) {
      chunks.push(chunk)
    }

    // Extract generated images from all chunks
    const generatedImages: Buffer[] = []

    for (const chunk of chunks) {
      if (chunk?.candidates?.[0]?.content?.parts) {
        for (const part of chunk.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            generatedImages.push(Buffer.from(part.inlineData.data, 'base64'))
          }
        }
      }
    }

    Logger.debug('Gemini REST API generation completed', {
      modelName,
      chunksReceived: chunks.length,
      imagesGenerated: generatedImages.length
    })

    return generatedImages

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
