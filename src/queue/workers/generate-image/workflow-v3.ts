import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import type { Job } from 'bullmq'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { DownloadAssetFn, EvaluationFeedback } from '@/types/generation'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import { resolveAspectRatioConfig } from '@/domain/style/elements/aspect-ratio/config'
import { hasValue } from '@/domain/style/elements/base/element-types'
import type { PersistedImageReference, V3WorkflowState } from '@/types/workflow'
import { executeStep0Preparation } from './steps/v3-step0-preparation'
import { executeV3Step1a } from './steps/v3-step1a-person-generation'
import { executeV3Step1aEval } from './steps/v3-step1a-person-eval'
import { executeV3Step1b } from './steps/v3-step1b-background-generation'
import { executeV3Step1bEval } from './steps/v3-step1b-background-eval'
import { executeV3Step2 } from './steps/v3-step2-final-composition'
import { executeV3Step3 } from './steps/v3-step3-final-eval'

import { getVertexGenerativeModel } from './gemini'
import type { Part } from '@google-cloud/vertexai'

type LightingPrompt = {
  scene?: { description?: string }
  lighting?: { direction?: string }
} & Record<string, unknown>

// Import cost tracking types
import type { CostReason, CostResult } from '@/domain/services/CostTrackingService'
import type { AIModelId, AIProvider } from '@/config/ai-costs'

// Import asset management services
import { AssetService } from '@/domain/services/AssetService'
import { StyleFingerprintService } from '@/domain/services/StyleFingerprintService'

// Import shared utilities
import {
  type ReferenceImage
} from './utils/reference-builder'
import {
  executeWithRateLimitRetry,
  formatProgressWithAttempt,
  updateJobProgress,
  createProgressRetryCallback
} from './utils/retry-handler'
import { saveIntermediateFile, saveAllIntermediateImages } from './utils/debug-helpers'
import {
  buildEvaluationFeedback,
  isApproved,
  logEvaluationResult,
  checkMaxAttemptsAndThrow
} from './utils/evaluation-orchestrator'
import { logStepStart } from './utils/logging'
import { EvaluationFailedError } from './errors'
import type { ImageEvaluationResult } from './evaluator'
import { getProgressMessage } from '@/lib/generation-progress-messages'
import { buildBackgroundComposite } from '@/lib/generation/reference-utils'

// Import configuration
import { RETRY_CONFIG, PROGRESS_STEPS, STAGE_RESOLUTION } from './config'

/**
 * Get the resolution multiplier for scaling expected dimensions
 * 1K = 1x (base), 2K = 2x, 4K = 4x
 */
function getResolutionMultiplier(resolution?: '1K' | '2K' | '4K'): number {
  switch (resolution) {
    case '4K': return 4
    case '2K': return 2
    case '1K':
    default: return 1
  }
}

/**
 * Cost tracking context for workflow steps
 */
export interface CostTrackingContext {
  teamId?: string
  selfieAssetIds?: string[]
  workflowVersion: string
}

/**
 * Handler for tracking costs after each AI call
 */
export type CostTrackingHandler = (params: {
  stepName: string
  reason: CostReason
  result: CostResult
  model: AIModelId
  provider?: AIProvider  // Actual provider used (vertex, gemini-rest, or replicate)
  inputTokens?: number
  outputTokens?: number
  imagesGenerated?: number
  durationMs?: number
  errorMessage?: string
  outputAssetId?: string
  reusedAssetId?: string
  // NEW: Evaluation outcome tracking
  evaluationStatus?: 'approved' | 'rejected'
  rejectionReason?: string
  intermediateS3Key?: string
}) => Promise<void>

export interface V3WorkflowInput {
  job: Job
  generationId: string
  personId: string
  userId?: string
  teamId?: string // For cost tracking
  selfieReferences: { label: string; base64: string; mimeType: string }[]
  selfieAssetIds?: string[] // For fingerprinting and cost tracking
  backgroundAssetId?: string // Background asset ID for fingerprinting
  logoAssetId?: string // Logo asset ID for fingerprinting
  demographics?: import('@/domain/selfie/selfieDemographics').DemographicProfile // Aggregated demographics
  selfieComposite?: ReferenceImage
  faceComposite?: ReferenceImage // Split face composite (front_view + side_view selfies)
  bodyComposite?: ReferenceImage // Split body composite (partial_body + full_body selfies)
  styleSettings: PhotoStyleSettings
  prompt: string // JSON only (no rules)
  mustFollowRules: string[] // Rules from elements
  freedomRules: string[] // Freedom rules from elements
  referenceImages?: BaseReferenceImage[] // Pre-built reference images (e.g., garment collage from outfit1)
  aspectRatio: string
  resolution?: '1K' | '2K' | '4K'
  downloadAsset: DownloadAssetFn
  currentAttempt: number
  maxAttempts: number
  debugMode?: boolean
  stopAfterStep?: number // Stop execution after this step (1-4). Useful for debugging.
  workflowState?: V3WorkflowState
  persistWorkflowState: (state: V3WorkflowState | undefined) => Promise<void>
  intermediateStorage: IntermediateStorageHandlers
  onCostTracking?: CostTrackingHandler // Optional handler for cost tracking
}

export interface V3WorkflowResult {
  approvedImageBuffers: Buffer[]
}

interface IntermediateStorageHandlers {
  saveBuffer: (
    buffer: Buffer,
    meta: { fileName: string; description?: string; label?: string; mimeType?: string }
  ) => Promise<PersistedImageReference>
  loadBuffer: (reference: PersistedImageReference) => Promise<Buffer>
}


/**
 * Helper to analyze lighting from an image using Gemini
 */
async function analyzeLightingFromImage(imageBuffer: Buffer): Promise<string> {
  try {
    // Use a fast multimodal model for analysis
    const modelName = Env.string('GEMINI_IMAGE_MODEL', 'gemini-1.5-flash-002')
    const model = await getVertexGenerativeModel(modelName)

    const parts: Part[] = [
      { text: "Analyze the lighting in this image. Is the primary light source coming from the left, right, top, or is it soft/dispersed? Return ONLY a short phrase describing the lighting direction (e.g., 'lighting coming from the left', 'soft dispersed lighting'). Do not include any other text." },
      { inlineData: { mimeType: 'image/png', data: imageBuffer.toString('base64') } }
    ]

    const result = await model.generateContent({ contents: [{ role: 'user', parts }] })
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return text.trim() || 'soft dispersed lighting'
  } catch (error) {
    Logger.warn('Failed to analyze lighting from image', { error })
    return 'soft dispersed lighting' // Fallback
  }
}

/**
 * Helper to determine lighting direction based on background type
 */
