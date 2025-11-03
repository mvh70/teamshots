import { GoogleGenerativeAI, GenerativeModel, GenerationConfig, SafetySetting } from '@google/generative-ai'
import { AIProvider, AIProviderConfig, GenerateImageInput, ProviderResult, AIProviderError, GeneratedImage } from './AIProvider'
import { Env } from '@/lib/env'

export interface GeminiConfig extends AIProviderConfig {
  model?: string
  safetySettings?: SafetySetting[]
  generationConfig?: GenerationConfig
}

export class GeminiProvider extends AIProvider {
  private genAI: GoogleGenerativeAI
  private model: GenerativeModel

  constructor(config: GeminiConfig) {
    super(config)
    
    if (!config.apiKey) {
      throw new Error('Gemini API key is required')
    }

    this.genAI = new GoogleGenerativeAI(config.apiKey)
    this.model = this.genAI.getGenerativeModel({ 
      model: config.model || Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.0-flash-exp'),
      safetySettings: config.safetySettings || [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        } as SafetySetting,
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        } as SafetySetting,
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        } as SafetySetting,
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        } as SafetySetting,
      ],
      generationConfig: config.generationConfig || {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    })
  }

  async generateImage(input: GenerateImageInput): Promise<ProviderResult> {
    const startTime = Date.now()
    
    try {
      // For Gemini, we need to create a prompt that includes the selfie
      // and the style instructions
      const prompt = this.buildPrompt(input.prompt, input.options)
      
      // Note: Gemini 2.0 Flash doesn't directly generate images from selfies
      // This is a placeholder implementation - you'll need to adapt based on
      // Gemini's actual image generation capabilities
      
      // For now, we'll simulate the response structure
      // In reality, you'd need to:
      // 1. Upload the selfie image to Gemini
      // 2. Use the appropriate Gemini model for image generation
      // 3. Handle the response format
      
      const result = await this.model.generateContent([
        {
          text: prompt
        },
        // Add selfie image here when Gemini supports it
        // {
        //   inlineData: {
        //     data: await this.loadImageAsBase64(input.selfieUrl),
        //     mimeType: 'image/jpeg'
        //   }
        // }
      ])

      const response = await result.response
      const text = response.text()
      
      // Parse the response to extract image URLs or generation instructions
      // This is a placeholder - adapt based on actual Gemini response format
      const images = this.parseImageResponse(text, input.options?.numVariations || 4)
      
      const duration = Date.now() - startTime
      
      return {
        success: true,
        images,
        cost: this.calculateCost(images.length),
        metadata: {
          provider: 'gemini',
          model: this.config.model || Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.0-flash-exp'),
          duration,
          tokensUsed: response.usageMetadata?.totalTokenCount || 0
        }
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      const normalizedError = this.normalizeError(error)
      
      return {
        success: false,
        images: [],
        metadata: {
          provider: 'gemini',
          model: this.config.model || Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.0-flash-exp'),
          duration
        },
        error: normalizedError
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.model.generateContent('Hello')
      await result.response
      return true
    } catch (error) {
      console.error('Gemini health check failed:', error)
      return false
    }
  }

  getProviderName(): string {
    return 'gemini'
  }

  private buildPrompt(basePrompt: string, options?: Record<string, unknown>): string {
    let prompt = basePrompt
    
    if (options?.style) {
      prompt += `\n\nStyle: ${options.style}`
    }
    
    if (options?.negativePrompt) {
      prompt += `\n\nAvoid: ${options.negativePrompt}`
    }
    
    // Add professional photo generation instructions (shot-type agnostic)
    prompt += `\n\nGenerate professional photo variations with consistent lighting, high quality, and professional appearance. Strictly follow the JSON fields provided above, especially 'framing_composition.shot_type' and 'orientation'—do not change the requested shot type.`
    // Reinforce strict logo placement rules when a logo is present in the JSON
    prompt += `\nIf a brand logo is included in the instructions, place it only where specified (e.g., chest area of the t-shirt) and nowhere else. Do not add, duplicate, pattern, or move the logo to the background, clothing layers other than the t-shirt, skin, or accessories.`
    
    return prompt
  }

  private parseImageResponse(responseText: string, numVariations: number): GeneratedImage[] {
    // Placeholder implementation
    // In reality, you'd parse the actual Gemini response format
    // For now, return mock image data
    const images: GeneratedImage[] = []
    for (let i = 0; i < numVariations; i++) {
      images.push({
        url: `https://placeholder.com/1024x1024?text=Generated+Image+${i + 1}`,
        metadata: {
          seed: Math.floor(Math.random() * 1000000),
          prompt: responseText.substring(0, 100) + '...'
        }
      })
    }
    return images
  }

  private calculateCost(numImages: number): number {
    // Placeholder cost calculation
    // Adjust based on actual Gemini pricing
    return numImages * 0.10 // $0.10 per image
  }

  protected normalizeError(error: unknown): AIProviderError {
    // Handle Gemini-specific errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('API key')) {
      return {
        code: 'INVALID_API_KEY',
        message: 'Invalid or missing Gemini API key',
        retryable: false,
        originalError: error
      }
    }
    
    if (errorMessage.includes('quota')) {
      return {
        code: 'QUOTA_EXCEEDED',
        message: 'Gemini API quota exceeded',
        retryable: true,
        originalError: error
      }
    }
    
    if (errorMessage.includes('safety')) {
      return {
        code: 'SAFETY_VIOLATION',
        message: 'Content blocked by safety filters',
        retryable: false,
        originalError: error
      }
    }
    
    if (errorMessage.includes('timeout')) {
      return {
        code: 'TIMEOUT',
        message: 'Request timed out',
        retryable: true,
        originalError: error
      }
    }
    
    // Default error handling
    return {
      code: 'GEMINI_ERROR',
      message: errorMessage || 'Unknown Gemini API error',
      retryable: true,
      originalError: error
    }
  }
}
