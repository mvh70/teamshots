/**
 * AI Provider Factory
 * 
 * Central factory for creating AI providers based on configuration
 */

import { AIProvider, AIProviderConfig } from './providers/AIProvider'
import { GeminiProvider, GeminiConfig } from './providers/gemini'
import { Env } from '@/lib/env'

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
  const provider = Env.string('AI_PROVIDER', 'gemini') as ProviderType
  
  const config: AIProviderConfig = {
    apiKey: Env.string('GEMINI_API_KEY', ''),
    model: Env.string('AI_MODEL', Env.string('GEMINI_IMAGE_MODEL', '')),
    timeout: Env.number('AI_TIMEOUT', 30000),
    maxRetries: Env.number('AI_MAX_RETRIES', 3)
  }
  
  return createAIProvider({ provider, config })
}

/**
 * Validate that all required environment variables are set
 */
export function validateAIProviderConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  const provider = Env.string('AI_PROVIDER', 'gemini')
  
  if (provider === 'gemini') {
    try {
      Env.string('GEMINI_API_KEY')
    } catch {
      errors.push('GEMINI_API_KEY is required for Gemini provider')
    }
  }
  
  // Add validation for other providers as they're implemented
  
  return {
    valid: errors.length === 0,
    errors
  }
}