async function determineLighting(
  styleSettings: PhotoStyleSettings,
  promptObj: LightingPrompt,
  downloadAsset: DownloadAssetFn,
  generationId: string
): Promise<string> {
  // 1. Custom Background: Analyze the image
  const bgValue = styleSettings.background?.value
  if (bgValue?.type === 'custom' && bgValue.key) {
    try {
      const asset = await downloadAsset(bgValue.key)
      if (asset) {
        const buffer = Buffer.from(asset.base64, 'base64')
        const direction = await analyzeLightingFromImage(buffer)
        Logger.debug('V3: Analyzed custom background lighting', { generationId, direction })
        return direction
      }
    } catch (e) {
      Logger.warn('V3: Failed to download custom background for lighting analysis', {
        generationId,
        error: e instanceof Error ? e.message : String(e)
      })
    }
  }

  // 2. Generated Background Logic
  const sceneDesc = (promptObj.scene?.description || '').toLowerCase()
  const bgType = (bgValue?.type || '').toLowerCase()

  // Outdoor / Nature
  if (bgType === 'outdoor' || sceneDesc.includes('outdoor') || sceneDesc.includes('outside') || sceneDesc.includes('park') || sceneDesc.includes('nature') || sceneDesc.includes('sky')) {
    return 'soft dispersed natural lighting'
  }

  // Office / Indoor with Window
  if (bgType === 'office' || sceneDesc.includes('office') || sceneDesc.includes('indoor') || sceneDesc.includes('window')) {
    const side = Math.random() > 0.5 ? 'left' : 'right'
    return `natural window light coming from the ${side}`
  }

  // Default (Studio / Neutral / Gradient / Other)
  const side = Math.random() > 0.5 ? 'left' : 'right'
  return `soft studio lighting coming from the ${side}`
}

/**
 * Step 1a: Generate person with retry on evaluation rejection
 */
async function generatePersonWithRetry({
  job,
  processedSelfieReferences,
  selfieComposite,
  faceComposite,
  bodyComposite,
  styleSettings,
  downloadAsset,
  aspectRatio,
  aspectRatioConfig,
  expectedWidth,
  expectedHeight,
  prompt,
  mustFollowRules,
  freedomRules,
  referenceImages,
  generationId,
  personId,
  teamId,
  selfieAssetIds,
  demographics,
  onCostTracking,
  debugMode,
  stopAfterStep,
  formatProgress,
  intermediateStorage,
  preparedAssets
}: {
  job: Job
  processedSelfieReferences: ReferenceImage[]
  selfieComposite?: ReferenceImage
  faceComposite?: ReferenceImage // Split face composite (front_view + side_view selfies)
  bodyComposite?: ReferenceImage // Split body composite (partial_body + full_body selfies)
  styleSettings: PhotoStyleSettings
  downloadAsset: DownloadAssetFn
  aspectRatio: string
  aspectRatioConfig: { id: string; width: number; height: number }
  expectedWidth: number
  expectedHeight: number
  prompt: string
  mustFollowRules: string[]
  freedomRules: string[]
  referenceImages?: BaseReferenceImage[]
  generationId: string
  personId: string
  teamId?: string
  selfieAssetIds?: string[]
  demographics?: import('@/domain/selfie/selfieDemographics').DemographicProfile
  onCostTracking?: CostTrackingHandler
  debugMode: boolean
  stopAfterStep?: number
  formatProgress: (message: { message: string; emoji?: string }, progress: number) => string
  intermediateStorage: IntermediateStorageHandlers
  preparedAssets?: Map<string, import('@/domain/style/elements/composition').PreparedAsset>
}): Promise<{ imageBuffer: Buffer; imageBase64: string; assetId?: string; clothingLogoReference?: BaseReferenceImage; backgroundLogoReference?: BaseReferenceImage; backgroundBuffer?: Buffer; selfieComposite?: BaseReferenceImage; faceComposite?: BaseReferenceImage; bodyComposite?: BaseReferenceImage; evaluatorComments: string[]; reused?: boolean } | undefined> {
  let step1Output: { imageBuffer: Buffer; imageBase64: string; allImageBuffers: Buffer[]; assetId?: string; clothingLogoReference?: BaseReferenceImage; backgroundLogoReference?: BaseReferenceImage; backgroundBuffer?: Buffer; selfieComposite?: BaseReferenceImage; faceComposite?: BaseReferenceImage; bodyComposite?: BaseReferenceImage; reused?: boolean } | undefined
  let evaluationFeedback: EvaluationFeedback | undefined
  const evaluatorComments: string[] = []

  // Calculate expected dimensions for Step 1a based on resolution config
  const step1aResolution = STAGE_RESOLUTION.STEP_1A_PERSON || '1K'
  const step1aMultiplier = getResolutionMultiplier(step1aResolution)
  const step1aExpectedWidth = expectedWidth * step1aMultiplier
  const step1aExpectedHeight = expectedHeight * step1aMultiplier

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt === 1) {
      logStepStart('V3 Step 1a: Generating person on grey background', generationId)
    }
    if (attempt === 1) Logger.info('V3 Step 1a: Generating person')

    await updateJobProgress(job, PROGRESS_STEPS.V3_GENERATING_PERSON, formatProgress(getProgressMessage('v3-generating-person'), PROGRESS_STEPS.V3_GENERATING_PERSON))

    // Generate with rate limit retry
    const currentStep1Output = await executeWithRateLimitRetry(
      async () => {
        return await executeV3Step1a({
          selfieReferences: processedSelfieReferences,
          selfieComposite,
          faceComposite, // Split face composite (front_view + side_view selfies)
          bodyComposite, // Split body composite (partial_body + full_body selfies)
          styleSettings,
          downloadAsset,
          aspectRatio,
          aspectRatioConfig,
          expectedWidth: step1aExpectedWidth,
          expectedHeight: step1aExpectedHeight,
          prompt,
          mustFollowRules,
          freedomRules,
          referenceImages, // Pre-built references from package (e.g., outfit collage)
          generationId: `v3-step1a-${Date.now()}`,
          personId,
          teamId,
          selfieAssetIds,
          demographics, // Aggregated demographics for prompt context
          onCostTracking,
          debugMode,
          evaluationFeedback,
          preparedAssets // Assets from step 0 preparation
        })
      },
      {
        maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
        sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
        operationName: 'V3 Step 1a person generation'
      },
      createProgressRetryCallback(job, PROGRESS_STEPS.V3_GENERATING_PERSON)
    )

    step1Output = currentStep1Output
    // Save all images returned by the model (for debugging multiple candidates)
    await saveAllIntermediateImages(step1Output.allImageBuffers, 'v3-step1a-person-grey-bg', generationId, debugMode)

    if (stopAfterStep === 1) {
      Logger.info('V3: Stopping after Step 1a (person generation complete)', {
        generationId,
        imageSize: step1Output.imageBuffer.length
      })
      throw new Error('Stopped after Step 1a (debug mode)')
    }

    // Evaluate
    if (attempt === 1) {
      logStepStart('V3 Step 1a Eval: Evaluating person', generationId)
    }
    await updateJobProgress(job, PROGRESS_STEPS.V3_EVALUATING_PERSON, formatProgress({ message: 'Evaluating quality...', emoji: '🔍' }, PROGRESS_STEPS.V3_EVALUATING_PERSON))

    // Evaluation logging handled inside executeV3Step1aEval

    // Upload to S3 for evaluation tracking (gets S3 key for cost tracking)
    const intermediateS3Upload = (selfieAssetIds && selfieAssetIds.length > 0)
      ? await intermediateStorage.saveBuffer(step1Output.imageBuffer, {
        fileName: `step1a-person-eval-${attempt}-${Date.now()}.png`,
        description: `V3 Step 1a person eval attempt ${attempt}`,
        mimeType: 'image/png'
      })
      : undefined

    // Extract garment collage - check both referenceImages (from buildGenerationPayload)
    // and preparedAssets (from step 0 preparation)
    let garmentCollageReference = referenceImages?.find(ref =>
      ref.description?.toLowerCase().includes('garment') ||
      ref.description?.toLowerCase().includes('collage')
    )

    // If not in referenceImages, check preparedAssets (where CustomClothingElement.prepare() stores it)
    if (!garmentCollageReference && preparedAssets) {
      const preparedCollage = preparedAssets.get('custom-clothing-garment-collage')
      if (preparedCollage?.data.base64) {
        garmentCollageReference = {
          base64: preparedCollage.data.base64,
          mimeType: preparedCollage.data.mimeType || 'image/png',
          description: 'Garment collage showing authorized clothing and accessories for this outfit',
        }
        Logger.debug('V3 Step 1a Eval: Using garment collage from preparedAssets')
      }
    }

    const step2Output = await executeWithRateLimitRetry(
      async () => {
        return await executeV3Step1aEval({
          imageBuffer: step1Output!.imageBuffer,
          imageBase64: step1Output!.imageBase64,
          selfieReferences: processedSelfieReferences,
          selfieComposite,
          faceComposite,
          bodyComposite,
          expectedWidth: step1aExpectedWidth,
          expectedHeight: step1aExpectedHeight,
          aspectRatioConfig,
          generationPrompt: prompt,
          clothingLogoReference: step1Output!.clothingLogoReference,
          garmentCollageReference, // Pass garment collage to authorize accessories
          generationId,
          personId,
          teamId,
          intermediateS3Key: intermediateS3Upload?.key,
          onCostTracking,
        })
      },
      {
        maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
        sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
        operationName: 'V3 Step 1a Eval'
      },
      createProgressRetryCallback(job, PROGRESS_STEPS.V3_EVALUATING_PERSON)
    )

    // Build feedback for next attempt if needed
    const evaluation = step2Output.evaluation
    evaluationFeedback = buildEvaluationFeedback(evaluation)

    // Collect evaluator comments for Step 2
    if (evaluationFeedback.suggestedAdjustments) {
      evaluatorComments.push(evaluationFeedback.suggestedAdjustments)
    }

    const approved = isApproved(evaluation)
    logEvaluationResult('V3 Step 1a Eval', attempt, evaluation, approved)

    if (approved) {
      // Clear comments on success to avoid ghost feedback from previous failed attempts
      evaluatorComments.length = 0
      break
    }

    checkMaxAttemptsAndThrow('V3 Step 1a', attempt, 3, evaluation)
  }

  if (!step1Output) {
    throw new Error('V3 Step 1a: Failed to generate person')
  }

  return { ...step1Output, evaluatorComments }
}

