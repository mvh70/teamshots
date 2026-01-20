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
  
  /** Maximum local generation attempts for V1 workflow */
  MAX_LOCAL_GENERATION_ATTEMPTS: 2,
  
  /** Wait time before retry message is visible (milliseconds) */
  RETRY_MESSAGE_DELAY_MS: 2000
} as const

// Image Composition Configuration
export const COMPOSITION_CONFIG = {
  /** Margin around composite image (pixels) */
  MARGIN: 20,
  
  /** Spacing between selfies in composite (pixels) */
  SELFIE_SPACING: 10,
  
  /** Font size for title text (pixels) */
  TITLE_FONT_SIZE: 32,
  
  /** Font size for label text (pixels) */
  LABEL_FONT_SIZE: 24,
  
  /** Text color for labels */
  LABEL_COLOR: '#000000',
  
  /** Margin around text overlays (pixels) */
  TEXT_MARGIN: 12,
  
  /** Margin around label text (pixels) */
  LABEL_TEXT_MARGIN: 8
} as const

// Evaluation Tolerances
export const EVALUATION_CONFIG = {
  /** Tolerance for dimension mismatch (pixels) - generous to allow model variations */
  DIMENSION_TOLERANCE_PX: 50,

  /** Tolerance for aspect ratio mismatch (ratio) - 5% to handle model variations */
  ASPECT_RATIO_TOLERANCE: 0.05
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

// Progress Tracking Configuration
export const PROGRESS_CONFIG = {
  /** Minimum time between identical progress updates (milliseconds) */
  UPDATE_DEBOUNCE_MS: 100
} as const

// Workflow Step Progress Percentages
// NOTE: Step 1b is disabled, so only Step 1a runs
export const PROGRESS_STEPS = {
  // V3 Workflow
  V3_INIT: 5,
  V3_PREPARING: 10,
  // Step 1a: Person generation
  V3_GENERATING_PERSON: 15, // Step 1a: Person generation start
  V3_GENERATING_BACKGROUND: 20, // Step 1b: DISABLED (kept for backward compatibility)
  V3_EVALUATING_PERSON: 30, // Step 1a eval
  V3_EVALUATING_BACKGROUND: 30, // Step 1b: DISABLED (kept for backward compatibility)
  V3_PERSON_COMPLETE: 40, // Step 1a complete (person + eval done)
  V3_BACKGROUND_COMPLETE: 40, // Step 1b: DISABLED (kept for backward compatibility)
  // Step 2: Composition happens after Step 1a completes
  V3_COMPOSITING: 60, // Step 2: Composition/refinement with background and branding
  V3_FINAL_EVAL: 85, // Step 3: Final evaluation
  V3_COMPLETE: 100,

  // V1 Workflow
  V1_INIT: 10,
  V1_PREPROCESSING: 15,
  V1_PROMPT_READY: 20,
  V1_GENERATING: 55,
  V1_GENERATED: 60,
  V1_EVALUATING: 65,
  V1_APPROVED: 70,
  V1_UPLOADING: 80,
  V1_COMPLETE: 100
} as const

// Export combined config for convenience
export const WORKFLOW_CONFIG = {
  retry: RETRY_CONFIG,
  composition: COMPOSITION_CONFIG,
  evaluation: EVALUATION_CONFIG,
  ai: AI_CONFIG,
  progress: PROGRESS_CONFIG,
  progressSteps: PROGRESS_STEPS
} as const

// Type exports for type-safe access
export type RetryConfig = typeof RETRY_CONFIG
export type CompositionConfig = typeof COMPOSITION_CONFIG
export type EvaluationConfig = typeof EVALUATION_CONFIG
export type AIConfig = typeof AI_CONFIG
export type ProgressConfig = typeof PROGRESS_CONFIG
export type ProgressSteps = typeof PROGRESS_STEPS
export type WorkflowConfig = typeof WORKFLOW_CONFIG

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
      vertex: 'gemini-3-pro-image', // TODO: Verify if this is the correct Vertex model name
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
} as const

/** Canonical model names */
export type ModelName = keyof typeof MODEL_CONFIG

/** Per-stage model selection */
export const STAGE_MODEL = {
  CLOTHING_COLLAGE: 'gemini-2.5-flash-image' as ModelName,
  CLOTHING_OVERLAY: 'gemini-2.5-flash-image' as ModelName,
  STEP_1A_PERSON: 'gemini-3-pro-image' as ModelName,
  STEP_1B_BACKGROUND: 'gemini-2.5-flash-image' as ModelName,
  STEP_2_COMPOSITION: 'gemini-3-pro-image' as ModelName, // Changed from gemini-3-pro-image to support Vertex
  EVALUATION: 'gemini-2.5-flash' as ModelName,
  GARMENT_ANALYSIS: 'gemini-2.5-flash' as ModelName,
  SELFIE_CLASSIFICATION: 'gemini-2.5-flash' as ModelName,
} as const

export type StageName = keyof typeof STAGE_MODEL

/** Fallback model when stage config is missing */
export const DEFAULT_MODEL: ModelName = 'gemini-2.5-flash-image'

/**
 * Get the provider-specific model name for a given canonical model and provider.
 * Returns null if the model is not available on the provider.
 */
export function getModelNameForProvider(
  model: ModelName,
  provider: ModelProvider
): string | null {
  return MODEL_CONFIG[model].providers[provider]
}

/**
 * Get the first available provider for a model based on PROVIDER_FALLBACK_ORDER.
 * Returns the first provider in the fallback order that supports this model.
 */
export function getFirstAvailableProvider(model: ModelName): ModelProvider | null {
  const modelConfig = MODEL_CONFIG[model]
  for (const provider of PROVIDER_FALLBACK_ORDER) {
    if (modelConfig.providers[provider] !== null) {
      return provider
    }
  }
  return null
}

/**
 * Get the model configuration for a given stage.
 */
export function getStageModelConfig(stage: StageName): {
  model: ModelName
  firstAvailableProvider: ModelProvider | null
  getProviderModelName: (provider: ModelProvider) => string | null
} {
  const model = STAGE_MODEL[stage]
  return {
    model,
    firstAvailableProvider: getFirstAvailableProvider(model),
    getProviderModelName: (provider: ModelProvider) => getModelNameForProvider(model, provider),
  }
}

