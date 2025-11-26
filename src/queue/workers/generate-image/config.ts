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
  /** Tolerance for dimension mismatch (pixels) */
  DIMENSION_TOLERANCE_PX: 2,
  
  /** Tolerance for aspect ratio mismatch (ratio) */
  ASPECT_RATIO_TOLERANCE: 0.02
} as const

// AI Generation Parameters
export const AI_CONFIG = {
  /** Temperature for initial generation (0.0-1.0) */
  GENERATION_TEMPERATURE: 0.5,
  
  /** Temperature for evaluation (0.0-1.0) */
  EVALUATION_TEMPERATURE: 0.2,
  
  /** Temperature for refinement (0.0-1.0) */
  REFINEMENT_TEMPERATURE: 0.4
} as const

// Progress Tracking Configuration
export const PROGRESS_CONFIG = {
  /** Minimum time between identical progress updates (milliseconds) */
  UPDATE_DEBOUNCE_MS: 100
} as const

// Workflow Step Progress Percentages
export const PROGRESS_STEPS = {
  // V3 Workflow (Parallel)
  V3_INIT: 10,
  V3_PREPARING: 15,
  V3_GENERATING_PERSON: 20, // Step 1a: Person generation
  V3_EVALUATING_PERSON: 35, // Step 1a eval
  V3_GENERATING_BACKGROUND: 25, // Step 1b: Background generation (parallel with 1a)
  V3_EVALUATING_BACKGROUND: 40, // Step 1b eval
  V3_COMPOSITING: 50, // Step 2: Composition/refinement
  V3_FINAL_EVAL: 80, // Step 3: Final evaluation
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