/**
 * Step 1b: Generate background with branding (DISABLED - always returns undefined)
 * 
 * Background and branding are now handled in Step 2 via element composition.
 * Custom backgrounds are user-uploaded images that don't need AI generation.
 */
async function generateBackgroundWithRetry({
  job,
  styleSettings,
  downloadAsset,
  aspectRatio,
  prompt,
  generationId,
  personId,
  teamId,
  backgroundAssetId,
  logoAssetId,
  onCostTracking,
  debugMode,
  formatProgress,
  backgroundComposite,
  intermediateStorage,
  preparedAssets
}: {
  job: Job
  styleSettings: PhotoStyleSettings
  downloadAsset: DownloadAssetFn
  aspectRatio: string
  prompt: string
  generationId: string
  personId: string
  teamId?: string
  backgroundAssetId?: string
  logoAssetId?: string
  onCostTracking?: CostTrackingHandler
  debugMode: boolean
  formatProgress: (message: { message: string; emoji?: string }, progress: number) => string
  backgroundComposite?: BaseReferenceImage
  intermediateStorage: IntermediateStorageHandlers
  preparedAssets?: Map<string, import('@/domain/style/elements/composition').PreparedAsset>
}): Promise<{ backgroundBuffer: Buffer; backgroundBase64: string; assetId?: string; backgroundLogoReference: BaseReferenceImage; evaluatorComments: string[]; compositeReference?: BaseReferenceImage; reused?: boolean } | undefined> {
  // ============================================================================
  // STEP 1B DISABLED - TO RE-ENABLE: Comment out the return statement below
  // ============================================================================
  // Background generation (including custom backgrounds) and logo branding are 
  // now handled in Step 2 via element composition. Custom backgrounds are 
  // user-uploaded images that don't need AI generation.
  //
  // To re-enable Step 1b: Comment out lines 465-470 and uncomment lines 472-659
  // ============================================================================

  const brandingValue = hasValue(styleSettings.branding) ? styleSettings.branding.value : undefined

  Logger.info('V3 Step 1b: Skipping background generation (Step 1b disabled)', {
    backgroundType: styleSettings.background?.value?.type,
    brandingPosition: brandingValue?.position,
    note: 'All background and branding handled in Step 2 for better integration'
  })
  return undefined

  /* COMMENTED OUT - TO RE-ENABLE STEP 1B, UNCOMMENT FROM HERE...
  
  // Check if Step 1b should run
  // Step 1b ONLY runs for custom backgrounds
  // Logo branding on background/elements is handled in Step 2 via element composition
  const bgValue1b = styleSettings.background?.value
  const hasCustomBackground = bgValue1b?.type === 'custom' && bgValue1b.key

  const shouldRunStep1b = hasCustomBackground

  if (!shouldRunStep1b) {
    Logger.info('V3 Step 1b: Skipping background generation (no custom background)', {
      hasCustomBackground,
      brandingPosition: brandingValue?.position,
      note: 'Logo branding handled in Step 2 for better integration'
    })
    return undefined
  }

  Logger.info('V3 Step 1b: Will generate background for custom background', {
    hasCustomBackground,
    brandingPosition: brandingValue?.position
  })

  // Load logo for branding - use prepared asset from Step 0
  // MUST be labeled "logo" to match config instructions ("Use the attached image labeled 'logo'")
  let brandingLogoReference: BaseReferenceImage | undefined
  if (brandingValue?.type === 'include') {
    const preparedLogo = preparedAssets?.get('branding-logo')
    if (preparedLogo?.data.base64) {
      brandingLogoReference = {
        description: 'LOGO - This is the exact logo to reproduce. COPY THIS LOGO EXACTLY: every letter, icon, shape, and color must be reproduced with PERFECT ACCURACY. Do NOT interpret, stylize, or modify - reproduce EXACTLY as shown. NOTE: If the logo has a bright green background, that is a chroma key for visibility only - do NOT include the green background in the output, only the logo elements.',
        base64: preparedLogo.data.base64,
        mimeType: preparedLogo.data.mimeType || 'image/png'
      }
      Logger.debug('V3 Step 1b: Using prepared logo asset (SVG already converted)', {
        generationId,
        mimeType: preparedLogo.data.mimeType,
        position: brandingValue.position
      })
    } else {
      Logger.warn('V3 Step 1b: Prepared logo asset not found', {
        generationId,
        preparedAssetKeys: Array.from(preparedAssets?.keys() || [])
      })
      return undefined
    }
  }

  // Load custom background if specified
  let customBackgroundReference: BaseReferenceImage | undefined
  if (bgValue1b?.type === 'custom' && bgValue1b.key) {
    try {
      const bgAsset = await downloadAsset(bgValue1b.key)
      if (bgAsset) {
        customBackgroundReference = {
          description: `Custom background image`,
          base64: bgAsset.base64,
          mimeType: bgAsset.mimeType
        }
        Logger.info('V3 Step 1b: Custom background loaded', { generationId })
      }
    } catch (error) {
      Logger.warn('Failed to load custom background for Step 1b', { error })
      // Continue without custom background - it's not critical for Step 1b
    }
  }

  if (!brandingLogoReference) {
    Logger.warn('V3 Step 1b: No logo reference available, skipping')
    return undefined
  }

  const evaluatorComments: string[] = []
  let cachedComposite = backgroundComposite

  if (!cachedComposite) {
    try {
      cachedComposite = await buildBackgroundComposite({
        customBackgroundReference,
        logoReference: brandingLogoReference,
        generationId
      })
    } catch (error) {
      Logger.error('V3 Step 1b: Failed to build background composite reference', {
        generationId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  // Track last generated output in case all evaluations fail
  // We'll return this to Step 2 so it can at least attempt to preserve it
  let lastGeneratedOutput: Awaited<ReturnType<typeof executeV3Step1b>> | undefined

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt === 1) {
      logStepStart('V3 Step 1b: Generating background with branding', generationId)
    }
    Logger.debug('V3 Step 1b: Generating background with branding', { attempt, max: 3 })

    await updateJobProgress(job, PROGRESS_STEPS.V3_GENERATING_BACKGROUND, formatProgress(getProgressMessage('v3-generating-background'), PROGRESS_STEPS.V3_GENERATING_BACKGROUND))

    // Generate with rate limit retry
    const step1bOutput = await executeWithRateLimitRetry(
      async () => {
        return await executeV3Step1b({
          prompt,
          brandingLogoReference: brandingLogoReference!,
          customBackgroundReference,
          aspectRatio,
          generationId: `v3-step1b-${Date.now()}`,
          personId,
          teamId,
          styleSettings,
          backgroundAssetId,
          logoAssetId,
          onCostTracking,
          debugMode,
          backgroundComposite: cachedComposite,
          preparedAssets // Assets from step 0
        })
      },
      {
        maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
        sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
        operationName: 'V3 Step 1b background generation'
      },
      createProgressRetryCallback(job, PROGRESS_STEPS.V3_GENERATING_BACKGROUND)
    )

    // Save this output in case all evaluations fail
    lastGeneratedOutput = step1bOutput

    await saveIntermediateFile(step1bOutput.backgroundBuffer, 'v3-step1b-background-with-branding', generationId, debugMode)

    // Evaluate
    if (attempt === 1) {
      logStepStart('V3 Step 1b Eval: Evaluating background', generationId)
    }
    await updateJobProgress(job, PROGRESS_STEPS.V3_EVALUATING_BACKGROUND, formatProgress({ message: 'Checking background quality...', emoji: '🔍' }, PROGRESS_STEPS.V3_EVALUATING_BACKGROUND))

    Logger.debug('V3 Step 1b Eval: Evaluating background', { attempt })

    // Upload to S3 for evaluation tracking (gets S3 key for cost tracking)
    const intermediateS3Upload = (backgroundAssetId || logoAssetId)
      ? await intermediateStorage.saveBuffer(step1bOutput.backgroundBuffer, {
          fileName: `step1b-background-eval-${attempt}-${Date.now()}.png`,
          description: `V3 Step 1b background eval attempt ${attempt}`,
          mimeType: 'image/png'
        })
      : undefined

    const evalOutput = await executeWithRateLimitRetry(
      async () => {
        return await executeV3Step1bEval({
          backgroundBuffer: step1bOutput.backgroundBuffer,
          backgroundBase64: step1bOutput.backgroundBase64,
          logoReference: brandingLogoReference,
          generationId: `v3-step1b-eval-${Date.now()}`,
          personId,
          teamId,
          intermediateS3Key: intermediateS3Upload?.key,
          onCostTracking,
        })
      },
      {
        maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
        sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
        operationName: 'V3 Step 1b Eval'
      },
      createProgressRetryCallback(job, PROGRESS_STEPS.V3_EVALUATING_BACKGROUND)
    )

    const evaluation = evalOutput.evaluation
    if (!cachedComposite && step1bOutput.compositeReference) {
      cachedComposite = step1bOutput.compositeReference
    }
    
    // Collect evaluator comments for Step 2
    const feedback = buildEvaluationFeedback(evaluation)
    if (feedback.suggestedAdjustments) {
      evaluatorComments.push(feedback.suggestedAdjustments)
    }

    const approved = isApproved(evaluation)
    logEvaluationResult('V3 Step 1b Eval', attempt, evaluation, approved)

    if (approved) {
      // Clear comments on success to avoid ghost feedback from previous failed attempts
      return { ...step1bOutput, evaluatorComments: [], compositeReference: cachedComposite ?? step1bOutput.compositeReference }
    }

    checkMaxAttemptsAndThrow('V3 Step 1b', attempt, 3, evaluation)
  }

  // All evaluation attempts failed, but return the last generated background anyway
  // This allows Step 2 to at least attempt to preserve it rather than regenerating from scratch
  if (lastGeneratedOutput) {
    Logger.warn('V3 Step 1b: All evaluations failed, but returning last generated background for Step 2 to use as reference', {
      generationId,
      evaluatorCommentsCount: evaluatorComments.length
    })
    return { 
      ...lastGeneratedOutput, 
      evaluatorComments, 
      compositeReference: cachedComposite ?? lastGeneratedOutput.compositeReference 
    }
  }

  throw new Error('V3 Step 1b: Failed to generate background after retries')
  
  ...TO HERE TO RE-ENABLE STEP 1B */
}

