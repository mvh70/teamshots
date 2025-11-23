import { GoogleGenAI, HarmCategory } from '@google/genai'

import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'

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
  category: any
  threshold: any
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

  // Build the contents array
  const contents = [
    {
      role: 'user' as const,
      parts: [
        { text: prompt },
        // Add reference images
        ...images.map(img => ({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64
          }
        }))
      ]
    }
  ]

  Logger.debug('Sending Gemini REST API request', {
    modelName,
    partsCount: contents[0].parts.length,
    hasTextPrompt: contents[0].parts.some(p => 'text' in p),
    imageCount: contents[0].parts.filter(p => 'inlineData' in p).length,
    hasAspectRatio: !!aspectRatio,
    hasResolution: !!resolution,
    generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined,
    safetySettings: safetySettings.map(s => ({ category: s.category, threshold: s.threshold }))
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
    const chunks: any[] = []
    for await (const chunk of streamingResp) {
      chunks.push(chunk)
    }

    // Extract generated images from the final response
    const response = chunks[chunks.length - 1]
    const generatedImages: Buffer[] = []

    if (response?.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          generatedImages.push(Buffer.from(part.inlineData.data, 'base64'))
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
    Logger.error('Gemini REST API generation failed', {
      modelName,
      error: errorMessage,
      note: 'If using gemini-3-pro-image-preview, ensure it\'s available via REST API.'
    })
    throw error
  }
}
