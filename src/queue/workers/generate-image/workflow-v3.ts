import { Logger } from '@/lib/logger'
import type { Job } from 'bullmq'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { DownloadAssetFn, EvaluationFeedback } from '@/types/generation'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import { resolveAspectRatioConfig } from '@/domain/style/elements/aspect-ratio/config'
import type { PersistedImageReference, V3WorkflowState } from '@/types/workflow'
import { executeV3Step1a } from './steps/v3-step1a-person-generation'
import { executeV3Step1aEval } from './steps/v3-step1a-person-eval'
import { executeV3Step1b } from './steps/v3-step1b-background-generation'
import { executeV3Step1bEval } from './steps/v3-step1b-background-eval'
import { executeV3Step2 } from './steps/v3-step2-final-composition'
import { executeV3Step3 } from './steps/v3-step3-final-eval'

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
import { saveIntermediateFile } from './utils/debug-helpers'
import {
  buildEvaluationFeedback,
  isApproved,
  logEvaluationResult,
  checkMaxAttemptsAndThrow
} from './utils/evaluation-orchestrator'
import { EvaluationFailedError } from './errors'
import type { ImageEvaluationResult } from './evaluator'
import { getProgressMessage } from '@/lib/generation-progress-messages'
import { buildBackgroundComposite } from '@/lib/generation/reference-utils'

// Import configuration
import { RETRY_CONFIG, PROGRESS_STEPS } from './config'

export interface V3WorkflowInput {
  job: Job
  generationId: string
  personId: string
  userId?: string
  selfieReferences: { label: string; base64: string; mimeType: string }[]
  selfieComposite: ReferenceImage
  styleSettings: PhotoStyleSettings
  prompt: string // JSON only (no rules)
  mustFollowRules: string[] // Rules from elements
  freedomRules: string[] // Freedom rules from elements
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
 * Step 1a: Generate person with retry on evaluation rejection
 */
async function generatePersonWithRetry({
  job,
  processedSelfieReferences,
  selfieComposite,
  styleSettings,
  downloadAsset,
  aspectRatio,
  aspectRatioConfig,
  expectedWidth,
  expectedHeight,
  prompt,
  mustFollowRules,
  freedomRules,
  generationId,
  debugMode,
  stopAfterStep,
  formatProgress
}: {
  job: Job
  processedSelfieReferences: ReferenceImage[]
  selfieComposite: ReferenceImage
  styleSettings: PhotoStyleSettings
  downloadAsset: DownloadAssetFn
  aspectRatio: string
  aspectRatioConfig: { id: string; width: number; height: number }
  expectedWidth: number
  expectedHeight: number
  prompt: string
  mustFollowRules: string[]
  freedomRules: string[]
  generationId: string
  debugMode: boolean
  stopAfterStep?: number
  formatProgress: (message: { message: string; emoji?: string }, progress: number) => string
}): Promise<{ imageBuffer: Buffer; imageBase64: string; clothingLogoReference?: BaseReferenceImage; backgroundLogoReference?: BaseReferenceImage; backgroundBuffer?: Buffer; selfieComposite: BaseReferenceImage; evaluatorComments: string[] } | undefined> {
  let step1Output: { imageBuffer: Buffer; imageBase64: string; clothingLogoReference?: BaseReferenceImage; backgroundLogoReference?: BaseReferenceImage; backgroundBuffer?: Buffer; selfieComposite: BaseReferenceImage } | undefined
  let evaluationFeedback: EvaluationFeedback | undefined
  const evaluatorComments: string[] = []

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt === 1) {
      Logger.info('>>> STARTING V3 STEP 1a: Generating person on white background <<<')
    }
    Logger.info('V3 Step 1a: Generating person on white background', { attempt, max: 3 })

    await updateJobProgress(job, PROGRESS_STEPS.V3_GENERATING_PERSON, formatProgress(getProgressMessage('v3-generating-person'), PROGRESS_STEPS.V3_GENERATING_PERSON))