/**
 * Execute the V3 workflow
 * Step 1a (Person) generates the person on neutral background
 * Step 1b (Background) is DISABLED - background handled in Step 2
 * Step 2 (Composition/Refinement) combines person with background and applies branding
 * Step 3 (Final Eval) validates the result
 */
export async function executeV3Workflow({
  job,
  generationId,
  personId,
  userId,
  teamId,
  selfieReferences,
  selfieAssetIds,
  backgroundAssetId,
  logoAssetId,
  demographics,
  selfieComposite,
  faceComposite, // Split face composite (front_view + side_view selfies)
  bodyComposite, // Split body composite (partial_body + full_body selfies)
  styleSettings,
  prompt,
  mustFollowRules,
  freedomRules,
  referenceImages,
  aspectRatio,
  resolution,
  downloadAsset,
  currentAttempt,
  debugMode = false,
  stopAfterStep,
  workflowState,
  persistWorkflowState,
  intermediateStorage,
  onCostTracking
}: V3WorkflowInput): Promise<V3WorkflowResult> {
  Logger.debug('V3 workflow start', { generationId, personId, userId, teamId })
  // Get expected dimensions from aspect ratio
  const aspectRatioConfig = resolveAspectRatioConfig(aspectRatio)
  const expectedWidth = aspectRatioConfig.width
  const expectedHeight = aspectRatioConfig.height

  // Selfie rotation is already normalized in generateImage.ts before PNG conversion
  // No need to normalize again here
  const processedSelfieReferences = selfieReferences

  // Determine and inject consistent lighting direction
  try {
    const promptObj = JSON.parse(prompt) as LightingPrompt
    if (!promptObj.lighting) {
      promptObj.lighting = {}
    }

    // Only determine if not explicitly provided
    if (!promptObj.lighting.direction) {
      const direction = await determineLighting(styleSettings, promptObj, downloadAsset, generationId)
      promptObj.lighting.direction = direction

      // Update prompt string with injected lighting
      prompt = JSON.stringify(promptObj)
      Logger.debug('V3: Injected consistent lighting direction', { generationId, direction })
    }
  } catch (error) {
    Logger.warn('V3: Failed to parse/inject lighting into prompt', {
      generationId,
      error: error instanceof Error ? error.message : String(error)
    })
    // Continue with original prompt if parsing fails
  }

  let state = workflowState

  const mergeStatePatch = (patch?: V3WorkflowState): V3WorkflowState | undefined => {
    if (!patch) {
      return state
    }

    const next: V3WorkflowState = { ...(state ?? {}) }

    if (patch.cachedPayload) {
      next.cachedPayload = patch.cachedPayload
    }

    if (patch.composites) {
      next.composites = {
        ...(next.composites ?? {}),
        ...patch.composites
      }
    }

    if (patch.step1a) {
      next.step1a = patch.step1a
    }

    if (patch.step1b) {
      next.step1b = patch.step1b
    }

    state = next
    return state
  }

  const persistStatePatch = async (patch?: V3WorkflowState): Promise<void> => {
    if (!patch) return
    const nextState = mergeStatePatch(patch)
    await persistWorkflowState(nextState)
  }

  const toReferenceImage = async (ref: PersistedImageReference): Promise<BaseReferenceImage> => {
    const buffer = await intermediateStorage.loadBuffer(ref)
    return {
      base64: buffer.toString('base64'),
      mimeType: ref.mimeType,
      description: ref.description
    }
  }

  const bufferFromPersisted = async (ref?: PersistedImageReference): Promise<Buffer | undefined> => {
    if (!ref) return undefined
    return intermediateStorage.loadBuffer(ref)
  }

  // Helper to format progress messages with attempt info
  const formatProgress = (message: { message: string; emoji?: string }, progress: number): string => {
    return formatProgressWithAttempt(message, progress, currentAttempt)
  }

  // ===== STEP 0: ASSET PREPARATION =====
  // Execute preparation phase to download/create assets asynchronously
  Logger.info('V3: Starting Step 0 (asset preparation)', { generationId })

  let preparedAssets: Map<string, import('@/domain/style/elements/composition').PreparedAsset> | undefined

  try {
    const { executeStep0Preparation } = await import('./steps/v3-step0-preparation')
    const { getS3BucketName, createS3Client } = await import('@/lib/s3-client')

    const s3Client = createS3Client()

    const step0Result = await executeStep0Preparation({
      styleSettings,
      downloadAsset,
      s3Client,
      generationId,
      personId,
      teamId,
      selfieS3Keys: selfieReferences.map(r => r.label), // Extract S3 keys from selfie references
      debugMode: debugMode || false,
    })

    preparedAssets = step0Result.preparedAssets

    if (step0Result.preparationErrors.length > 0) {
      Logger.warn('V3 Step 0: Some asset preparations failed', {
        generationId,
        errorCount: step0Result.preparationErrors.length,
        errors: step0Result.preparationErrors,
      })
    }

    Logger.info('V3 Step 0: Asset preparation complete', {
      generationId,
      preparedAssetCount: preparedAssets.size,
      assetKeys: Array.from(preparedAssets.keys()),
    })

    // OPTIMIZATION: Store preparedLogoKey in branding settings for reuse in regenerations
    if (hasValue(styleSettings.branding) && styleSettings.branding.value.type === 'include') {
      const preparedLogo = preparedAssets.get('branding-logo')
      if (preparedLogo?.data.metadata?.preparedLogoS3Key) {
        const preparedKey = preparedLogo.data.metadata.preparedLogoS3Key as string
          // Update branding settings with prepared logo key for future regenerations
          ; (styleSettings.branding.value as { preparedLogoKey?: string }).preparedLogoKey = preparedKey
        Logger.info('V3 Step 0: Stored preparedLogoKey in branding settings for regeneration reuse', {
          generationId,
          preparedLogoKey: preparedKey,
        })
      }
    }
  } catch (error) {
    Logger.error('V3 Step 0: Asset preparation failed', {
      generationId,
      error: error instanceof Error ? error.message : String(error),
    })
    // Continue without prepared assets - elements will fall back gracefully
  }

  Logger.info('V3: Preparing Step 1a execution (Step 1b disabled)', { generationId })

  type Step1aWrappedResult = {
    output: Awaited<ReturnType<typeof generatePersonWithRetry>>
    statePatch?: V3WorkflowState
  }

  type Step1bWrappedResult = {
    output?: Awaited<ReturnType<typeof generateBackgroundWithRetry>>
    statePatch?: V3WorkflowState
  }

  const step1aPromise: Promise<Step1aWrappedResult> = (async () => {
    if (state?.step1a) {
      const personBuffer = await bufferFromPersisted(state.step1a.personImage)
      if (!personBuffer) {
        throw new Error('Cached Step 1a person image missing from storage')
      }
      const backgroundBuffer = await bufferFromPersisted(state.step1a.backgroundImage)

      return {
        output: {
          imageBuffer: personBuffer,
          imageBase64: personBuffer.toString('base64'),
          clothingLogoReference: state.step1a.clothingLogoReference,
          backgroundLogoReference: state.step1a.backgroundLogoReference,
          backgroundBuffer,
          selfieComposite,
          evaluatorComments: state.step1a.evaluatorComments ?? []
        }
      }
    }

    const generatedOutput = await generatePersonWithRetry({
      job,
      processedSelfieReferences,
      selfieComposite,
      faceComposite, // Split face composite (front_view + side_view selfies)
      bodyComposite, // Split body composite (partial_body + full_body selfies)
      styleSettings,
      downloadAsset,
      aspectRatio,
      aspectRatioConfig,
      expectedWidth,
      expectedHeight,
      prompt,
      mustFollowRules,
      freedomRules,
      referenceImages,
      generationId,
      personId,
      teamId,
      selfieAssetIds,
      demographics, // Aggregated demographics for prompt context
      onCostTracking,
      debugMode,
      stopAfterStep,
      formatProgress,
      intermediateStorage,
      preparedAssets // Assets from step 0
    })

    if (!generatedOutput) {
      throw new Error('V3 Step 1a: Generation did not return an output')
    }

    const personImage = await intermediateStorage.saveBuffer(generatedOutput.imageBuffer, {
      fileName: `step1a-person-${Date.now()}.png`,
      description: 'V3 Step 1a person output',
      mimeType: 'image/png'
    })

    // Create Asset for person-on-white intermediate (if not reused)
    let personAssetId: string | undefined = generatedOutput.assetId
    if (!generatedOutput.reused && selfieAssetIds && selfieAssetIds.length > 0) {
      try {
        const personAsset = await AssetService.createAsset({
          s3Key: personImage.key,
          type: 'intermediate',
          subType: 'person_on_grey',
          mimeType: 'image/png',
          ownerType: teamId ? 'team' : 'person',
          teamId: teamId,
          personId: personId,
          parentAssetIds: selfieAssetIds,
          temporary: false, // Mark as permanent so it can be reused via fingerprinting
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days (for cleanup, but asset is reusable)
        })

        // Create and set fingerprint for future reuse
        const styleParams = StyleFingerprintService.extractFromStyleSettings(styleSettings as Record<string, unknown>)
        const fingerprint = StyleFingerprintService.createPersonFingerprint(
          selfieAssetIds,
          {
            aspectRatio: aspectRatio,
            expression: styleParams.expression,
            pose: styleParams.pose,
            shotType: styleParams.shotType,
            clothingType: styleParams.clothingType,
            clothingColor: styleParams.clothingColor,
            lighting: styleParams.lighting,
          }
        )

        await AssetService.updateFingerprint(personAsset.id, fingerprint, {
          ...styleParams,
          step: 'person_on_grey',
        })

        personAssetId = personAsset.id

        Logger.info('V3 Step 1a: Created Asset for person-on-grey intermediate', {
          assetId: personAsset.id,
          fingerprint,
          generationId,
        })
      } catch (error) {
        Logger.warn('V3 Step 1a: Failed to create asset for intermediate', {
          error: error instanceof Error ? error.message : String(error),
          generationId,
        })
      }
    }

    const backgroundImage = generatedOutput.backgroundBuffer
      ? await intermediateStorage.saveBuffer(generatedOutput.backgroundBuffer, {
        fileName: `step1a-background-${Date.now()}.png`,
        description: 'V3 Step 1a custom background',
        mimeType: 'image/png'
      })
      : undefined

    const patch: V3WorkflowState = {
      step1a: {
        personImage,
        personAssetId,
        backgroundImage,
        clothingLogoReference: generatedOutput.clothingLogoReference,
        backgroundLogoReference: generatedOutput.backgroundLogoReference,
        evaluatorComments: generatedOutput.evaluatorComments
      }
    }

    return {
      output: generatedOutput,
      statePatch: patch
    }
  })()

  const step1bPromise: Promise<Step1bWrappedResult> = (async () => {
    // Try to restore from cache if available
    if (state?.step1b) {
      try {
        const backgroundBuffer = await bufferFromPersisted(state.step1b.backgroundImage)
        const backgroundLogoReference =
          state.step1b.backgroundLogoReference ?? state.step1a?.backgroundLogoReference

        // Only use cache if both buffer AND logo reference are available
        if (backgroundBuffer && backgroundLogoReference) {
          Logger.info('V3 Step 1b: Restoring from cached state', { generationId })
          return {
            output: {
              backgroundBuffer,
              backgroundBase64: backgroundBuffer.toString('base64'),
              backgroundLogoReference,
              evaluatorComments: state.step1b.evaluatorComments ?? [],
              compositeReference: state.composites?.background
                ? await toReferenceImage(state.composites.background)
                : undefined
            }
          }
        }

        // Cache is incomplete - fall through to regenerate
        Logger.info('V3 Step 1b: Cached state incomplete, will regenerate', {
          generationId,
          hasBuffer: !!backgroundBuffer,
          hasLogoRef: !!backgroundLogoReference
        })
      } catch (error) {
        // Cache restoration failed - fall through to regenerate
        Logger.warn('V3 Step 1b: Failed to restore from cache, will regenerate', {
          generationId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    // No cache or cache incomplete - regenerate (this will also rebuild the composite fresh)
    const generatedOutput = await generateBackgroundWithRetry({
      job,
      styleSettings,
      downloadAsset,
      aspectRatio,
      prompt,
      generationId,
      personId,
      teamId,
      backgroundAssetId,
      logoAssetId,
      onCostTracking,
      debugMode,
      formatProgress,
      intermediateStorage,
      preparedAssets // Assets from step 0
      // Don't pass cached composite - let it rebuild fresh to ensure branding is included
    })

    if (!generatedOutput) {
      return { output: undefined }
    }

    const backgroundImage = await intermediateStorage.saveBuffer(generatedOutput.backgroundBuffer, {
      fileName: `step1b-background-${Date.now()}.png`,
      description: 'V3 Step 1b background output',
      mimeType: 'image/png'
    })

    // Create Asset for background-with-branding intermediate (if not reused)
    let backgroundAssetIdResult: string | undefined = generatedOutput.assetId
    if (!generatedOutput.reused && (backgroundAssetId || logoAssetId)) {
      try {
        const bgAsset = await AssetService.createAsset({
          s3Key: backgroundImage.key,
          type: 'intermediate',
          subType: 'background_with_branding',
          mimeType: 'image/png',
          ownerType: teamId ? 'team' : 'person',
          teamId: teamId,
          personId: personId,
          parentAssetIds: [backgroundAssetId, logoAssetId].filter((id): id is string => !!id),
          temporary: false, // Mark as permanent so it can be reused via fingerprinting
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days (for cleanup, but asset is reusable)
        })

        // Create and set fingerprint for future reuse
        const styleParams = StyleFingerprintService.extractFromStyleSettings(styleSettings as Record<string, unknown>)
        const fingerprint = StyleFingerprintService.createBackgroundFingerprint(
          backgroundAssetId || null,
          logoAssetId || null,
          {
            backgroundType: styleParams.backgroundType,
            backgroundColor: styleParams.backgroundColor,
            backgroundGradient: styleParams.backgroundGradient,
            brandingPosition: styleParams.brandingPosition,
            aspectRatio: aspectRatio,
          }
        )

        await AssetService.updateFingerprint(bgAsset.id, fingerprint, {
          ...styleParams,
          step: 'background_with_branding',
        })

        backgroundAssetIdResult = bgAsset.id

        Logger.info('V3 Step 1b: Created Asset for background-with-branding intermediate', {
          assetId: bgAsset.id,
          fingerprint,
          generationId,
        })
      } catch (error) {
        Logger.warn('V3 Step 1b: Failed to create asset for intermediate', {
          error: error instanceof Error ? error.message : String(error),
          generationId,
        })
      }
    }

    const patch: V3WorkflowState = {
      step1b: {
        backgroundImage,
        backgroundAssetId: backgroundAssetIdResult,
        backgroundLogoReference: generatedOutput.backgroundLogoReference,
        evaluatorComments: generatedOutput.evaluatorComments
      }
    }

    if (!state?.composites?.background && generatedOutput.compositeReference) {
      const compositeReference = await intermediateStorage.saveBuffer(
        Buffer.from(generatedOutput.compositeReference.base64, 'base64'),
        {
          fileName: `step1b-composite-${Date.now()}.png`,
          description: generatedOutput.compositeReference.description,
          mimeType: generatedOutput.compositeReference.mimeType ?? 'image/png'
        }
      )

      patch.composites = {
        ...(patch.composites ?? {}),
        background: compositeReference
      }
    }

    return {
      output: generatedOutput,
      statePatch: patch
    }
  })()

  const [step1aResult, step1bResult] = await Promise.allSettled([step1aPromise, step1bPromise])

  // Step 1b is disabled and always returns undefined - kept for backward compatibility
  let step1bOutput: Awaited<ReturnType<typeof generateBackgroundWithRetry>> | undefined
  if (step1bResult.status === 'fulfilled') {
    step1bOutput = step1bResult.value.output
    if (step1bResult.value.statePatch) {
      await persistStatePatch(step1bResult.value.statePatch)
      Logger.info('V3 Step 1b: State persisted for reuse on retry', { generationId })
    }

    if (step1bOutput) {
      Logger.info('V3 Step 1b completed successfully', { generationId })
    } else {
      Logger.info('V3 Step 1b skipped (disabled)', { generationId })
    }
  } else {
    Logger.warn('V3 Step 1b failed, proceeding without it', {
      error: step1bResult.reason,
      generationId
    })
  }

  // Now check Step 1a and throw error if it failed
  if (step1aResult.status === 'rejected') {
    Logger.error('V3 Step 1a failed', {
      error: step1aResult.reason,
      generationId
    })
    throw step1aResult.reason
  }

  const step1aOutput = step1aResult.value.output
  if (!step1aOutput) {
    throw new Error('V3 Step 1a: No output generated')
  }

  if (step1aResult.value.statePatch) {
    await persistStatePatch(step1aResult.value.statePatch)
  }

  Logger.info('V3: Step 1 phases completed', {
    generationId,
    step1aSuccess: true,
    step1bSuccess: step1bOutput !== undefined
  })

  // Collect all evaluator comments
  const allEvaluatorComments: string[] = [
    ...(step1aOutput.evaluatorComments ?? []),
    ...(step1bOutput?.evaluatorComments ?? [])
  ]

  // Use split composites from Step 1a for face/body refinement in Step 2
  // Prefer split composites (face/body) if available, fallback to combined selfieComposite
  const faceCompositeReference = step1aOutput.faceComposite || step1aOutput.selfieComposite
  const bodyCompositeReference = step1aOutput.bodyComposite
  Logger.info('V3: Using composites from Step 1a for refinement', {
    generationId,
    hasFaceComposite: !!step1aOutput.faceComposite,
    hasBodyComposite: !!step1aOutput.bodyComposite,
    usingFallback: !step1aOutput.faceComposite
  })

  // STEP 2: Composition and Refinement
  logStepStart('V3 Step 2: Compositing and refining', generationId)
  await updateJobProgress(job, PROGRESS_STEPS.V3_COMPOSITING, formatProgress(getProgressMessage('v3-compositing'), PROGRESS_STEPS.V3_COMPOSITING))

  Logger.info('V3 Step 2: Compositing')

  // Determine background buffer for step 2
  // For simple backgrounds (gradient, neutral) without step 1b, pass undefined so AI generates from scene specs
  const bgTypeStep2 = styleSettings.background?.value?.type
  const isSimpleBackground = bgTypeStep2 === 'gradient' || bgTypeStep2 === 'neutral'
  const backgroundBufferForStep2 = step1bOutput?.backgroundBuffer
    ? step1bOutput.backgroundBuffer  // Use step 1b output if available
    : isSimpleBackground
      ? undefined  // For simple backgrounds, let AI generate from scene specs (don't use grey background)
      : step1aOutput.backgroundBuffer  // For other cases, use step 1a background

  const step2Output = await executeWithRateLimitRetry(
    () => executeV3Step2(
      {
        personBuffer: step1aOutput.imageBuffer,
        backgroundBuffer: backgroundBufferForStep2,
        styleSettings: styleSettings as unknown as Record<string, unknown>,
        faceCompositeReference,
        bodyCompositeReference,
        evaluatorComments: allEvaluatorComments.length > 0 ? allEvaluatorComments : undefined,
        aspectRatio,
        resolution: STAGE_RESOLUTION.STEP_2_COMPOSITION || resolution,
        originalPrompt: prompt,
        generationId,
        personId,
        teamId,
        onCostTracking,
        preparedAssets, // Pass prepared assets for element composition (logo, etc.)
      },
      debugMode
    ),
    {
      maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
      sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
      operationName: 'V3 Step 2 composition'
    },
    createProgressRetryCallback(job, PROGRESS_STEPS.V3_COMPOSITING)
  )

  // Save all images returned by the model (for debugging multiple candidates)
  await saveAllIntermediateImages(step2Output.allImageBuffers || [step2Output.refinedBuffer], 'v3-step2-final-composition', generationId, debugMode)

  if (stopAfterStep === 2) {
    Logger.info('V3: Stopping after Step 2 (composition complete)', { generationId, imageSize: step2Output.refinedBuffer.length })
    throw new Error('Stopped after Step 2 (debug mode)')
  }

  // STEP 3: Final evaluation
  logStepStart('V3 Step 3: Final evaluation', generationId)
  await updateJobProgress(job, PROGRESS_STEPS.V3_FINAL_EVAL, formatProgress({ message: 'Final quality check...', emoji: '🎯' }, PROGRESS_STEPS.V3_FINAL_EVAL))

  Logger.info('V3 Step 3: Final evaluation')

  // Upload to S3 for evaluation tracking (gets S3 key for cost tracking)
  const step3IntermediateS3Upload = await intermediateStorage.saveBuffer(step2Output.refinedBuffer, {
    fileName: `step3-final-eval-${Date.now()}.png`,
    description: 'V3 Step 3 final composition for evaluation',
    mimeType: 'image/png'
  })

  // Scale expected dimensions based on Step 2 resolution
  const step2Resolution = STAGE_RESOLUTION.STEP_2_COMPOSITION || resolution
  const resolutionMultiplier = getResolutionMultiplier(step2Resolution)
  const scaledExpectedWidth = expectedWidth * resolutionMultiplier
  const scaledExpectedHeight = expectedHeight * resolutionMultiplier

  const step3Output = await executeWithRateLimitRetry(
    async () => {
      return await executeV3Step3({
        refinedBuffer: step2Output.refinedBuffer,
        refinedBase64: step2Output.refinedBase64,
        selfieComposite: step1aOutput.selfieComposite,
        faceComposite: step1aOutput.faceComposite,
        bodyComposite: step1aOutput.bodyComposite,
        expectedWidth: scaledExpectedWidth,
        expectedHeight: scaledExpectedHeight,
        aspectRatio,
        logoReference: step1bOutput?.backgroundLogoReference || step1aOutput.backgroundLogoReference,
        generationPrompt: prompt,
        generationId,
        personId,
        teamId,
        intermediateS3Key: step3IntermediateS3Upload.key,
        onCostTracking,
      }, debugMode)
    },
    {
      maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
      sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
      operationName: 'V3 Step 3 Final Eval'
    },
    createProgressRetryCallback(job, PROGRESS_STEPS.V3_FINAL_EVAL)
  )

  if (stopAfterStep === 3) {
    Logger.info('V3: Stopping after Step 3 (final evaluation complete)', {
      generationId,
      evaluationStatus: step3Output.evaluation.status,
      evaluationReason: step3Output.evaluation.reason
    })
    throw new Error('Stopped after Step 3 (debug mode)')
  }

  if (step3Output.evaluation.status !== 'Approved') {
    Logger.warn('V3 Step 3: Final evaluation not approved', { reason: step3Output.evaluation.reason })

    // Get actual image dimensions for evaluation details
    const sharp = (await import('sharp')).default
    const metadata = await sharp(step2Output.refinedBuffer).metadata()
    const actualWidth = metadata.width ?? null
    const actualHeight = metadata.height ?? null

    // Calculate dimension and aspect ratio mismatches
    const DIMENSION_TOLERANCE_PX = 50 // Generous tolerance for model variations
    const ASPECT_RATIO_TOLERANCE = 0.05 // 5% tolerance
    const expectedRatio = expectedWidth / expectedHeight
    const actualRatio = actualWidth && actualHeight && actualHeight !== 0 ? actualWidth / actualHeight : null

    const dimensionMismatch =
      actualWidth === null ||
      actualHeight === null ||
      Math.abs(actualWidth - expectedWidth) > DIMENSION_TOLERANCE_PX ||
      Math.abs(actualHeight - expectedHeight) > DIMENSION_TOLERANCE_PX

    const aspectMismatch =
      actualRatio === null ? true : Math.abs(actualRatio - expectedRatio) > ASPECT_RATIO_TOLERANCE

    // Construct ImageEvaluationResult from EvaluationFeedback
    const evaluationResult: ImageEvaluationResult = {
      status: step3Output.evaluation.status,
      reason: step3Output.evaluation.reason,
      details: {
        actualWidth,
        actualHeight,
        dimensionMismatch,
        aspectMismatch,
        selfieDuplicate: false, // V3 Step 3 doesn't check for selfie duplicates
        matchingReferenceLabel: null,
        uncertainCount: undefined,
        autoReject: step3Output.evaluation.failedCriteria?.some(c => c.includes('face_similarity') || c.includes('characteristic_preservation')) || false
      }
    }

    // Throw specific error that carries the image data for support notification
    throw new EvaluationFailedError(
      `V3 Step 3 final evaluation failed: ${step3Output.evaluation.reason}`,
      {
        evaluation: evaluationResult,
        imageBase64: step2Output.refinedBase64,
        generationId,
        prompt,
        attempt: currentAttempt,
        aspectRatio
      }
    )
  }

  Logger.info('V3 Step 3: Final image approved')

  // Complete
  await updateJobProgress(job, PROGRESS_STEPS.V3_COMPLETE, formatProgress({ message: 'Generation complete', emoji: '✅' }, PROGRESS_STEPS.V3_COMPLETE))

  Logger.info('V3 workflow completed successfully', { generationId })

  return {
    approvedImageBuffers: [step2Output.refinedBuffer]
  }
}
