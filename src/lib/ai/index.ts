/**
 * AI Provider Factory
 * 
 * Central factory for creating AI providers based on configuration
 */

import { AIProvider, AIProviderConfig } from './providers/AIProvider'
import { GeminiProvider, GeminiConfig } from './providers/gemini'

export type ProviderType = 'gemini' | 'openai' | 'stability'

export interface AIProviderFactoryConfig {
  provider: ProviderType
  config: AIProviderConfig
}

/**
 * Create an AI provider instance based on configuration
 */
export function createAIProvider(factoryConfig: AIProviderFactoryConfig): AIProvider {
  switch (factoryConfig.provider) {
    case 'gemini':
      return new GeminiProvider(factoryConfig.config as GeminiConfig)
    
    case 'openai':
      // TODO: Implement OpenAI provider
      throw new Error('OpenAI provider not yet implemented')
    
    case 'stability':
      // TODO: Implement Stability AI provider
      throw new Error('Stability AI provider not yet implemented')
    
    default:
      throw new Error(`Unknown AI provider: ${factoryConfig.provider}`)
  }
}

/**
 * Get the default AI provider from environment variables
 */
export function getDefaultAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || 'gemini') as ProviderType
  
  const config: AIProviderConfig = {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.AI_MODEL || process.env.GEMINI_IMAGE_MODEL,
    timeout: parseInt(process.env.AI_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3')
  }
  
  return createAIProvider({ provider, config })
}

/**
 * Validate that all required environment variables are set
 */
export function validateAIProviderConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  const provider = process.env.AI_PROVIDER || 'gemini'
  
  if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) {
      errors.push('GEMINI_API_KEY is required for Gemini provider')
    }
  }
  
  // Add validation for other providers as they're implemented
  
  return {
    valid: errors.length === 0,
    errors
  }
}