    // Generate with rate limit retry
    const currentStep1Output = await executeWithRateLimitRetry(
      async () => {
        return await executeV3Step1a({
          selfieReferences: processedSelfieReferences,
          selfieComposite,
          styleSettings,
          downloadAsset,
          aspectRatio,
          aspectRatioConfig,
          expectedWidth,
          expectedHeight,
          prompt,
          mustFollowRules,
          freedomRules,
          generationId: `v3-step1a-${Date.now()}`,
          debugMode,
          evaluationFeedback
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
    await saveIntermediateFile(step1Output.imageBuffer, 'v3-step1a-person-white-bg', generationId, debugMode)

    if (stopAfterStep === 1) {
      Logger.info('V3: Stopping after Step 1a (person generation complete)', {
        generationId,
        imageSize: step1Output.imageBuffer.length
      })
      throw new Error('Stopped after Step 1a (debug mode)')
    }

    // Evaluate
    if (attempt === 1) {
      Logger.info('>>> STARTING V3 STEP 1a EVAL: Evaluating person <<<')
    }
    await updateJobProgress(job, PROGRESS_STEPS.V3_EVALUATING_PERSON, formatProgress({ message: 'Evaluating quality...', emoji: '🔍' }, PROGRESS_STEPS.V3_EVALUATING_PERSON))

    Logger.info('V3 Step 1a Eval: Evaluating person', { attempt })

    const step2Output = await executeWithRateLimitRetry(
      async () => {
        return await executeV3Step1aEval({
          imageBuffer: step1Output!.imageBuffer,
          imageBase64: step1Output!.imageBase64,
          selfieReferences: processedSelfieReferences,
          selfieComposite,
          expectedWidth,
          expectedHeight,
          aspectRatioConfig,
          generationPrompt: prompt,
          clothingLogoReference: step1Output!.clothingLogoReference
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
 * Step 1b: Generate background with branding (if applicable) with retry
 */
async function generateBackgroundWithRetry({
  job,
  styleSettings,
  downloadAsset,
  aspectRatio,
  prompt,
  generationId,
  debugMode,
  formatProgress,
  backgroundComposite
}: {
  job: Job
  styleSettings: PhotoStyleSettings
  downloadAsset: DownloadAssetFn
  aspectRatio: string
  prompt: string
  generationId: string
  debugMode: boolean
  formatProgress: (message: { message: string; emoji?: string }, progress: number) => string
  backgroundComposite?: BaseReferenceImage
}): Promise<{ backgroundBuffer: Buffer; backgroundBase64: string; backgroundLogoReference: BaseReferenceImage; evaluatorComments: string[]; compositeReference?: BaseReferenceImage } | undefined> {
  // Check if Step 1b should run
  const shouldRunStep1b = styleSettings.branding?.type === 'include' && 
                          styleSettings.branding?.position &&
                          ['background', 'elements'].includes(styleSettings.branding.position)

  if (!shouldRunStep1b) {
    Logger.info('V3 Step 1b: Skipping background generation (no branding in background/elements)')
    return undefined
  }

  // Load logo for branding
  let brandingLogoReference: BaseReferenceImage | undefined
  if (styleSettings.branding?.logoKey) {
    try {
      const logoAsset = await downloadAsset(styleSettings.branding.logoKey)
      if (logoAsset) {
        brandingLogoReference = {
          description: `Company logo for ${styleSettings.branding.position} placement`,
          base64: logoAsset.base64,
          mimeType: logoAsset.mimeType
        }
      }
    } catch (error) {
      Logger.warn('Failed to load logo for Step 1b', { error })
      return undefined
    }
  }

  // Load custom background if specified
  let customBackgroundReference: BaseReferenceImage | undefined
  if (styleSettings.background?.type === 'custom' && styleSettings.background.key) {
    try {
      const bgAsset = await downloadAsset(styleSettings.background.key)
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

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt === 1) {
      Logger.info('>>> STARTING V3 STEP 1b: Generating background with branding <<<')
    }
    Logger.info('V3 Step 1b: Generating background with branding', { attempt, max: 3 })

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
          debugMode,
          backgroundComposite: cachedComposite
        })
      },
      {
        maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
        sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
        operationName: 'V3 Step 1b background generation'
      },
      createProgressRetryCallback(job, PROGRESS_STEPS.V3_GENERATING_BACKGROUND)
    )

    await saveIntermediateFile(step1bOutput.backgroundBuffer, 'v3-step1b-background-with-branding', generationId, debugMode)

    // Evaluate
    if (attempt === 1) {
      Logger.info('>>> STARTING V3 STEP 1b EVAL: Evaluating background <<<')
    }
    await updateJobProgress(job, PROGRESS_STEPS.V3_EVALUATING_BACKGROUND, formatProgress({ message: 'Checking background quality...', emoji: '🔍' }, PROGRESS_STEPS.V3_EVALUATING_BACKGROUND))

    Logger.info('V3 Step 1b Eval: Evaluating background', { attempt })

    const evalOutput = await executeWithRateLimitRetry(
      async () => {
        return await executeV3Step1bEval({
          backgroundBuffer: step1bOutput.backgroundBuffer,
          backgroundBase64: step1bOutput.backgroundBase64,
          logoReference: brandingLogoReference,
          generationId: `v3-step1b-eval-${Date.now()}`
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
      return { ...step1bOutput, evaluatorComments, compositeReference: cachedComposite ?? step1bOutput.compositeReference }
    }

    checkMaxAttemptsAndThrow('V3 Step 1b', attempt, 3, evaluation)
  }

  throw new Error('V3 Step 1b: Failed to generate background after retries')
}

/**
 * Execute the V3 parallel workflow
 * Step 1a (Person) and Step 1b (Background) run in parallel
 * Then Step 2 (Composition/Refinement) combines them
 * Finally Step 3 (Final Eval) validates the result
 */
export async function executeV3Workflow({
  job,
  generationId,
  selfieReferences,
  selfieComposite,
  styleSettings,
  prompt,
  mustFollowRules,
  freedomRules,
  aspectRatio,
  resolution,
  downloadAsset,
  currentAttempt,
  debugMode = false,
  stopAfterStep,
  workflowState,
  persistWorkflowState,
  intermediateStorage
}: V3WorkflowInput): Promise<V3WorkflowResult> {
  // Get expected dimensions from aspect ratio
  const aspectRatioConfig = resolveAspectRatioConfig(aspectRatio)
  const expectedWidth = aspectRatioConfig.width
  const expectedHeight = aspectRatioConfig.height

  // Selfie rotation is already normalized in generateImage.ts before PNG conversion
  // No need to normalize again here
  const processedSelfieReferences = selfieReferences

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

  Logger.info('V3: Preparing Step 1a and Step 1b execution', { generationId })

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
      styleSettings,
      downloadAsset,
      aspectRatio,
      aspectRatioConfig,
      expectedWidth,
      expectedHeight,
      prompt,
      mustFollowRules,
      freedomRules,
      generationId,
      debugMode,
      stopAfterStep,
      formatProgress
    })

    if (!generatedOutput) {
      throw new Error('V3 Step 1a: Generation did not return an output')
    }

    const personImage = await intermediateStorage.saveBuffer(generatedOutput.imageBuffer, {
      fileName: `step1a-person-${Date.now()}.png`,
      description: 'V3 Step 1a person output',
      mimeType: 'image/png'
    })

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
      debugMode,
      formatProgress
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

      const patch: V3WorkflowState = {
        step1b: {
          backgroundImage,
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

  if (step1aResult.status === 'rejected') {
    Logger.error('V3 Step 1a failed', { error: step1aResult.reason })
    throw step1aResult.reason
  }

  const step1aOutput = step1aResult.value.output
  if (!step1aOutput) {
    throw new Error('V3 Step 1a: No output generated')
  }

  if (step1aResult.value.statePatch) {
    await persistStatePatch(step1aResult.value.statePatch)
  }

  let step1bOutput: Awaited<ReturnType<typeof generateBackgroundWithRetry>> | undefined
  if (step1bResult.status === 'fulfilled') {
    step1bOutput = step1bResult.value.output
    if (step1bResult.value.statePatch) {
      await persistStatePatch(step1bResult.value.statePatch)
    }

    if (step1bOutput) {
      Logger.info('V3 Step 1b completed successfully', { generationId })
    } else {
      Logger.info('V3 Step 1b was skipped (no branding in background)', { generationId })
    }
  } else {
    Logger.warn('V3 Step 1b failed, proceeding without it', {
      error: step1bResult.reason,
      generationId
    })
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

  // Use the selfie composite from Step 1a for face refinement in Step 2
  // This avoids rebuilding the composite and ensures consistency
  Logger.info('V3: Using selfie composite from Step 1a for refinement', { generationId })
  const faceCompositeReference = step1aOutput.selfieComposite

  // STEP 2: Composition and Refinement
  Logger.info('>>> STARTING V3 STEP 2: Compositing and refining <<<')
  await updateJobProgress(job, PROGRESS_STEPS.V3_COMPOSITING, formatProgress(getProgressMessage('v3-compositing'), PROGRESS_STEPS.V3_COMPOSITING))

  Logger.info('V3 Step 2: Compositing and refining')

  const step2Output = await executeWithRateLimitRetry(
    () => executeV3Step2(
      {
        personBuffer: step1aOutput.imageBuffer,
        backgroundBuffer: step1bOutput?.backgroundBuffer || step1aOutput.backgroundBuffer, // Use Step 1b output or user's custom background
        styleSettings: styleSettings as unknown as Record<string, unknown>,
        faceCompositeReference,
        evaluatorComments: allEvaluatorComments.length > 0 ? allEvaluatorComments : undefined,
        aspectRatio,
        resolution,
        originalPrompt: prompt
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

  await saveIntermediateFile(step2Output.refinedBuffer, 'v3-step2-final-composition', generationId, debugMode)

  if (stopAfterStep === 2) {
    Logger.info('V3: Stopping after Step 2 (composition complete)', { generationId, imageSize: step2Output.refinedBuffer.length })
    throw new Error('Stopped after Step 2 (debug mode)')
  }

  // STEP 3: Final evaluation
  Logger.info('>>> STARTING V3 STEP 3: Final evaluation <<<')
  await updateJobProgress(job, PROGRESS_STEPS.V3_FINAL_EVAL, formatProgress({ message: 'Final quality check...', emoji: '🎯' }, PROGRESS_STEPS.V3_FINAL_EVAL))

  Logger.info('V3 Step 3: Final evaluation')

  const step3Output = await executeWithRateLimitRetry(
    async () => {
      return await executeV3Step3({
        refinedBuffer: step2Output.refinedBuffer,
        refinedBase64: step2Output.refinedBase64,
        selfieComposite: step1aOutput.selfieComposite,
        expectedWidth,
        expectedHeight,
        aspectRatio,
        logoReference: step1bOutput?.backgroundLogoReference || step1aOutput.backgroundLogoReference,
        generationPrompt: prompt
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
    const DIMENSION_TOLERANCE_PX = 2
    const ASPECT_RATIO_TOLERANCE = 0.02
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
