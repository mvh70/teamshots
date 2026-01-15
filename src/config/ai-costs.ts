/**
 * AI Cost Configuration
 *
 * Pricing models for AI services used in image generation.
 * Costs are expressed in USD per unit (tokens or images).
 */

export type AIProvider = 'vertex' | 'gemini-rest' | 'replicate' | 'openrouter'

export type AIModelId =
  | 'gemini-2.5-flash'       // Text/evaluation model
  | 'gemini-2.5-flash-image' // Image generation model
  | 'gemini-2.5-flash-image-openrouter' // Image generation via OpenRouter
  | 'gemini-3-pro-image'     // Gemini 3 Pro Image (via REST API)
  | 'nano-banana'            // Replicate fallback

export interface TokenBasedPricing {
  type: 'token'
  inputPer1MTokens: number  // USD per 1 million input tokens
  outputPer1MTokens: number // USD per 1 million output tokens
  perImageGenerated?: number // Additional cost per image generated (for image models)
}

export interface FixedPricing {
  type: 'fixed'
  fixedPerOutput: number // USD per output (image)
}

export type ModelPricing = TokenBasedPricing | FixedPricing

export interface ModelConfig {
  id: AIModelId
  provider: AIProvider
  pricing: ModelPricing
  description: string
}

export interface TokenEstimate {
  inputTokens: number
  outputTokens: number
}

export const AI_COST_CONFIG = {
  models: {
    // Text/evaluation model (Gemini 2.5 Flash)
    // Note: Provider set to 'vertex' (default primary) but actual provider is tracked at runtime
    'gemini-2.5-flash': {
      id: 'gemini-2.5-flash',
      provider: 'vertex',  // Default primary provider (can fallback to gemini-rest or replicate)
      pricing: {
        type: 'token',
        inputPer1MTokens: 0.075,  // $0.075 per 1M input tokens
        outputPer1MTokens: 0.30,  // $0.30 per 1M output tokens
      },
      description: 'Gemini 2.5 Flash for text evaluation and analysis',
    } satisfies ModelConfig,

    // Image generation model (same base model, different pricing for image output)
    // Note: Provider set to 'vertex' (default primary) but actual provider is tracked at runtime
    'gemini-2.5-flash-image': {
      id: 'gemini-2.5-flash-image',
      provider: 'vertex',  // Default primary provider (can fallback to gemini-rest, openrouter, or replicate)
      pricing: {
        type: 'token',
        inputPer1MTokens: 0.075,
        outputPer1MTokens: 0.30,
        perImageGenerated: 0.039, // $0.039 per image generated
      },
      description: 'Gemini 2.5 Flash for image generation',
    } satisfies ModelConfig,

    // OpenRouter routing for Gemini image model (pricing aligned to Vertex; adjust if OpenRouter markup differs)
    'gemini-2.5-flash-image-openrouter': {
      id: 'gemini-2.5-flash-image-openrouter',
      provider: 'openrouter',
      pricing: {
        type: 'token',
        inputPer1MTokens: 0.075,
        outputPer1MTokens: 0.30,
        perImageGenerated: 0.039,
      },
      description: 'Gemini 2.5 Flash image generation via OpenRouter (assumes parity pricing)',
    } satisfies ModelConfig,

    // Gemini 3 Pro Image (via REST API - not available on OpenRouter)
    'gemini-3-pro-image': {
      id: 'gemini-3-pro-image',
      provider: 'gemini-rest',
      pricing: {
        type: 'token',
        inputPer1MTokens: 0.075,  // Pricing TBD - using 2.5 Flash as baseline
        outputPer1MTokens: 0.30,
        perImageGenerated: 0.039,
      },
      description: 'Gemini 3 Pro Image generation via REST API (aka Nano Banana 3)',
    } satisfies ModelConfig,

    // Replicate fallback (nano-banana)
    'nano-banana': {
      id: 'nano-banana',
      provider: 'replicate',
      pricing: {
        type: 'fixed',
        fixedPerOutput: 0.039, // $0.039 per image
      },
      description: 'Nano Banana on Replicate (fallback)',
    } satisfies ModelConfig,
  },

  // Default token estimates for different operation types
  estimates: {
    generation: {
      inputTokens: 2500,  // Typical input for image generation
      outputTokens: 1500, // Typical output tokens
    } satisfies TokenEstimate,
    evaluation: {
      inputTokens: 4000,  // Evaluation includes image + criteria
      outputTokens: 800,  // Structured evaluation response
    } satisfies TokenEstimate,
    refinement: {
      inputTokens: 3000,  // Refinement with feedback
      outputTokens: 1200, // Refined output
    } satisfies TokenEstimate,
    outfit_color_analysis: {
      inputTokens: 4000,  // Analysis of outfit image/description
      outputTokens: 1000, // Color palette and recommendations
    } satisfies TokenEstimate,
    outfit_collage_creation: {
      inputTokens: 5000,  // Outfit image + optional logo + instructions
      outputTokens: 2000, // Image generation output
    } satisfies TokenEstimate,
    clothing_overlay_creation: {
      inputTokens: 4500,  // Logo image + clothing template instructions
      outputTokens: 1800, // Clothing overlay with logo generation
    } satisfies TokenEstimate,
    garment_description: {
      inputTokens: 3000,  // Collage image + analysis prompt
      outputTokens: 800,  // Structured JSON description
    } satisfies TokenEstimate,
  },
} as const

/**
 * Calculate cost for a token-based model call
 */
export function calculateTokenCost(
  modelId: AIModelId,
  inputTokens: number,
  outputTokens: number,
  imagesGenerated: number = 0
): number {
  const model = AI_COST_CONFIG.models[modelId]
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`)
  }

  const pricing = model.pricing
  if (pricing.type === 'fixed') {
    return pricing.fixedPerOutput * Math.max(1, imagesGenerated)
  }

  // Token-based pricing
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1MTokens
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1MTokens
  const imageCost =
    ('perImageGenerated' in pricing ? pricing.perImageGenerated : 0) *
    imagesGenerated

  return inputCost + outputCost + imageCost
}

/**
 * Calculate estimated cost for an operation type
 */
export function calculateEstimatedCost(
  modelId: AIModelId,
  operationType: keyof typeof AI_COST_CONFIG.estimates,
  imagesGenerated: number = 0
): number {
  const estimate = AI_COST_CONFIG.estimates[operationType]
  return calculateTokenCost(
    modelId,
    estimate.inputTokens,
    estimate.outputTokens,
    imagesGenerated
  )
}

/**
 * Get the model configuration
 */
export function getModelConfig(modelId: AIModelId): ModelConfig {
  const model = AI_COST_CONFIG.models[modelId]
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`)
  }
  return model
}

/**
 * Get provider for a model
 */
export function getModelProvider(modelId: AIModelId): AIProvider {
  return getModelConfig(modelId).provider
}
