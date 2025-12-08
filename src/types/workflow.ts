import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'

export interface PersistedImageReference {
  key: string
  mimeType: string
  description?: string
}

export interface V3CachedPayload {
  prompt: string
  mustFollowRules: string[]
  freedomRules: string[]
  aspectRatio: string
  aspectRatioDescription: string
}

export interface V3WorkflowState {
  cachedPayload?: V3CachedPayload
  composites?: {
    selfie?: PersistedImageReference
    background?: PersistedImageReference
  }
  step1a?: {
    personImage: PersistedImageReference
    personAssetId?: string // Asset ID for person-on-white intermediate
    backgroundImage?: PersistedImageReference
    clothingLogoReference?: BaseReferenceImage
    backgroundLogoReference?: BaseReferenceImage
    evaluatorComments?: string[]
  }
  step1b?: {
    backgroundImage: PersistedImageReference
    backgroundAssetId?: string // Asset ID for background-with-branding intermediate
    backgroundLogoReference?: BaseReferenceImage
    evaluatorComments?: string[]
  }
}
/**
 * Unified type definitions for image generation workflows
 * Consolidates ReferenceImage, SelfieReference, and workflow-specific types
 */

import type { Job } from 'bullmq'
import type { PhotoStyleSettings } from './photo-style'

// Workflow Version
export type WorkflowVersion = 'v1' | 'v2' | 'v3'

// Unified Reference Image Type
export interface ReferenceImage {
  /** Optional label for the reference (e.g., "SELFIE1", "LOGO") */
  label?: string
  
  /** Base64-encoded image data */
  base64: string
  
  /** MIME type of the image */
  mimeType: string
  
  /** Optional description for AI context */
  description?: string
}

// Workflow Context
export interface WorkflowContext {
  /** Workflow version being executed */
  version: WorkflowVersion
  
  /** Generation ID */
  generationId: string
  
  /** Person ID */
  personId: string
  
  /** Optional user ID */
  userId?: string
  
  /** Optional team ID (for cost tracking and asset scoping) */
  teamId?: string
  
  /** Current attempt number (1-indexed) */
  currentAttempt: number
  
  /** Maximum attempts allowed */
  maxAttempts: number
  
  /** Debug mode flag */
  debugMode: boolean
  
  /** Optional stop after step (for debugging) */
  stopAfterStep?: number
  
  /** Asset IDs for input selfies (for fingerprinting) */
  selfieAssetIds?: string[]
  
  /** Asset ID for background (if custom) */
  backgroundAssetId?: string
  
  /** Asset ID for logo (if branding enabled) */
  logoAssetId?: string
}

// Generic Step Input/Output
export interface StepInput<T = unknown> {
  /** Workflow context */
  context: WorkflowContext
  
  /** Step-specific data */
  data: T
  
  /** BullMQ job for progress updates */
  job?: Job
}

export interface StepOutput<T = unknown> {
  /** Whether the step succeeded */
  success: boolean
  
  /** Step output data (if successful) */
  data?: T
  
  /** Error (if failed) */
  error?: Error
  
  /** Whether the step should be retried */
  shouldRetry: boolean
  
  /** Optional retry context/feedback */
  retryContext?: unknown
}

// Evaluation Feedback
export interface EvaluationFeedback {
  /** Evaluation status */
  status: 'Approved' | 'Not Approved'
  
  /** Reason for the status */
  reason: string
  
  /** Failed criteria identifiers */
  failedCriteria?: string[]
  
  /** Suggested adjustments for retry */
  suggestedAdjustments?: string
}

// Retry Context
export interface RetryContext {
  /** Current attempt number */
  attempt: number
  
  /** Maximum attempts allowed */
  maxAttempts: number
  
  /** Feedback from previous attempt */
  previousFeedback?: EvaluationFeedback
}

// Download Functions
export type DownloadAssetFn = (key: string) => Promise<{ base64: string; mimeType: string }>
export type DownloadSelfieFn = (key: string) => Promise<{ base64: string; mimeType: string }>

// Common Workflow Input
export interface BaseWorkflowInput {
  /** BullMQ job */
  job: Job
  
  /** Generation ID */
  generationId: string
  
  /** Person ID */
  personId: string
  
  /** Optional user ID */
  userId?: string
  
  /** Optional team ID (for cost tracking and asset scoping) */
  teamId?: string
  
  /** Selfie references */
  selfieReferences: ReferenceImage[]
  
  /** Asset IDs for input selfies (for fingerprinting and cost tracking) */
  selfieAssetIds?: string[]
  
  /** Style settings */
  styleSettings: PhotoStyleSettings
  
  /** Generation prompt */
  prompt: string
  
  /** Aspect ratio */
  aspectRatio: string
  
  /** Optional resolution */
  resolution?: '1K' | '2K' | '4K'
  
  /** Asset download function */
  downloadAsset: DownloadAssetFn
  
  /** Current attempt number */
  currentAttempt: number
  
  /** Maximum attempts */
  maxAttempts: number
  
  /** Debug mode */
  debugMode?: boolean
  
  /** Stop after step (for debugging) */
  stopAfterStep?: number
}

// Common Workflow Result
export interface WorkflowResult {
  /** Approved image buffers */
  approvedImageBuffers: Buffer[]
}

// Re-export for backward compatibility with existing code
export type { ReferenceImage as SelfieReference }

