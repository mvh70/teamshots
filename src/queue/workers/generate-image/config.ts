/**
 * Centralized configuration for image generation workflows
 * Consolidates all magic numbers and constants from workflow files
 */

// Retry Configuration
export const RETRY_CONFIG = {
  /** Maximum number of rate limit retries before giving up */
  MAX_RATE_LIMIT_RETRIES: 3,

  /** Sleep duration when rate limited (milliseconds) */
  RATE_LIMIT_SLEEP_MS: 60000, // 60 seconds
} as const

// Evaluation Tolerances
export const EVALUATION_CONFIG = {
  /** Tolerance for dimension mismatch (pixels) - generous to allow model variations */
  DIMENSION_TOLERANCE_PX: 50,

  /** Tolerance for aspect ratio mismatch (ratio) - 5% to handle model variations */
  ASPECT_RATIO_TOLERANCE: 0.05,

  /** Retry count for evaluation parsing/API retries before rejecting */
  MAX_EVAL_RETRIES: 3,
} as const

export const PROMINENCE = {
  MIN_PERCENT: 40,
  MAX_PERCENT: 60,
  label: '40-60%',
  evalLabel: '40-60%+',
} as const

// AI Generation Parameters
export const AI_CONFIG = {
  /** Temperature for person generation - lower for face accuracy (0.0-1.0) */
  PERSON_GENERATION_TEMPERATURE: 0.3,

  /** Temperature for background generation (0.0-1.0) */
  BACKGROUND_GENERATION_TEMPERATURE: 0.5,

  /** Temperature for all evaluation steps - low for deterministic judgment (0.0-1.0) */
  EVALUATION_TEMPERATURE: 0.2,

  /** Temperature for composition/refinement - lower for stable integration (0.0-1.0) */
  REFINEMENT_TEMPERATURE: 0.2
} as const

// Workflow step progress percentages
export const PROGRESS_STEPS = {
  V3_INIT: 5,
  V3_PREPARING: 13,
  V3_EVALUATING_BRANDING: 14,
  V3_GENERATING_PERSON: 15,
  V3_EVALUATING_PERSON: 30,
  V3_PERSON_COMPLETE: 40,
  V3_PREPARING_COMPOSITION: 50,
  V3_COMPOSITING: 60,
  V3_FINAL_EVAL: 85,
  V3_COMPLETE: 100,
} as const

// =============================================================================
// Model Configuration
// =============================================================================

/** Available AI providers for model access */
export type ModelProvider = 'vertex' | 'rest' | 'openrouter' | 'replicate'

/**
 * Global provider fallback order.
 * When a model's preferredProvider fails or is unavailable, providers are tried in this order.
 * Providers not in this list or without credentials/model support are skipped.
 */
export const PROVIDER_FALLBACK_ORDER: ModelProvider[] = [
  'openrouter',
  'rest',
  'vertex',
  'replicate'
]

/**
 * Default settings per provider.
 * These are applied when no explicit value is passed.
 */
export const PROVIDER_DEFAULTS: Record<ModelProvider, {
  resolution: '1K' | '2K' | '4K'
}> = {
  openrouter: { resolution: '1K' },
  vertex: { resolution: '1K' },
  rest: { resolution: '1K' },
  replicate: { resolution: '1K' },
}

/**
 * Model definitions with provider-specific names and optional preferred provider.
 * - preferredProvider: If set, this provider is tried first before fallback order.
 *                      If not set, follows PROVIDER_FALLBACK_ORDER directly.
 * - providers: Provider-specific model names. null means not available on that provider.
 */
export const MODEL_CONFIG = {
  /** Text/eval model (no image generation) */
  'gemini-2.5-flash': {
    providers: {
      vertex: 'gemini-2.5-flash',
      rest: 'gemini-2.5-flash',
      openrouter: 'google/gemini-2.5-flash',
      replicate: null, // Text-only, no Replicate equivalent
    },
  },
  /** Image generation model (Gemini 2.5) */
  'gemini-2.5-flash-image': {
    providers: {
      vertex: 'gemini-2.5-flash-image',
      rest: 'gemini-2.5-flash', // REST normalizes -image suffix, uses responseModalities
      openrouter: 'google/gemini-2.5-flash-image',
      replicate: null//'google/nano-banana', // Nano Banana (Gemini 2.5) - supports multi-image input
    },
  },
  /** Advanced image model (Gemini 3) */
  'gemini-3-pro-image': {
    providers: {
      vertex: 'gemini-3-pro-image-preview',
      rest: 'gemini-3-pro-image-preview',
      openrouter: 'google/gemini-3-pro-image-preview',
      replicate: null // Gemini 3 Pro Image on Replicate
    },
  },
  /** Text model (Gemini 3 - non-image) */
  'gemini-3-pro': {
    providers: {
      vertex: 'gemini-3-pro',
      rest: 'gemini-3-pro',
      openrouter: 'google/gemini-3-pro-preview',
      replicate: null, // Text-only, no Replicate equivalent
    },
  },
  /** Grok-4 Fast - Cost-effective evaluation model with vision */
  'grok-4-fast': {
    providers: {
      vertex: null, // Only available via OpenRouter/xAI
      rest: null,
      openrouter: 'x-ai/grok-4-fast',
      replicate: null,
    },
  },
} as const

/** Canonical model names */
export type ModelName = keyof typeof MODEL_CONFIG

/** Per-stage model selection */
export const STAGE_MODEL = {
  CLOTHING_COLLAGE: 'gemini-2.5-flash-image' as ModelName,
  CLOTHING_OVERLAY: 'gemini-2.5-flash-image' as ModelName,
  BACKGROUND_BRANDING: 'gemini-2.5-flash-image' as ModelName,
  STEP_1A_PERSON: 'gemini-3-pro-image' as ModelName, // EXPERIMENT: Gemini 3 @ 1K for both steps
  STEP_2_COMPOSITION: 'gemini-3-pro-image' as ModelName, // Changed from gemini-3-pro-image to support Vertex
  EVALUATION: 'gemini-2.5-flash' as ModelName,
  GARMENT_ANALYSIS: 'gemini-2.5-flash' as ModelName,
  SELFIE_CLASSIFICATION: 'gemini-2.5-flash' as ModelName,
} as const

export type StageName = keyof typeof STAGE_MODEL

/** Fallback model when stage config is missing */
export const DEFAULT_MODEL: ModelName = 'gemini-2.5-flash-image'

/** Per-stage resolution overrides (undefined = use PROVIDER_DEFAULTS) */
export const STAGE_RESOLUTION: Partial<Record<StageName, '1K' | '2K' | '4K'>> = {
  CLOTHING_COLLAGE: '1K',
  CLOTHING_OVERLAY: '1K',
  BACKGROUND_BRANDING: '1K',
  STEP_1A_PERSON: '2K',
  STEP_2_COMPOSITION: '2K',
}

/**
 * Get the provider-specific model name for a given canonical model and provider.
 * Returns null if the model is not available on the provider.
 */
export function getModelNameForProvider(model: ModelName, provider: ModelProvider): string | null {
  return MODEL_CONFIG[model].providers[provider]
}
