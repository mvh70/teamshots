import { readFile as fsReadFile } from 'node:fs/promises'

import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai'
import type { Content, GenerateContentResult, Part, GenerativeModel, SafetySetting } from '@google-cloud/vertexai'

import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGeminiRest } from './gemini-rest'

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
          Logger.debug('Extracted project ID from service account credentials', {
            projectId,
            credentialsPath
          })
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
  
  // Log model initialization attempt for debugging
  Logger.debug('Initializing Vertex AI model', {
    modelName: normalizedModelName,
    location,
    projectId: projectId.substring(0, 8) + '...' // Partial project ID for security
  })
  
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
}

export async function generateWithGemini(
  prompt: string,
  images: GeminiReferenceImage[],
  aspectRatio?: string,
  resolution?: '1K' | '2K' | '4K',
  options?: GenerationOptions
): Promise<Buffer[]> {
  // Determine which client to use based on available credentials
  const hasApiKey = !!Env.string('GOOGLE_CLOUD_API_KEY', '')
  const hasServiceAccount = !!Env.string('GOOGLE_APPLICATION_CREDENTIALS', '') ||
                           !!Env.string('GOOGLE_PROJECT_ID', '')

  // Prefer REST API client if API key is available, otherwise use Vertex AI
  const useRestApi = hasApiKey

  if (useRestApi) {
    Logger.debug('Using Gemini REST API client for image generation')
    // Convert safety settings to REST API format
    const restOptions = options ? {
      ...options,
      safetySettings: options.safetySettings?.map(setting => ({
        category: setting.category,
        threshold: (setting.threshold === HarmBlockThreshold.BLOCK_ONLY_HIGH ? 'BLOCK_ONLY_HIGH' :
                   setting.threshold === HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE ? 'BLOCK_MEDIUM_AND_ABOVE' :
                   setting.threshold === HarmBlockThreshold.BLOCK_LOW_AND_ABOVE ? 'BLOCK_LOW_AND_ABOVE' :
                   'BLOCK_NONE') as 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE' | 'BLOCK_NONE'
      }))
    } : undefined
    return generateWithGeminiRest(prompt, images, aspectRatio, resolution, restOptions)
  } else if (hasServiceAccount) {
    Logger.debug('Using Vertex AI client for image generation')
    return generateWithGeminiVertex(prompt, images, aspectRatio, resolution, options)
  } else {
    throw new Error('Neither GOOGLE_CLOUD_API_KEY nor GOOGLE_APPLICATION_CREDENTIALS/GOOGLE_PROJECT_ID are configured for Gemini API access')
  }
}

async function generateWithGeminiVertex(
  prompt: string,
  images: GeminiReferenceImage[],
  aspectRatio?: string,
  resolution?: '1K' | '2K' | '4K',
  options?: GenerationOptions
): Promise<Buffer[]> {
  const modelName = Env.string('GEMINI_IMAGE_MODEL')
  const model = await getVertexGenerativeModel(modelName)

  const parts: Part[] = [{ text: prompt }]
  for (const image of images) {
    if (image.description) {
      parts.push({ text: image.description })
    }
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
  }

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
    generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined,
    safetySettings: safetySettings.map(s => ({ category: s.category, threshold: s.threshold }))
  })

  try {
    const response: GenerateContentResult = await model.generateContent({
      contents,
      safetySettings,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(Object.keys(generationConfig).length > 0 ? { generationConfig: generationConfig as any } : {})
    })

    const responseParts = response.response.candidates?.[0]?.content?.parts ?? []
    const generatedImages: Buffer[] = []
    for (const part of responseParts) {
      if (part.inlineData?.data) {
        generatedImages.push(Buffer.from(part.inlineData.data, 'base64'))
      }
    }

    return generatedImages
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
    
    // Log all other errors with full details
    Logger.error('Gemini image generation failed', {
      modelName,
      ...errorDetails
    })
    
    // Also log to console for full visibility
    console.error('\n=== FULL ERROR DETAILS ===')
    console.error('Error Object:', error)
    console.error('Error Details:', JSON.stringify(errorDetails, null, 2))
    console.error('========================\n')

    throw error
  }
}


