import sharp from 'sharp'

import { Logger } from '@/lib/logger'
import { detectImageFormat, extensionFromMimeType } from '@/lib/image-format'
import { createS3Client } from '@/lib/s3-client'
import { type Job, UnrecoverableError } from 'bullmq'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { DownloadAssetFn } from '@/types/generation'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import type { PersistedImageReference, V3WorkflowState } from '@/types/workflow'
import { resolveAspectRatioConfig } from '@/domain/style/elements/aspect-ratio/config'
import { hasValue } from '@/domain/style/elements/base/element-types'
import type { PreparedAsset } from '@/domain/style/elements/composition'
import { AssetService } from '@/domain/services/AssetService'
import { StyleFingerprintService } from '@/domain/services/StyleFingerprintService'

import { executeStep0Preparation } from './steps/v3-step0-preparation'
import { executeV3Step0Eval } from './steps/v3-step0-eval'
import {
  executeV3Step1a,
  projectForStep1a,
  type V3Step1aArtifacts,
} from './steps/v3-step1a-person-generation'
import { executeV3Step1aEval } from './steps/v3-step1a-person-eval'
import { executeV3Step2, type V3Step2Artifacts } from './steps/v3-step2-final-composition'
import { executeV3Step3, type V3Step3EvalArtifacts } from './steps/v3-step3-final-eval'
import {
  buildCanonicalPromptV3,
  computePromptHash,
  restoreCanonicalPromptState,
  serializeCanonicalPromptState,
} from './canonical-prompt-v3'

import type { CostReason, CostResult } from '@/domain/services/CostTrackingService'
import type { AIModelId, AIProvider } from '@/config/ai-costs'

import { type ReferenceImage } from './utils/reference-builder'
import {
  executeWithRateLimitRetry,
  formatProgressWithAttempt,
  updateJobProgress,
  createProgressRetryCallback,
} from './utils/retry-handler'
import { getRequiredStep0AssetErrors } from './utils/step0-required-assets'
import { saveAllIntermediateImages, saveDebugJson } from './utils/debug-helpers'
import {
  buildEvaluationFeedback,
  isApproved,
  logEvaluationResult,
} from './utils/evaluation-orchestrator'
import { logStepStart } from './utils/logging'
import { EvaluationFailedError } from './errors'
import type { ImageEvaluationResult } from './evaluator'
import { getProgressMessage } from '@/lib/generation-progress-messages'

import { RETRY_CONFIG, PROGRESS_STEPS, STAGE_MODEL, STAGE_RESOLUTION } from './config'

const step0S3Client = createS3Client({ forcePathStyle: false })
const MAX_API_CALLS_PER_GENERATION = 30

function getResolutionMultiplier(resolution?: '1K' | '2K' | '4K'): number {
  switch (resolution) {
    case '4K':
      return 4
    case '2K':
      return 2
    case '1K':
    default:
      return 1
  }
}

export type CostTrackingHandler = (params: {
  stepName: string
  reason: CostReason
  result: CostResult
  model: AIModelId
  provider?: AIProvider
  inputTokens?: number
  outputTokens?: number
  imagesGenerated?: number
  durationMs?: number
  errorMessage?: string
  outputAssetId?: string
  reusedAssetId?: string
  evaluationStatus?: 'approved' | 'rejected'
  rejectionReason?: string
  intermediateS3Key?: string
}) => Promise<void>

export interface V3WorkflowInput {
  job: Job
  generationId: string
  personId: string
  teamId?: string
  selfieReferences: { label?: string; base64: string; mimeType: string }[]
  selfieAssetIds?: string[]
  demographics?: import('@/domain/selfie/selfieDemographics').DemographicProfile
  selfieComposite?: ReferenceImage
  faceComposite?: ReferenceImage
  bodyComposite?: ReferenceImage
  styleSettings: PhotoStyleSettings
  prompt: string
  referenceImages?: BaseReferenceImage[]
  aspectRatio: string
  resolution?: '1K' | '2K' | '4K'
  downloadAsset: DownloadAssetFn
  currentAttempt: number
  maxAttempts: number
  debugMode?: boolean
  stopAfterStep?: number
  workflowState?: V3WorkflowState
  persistWorkflowState: (state: V3WorkflowState | undefined) => Promise<void>
  intermediateStorage: IntermediateStorageHandlers
  onCostTracking?: CostTrackingHandler
}

interface IntermediateStorageHandlers {
  saveBuffer: (
    buffer: Buffer,
    meta: { fileName: string; description?: string; label?: string; mimeType?: string }
  ) => Promise<PersistedImageReference>
  loadBuffer: (reference: PersistedImageReference) => Promise<Buffer>
}

export async function executeV3Workflow({
  job,
  generationId,
  personId,
  teamId,
  selfieReferences,
  selfieAssetIds,
  demographics,
  selfieComposite,
  faceComposite,
  bodyComposite,
  styleSettings,
  prompt,
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
  onCostTracking,
}: V3WorkflowInput): Promise<{ approvedImageBuffers: Buffer[] }> {
  Logger.debug('V3 workflow start', { generationId, personId, teamId })

  const aspectRatioConfig = resolveAspectRatioConfig(aspectRatio)
  const expectedWidth = aspectRatioConfig.width
  const expectedHeight = aspectRatioConfig.height

  const basePrompt = prompt

  let state = workflowState

  // NOTE: This mutates shared local `state`; writes are serialized via `persistStatePatch`.
  const mergeStatePatch = (patch?: V3WorkflowState): V3WorkflowState | undefined => {
    if (!patch) return state

    const next: V3WorkflowState = { ...(state ?? {}) }

    if (patch.cachedPayload) next.cachedPayload = patch.cachedPayload
    if (patch.canonicalPromptState) next.canonicalPromptState = patch.canonicalPromptState
    if (patch.apiCallBudget) next.apiCallBudget = patch.apiCallBudget

    if (patch.step1a) next.step1a = patch.step1a
    state = next
    return state
  }

  let persistStateMutex: Promise<void> = Promise.resolve()
  const persistStatePatch = async (patch?: V3WorkflowState): Promise<void> => {
    if (!patch) return

    const run = async () => {
      await persistWorkflowState(mergeStatePatch(patch))
    }

    persistStateMutex = persistStateMutex.then(run, run)
    await persistStateMutex
  }

  let apiCallBudget = state?.apiCallBudget ?? {
    used: 0,
    max: MAX_API_CALLS_PER_GENERATION,
  }

  const consumeApiCallBudget = async (operationName: string): Promise<void> => {
    if (apiCallBudget.used >= apiCallBudget.max) {
      throw new Error(
        `V3 API call budget exceeded (${apiCallBudget.used}/${apiCallBudget.max}) before ${operationName}`
      )
    }

    apiCallBudget = {
      ...apiCallBudget,
      used: apiCallBudget.used + 1,
    }

    await persistStatePatch({ apiCallBudget })
  }

  const bufferFromPersisted = async (ref?: PersistedImageReference): Promise<Buffer | undefined> => {
    if (!ref) return undefined
    return intermediateStorage.loadBuffer(ref)
  }

  const formatProgress = (message: { message: string; emoji?: string }, progress: number): string => {
    return formatProgressWithAttempt(message, progress, currentAttempt)
  }

  const selfieS3Keys = selfieReferences
    .map((reference) => reference.label)
    .filter((label): label is string => typeof label === 'string' && label.length > 0)

  let canonicalPrompt: Record<string, unknown>
  let step1aArtifacts: V3Step1aArtifacts
  let step2Artifacts: V3Step2Artifacts
  let step3EvalArtifacts: V3Step3EvalArtifacts
  let canonicalPromptHash = ''

  const canonicalState = state?.canonicalPromptState
  if (canonicalState) {
    try {
      const restored = restoreCanonicalPromptState(canonicalState)
      const recomputedHash = computePromptHash(restored.canonicalPrompt)
      const matchesRecomputed = recomputedHash === restored.promptHash

      Logger.info('canonicalPromptRestoredFromState', {
        generationId,
        promptHash: restored.promptHash,
        matchesRecomputed,
      })

      if (!matchesRecomputed) {
        Logger.warn('canonicalPromptRestoredFromState hash mismatch - rebuilding canonical prompt', {
          generationId,
          storedHash: restored.promptHash,
          recomputedHash,
        })
        throw new Error('Canonical prompt hash mismatch')
      }

      canonicalPrompt = restored.canonicalPrompt
      step1aArtifacts = restored.step1aArtifacts
      step2Artifacts = restored.step2Artifacts
      step3EvalArtifacts = restored.step3EvalArtifacts
      canonicalPromptHash = restored.promptHash
    } catch (error) {
      Logger.warn('Failed to restore canonical prompt state - rebuilding', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
      })

      const built = await buildCanonicalPromptV3({
        basePrompt,
        styleSettings,
        demographics,
        hasFaceComposite: Boolean(faceComposite),
        hasBodyComposite: Boolean(bodyComposite),
        generationId,
        personId,
        teamId,
        selfieS3Keys,
        debugMode,
      })
      canonicalPrompt = built.canonicalPrompt
      step1aArtifacts = built.step1aArtifacts
      step2Artifacts = built.step2Artifacts
      step3EvalArtifacts = built.step3EvalArtifacts
      canonicalPromptHash = built.debugMetadata.promptHash
      await persistStatePatch({ canonicalPromptState: serializeCanonicalPromptState(built) })
    }
  } else {
    try {
      const built = await buildCanonicalPromptV3({
        basePrompt,
        styleSettings,
        demographics,
        hasFaceComposite: Boolean(faceComposite),
        hasBodyComposite: Boolean(bodyComposite),
        generationId,
        personId,
        teamId,
        selfieS3Keys,
        debugMode,
      })

      canonicalPrompt = built.canonicalPrompt
      step1aArtifacts = built.step1aArtifacts
      step2Artifacts = built.step2Artifacts
      step3EvalArtifacts = built.step3EvalArtifacts
      canonicalPromptHash = built.debugMetadata.promptHash

      await persistStatePatch({ canonicalPromptState: serializeCanonicalPromptState(built) })
      Logger.info('canonicalPromptVersion', {
        generationId,
        version: 1,
      })
    } catch (error) {
      Logger.error('canonicalPromptBuildFailed', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }

  let preparedAssets: Map<string, PreparedAsset> | undefined

  const runStep0Preparation = async (attempt: number): Promise<Map<string, PreparedAsset>> => {
    await updateJobProgress(
      job,
      PROGRESS_STEPS.V3_PREPARING,
      formatProgress(getProgressMessage('v3-preparing-assets'), PROGRESS_STEPS.V3_PREPARING),
    )

    const step0Result = await executeStep0Preparation({
      styleSettings,
      canonicalPrompt,
      downloadAsset,
      s3Client: step0S3Client,
      generationId,
      personId,
      teamId,
      selfieS3Keys,
      debugMode,
    })

    if (step0Result.preparationErrors.length > 0) {
      Logger.warn('V3 Step 0 preparation had errors', {
        generationId,
        errors: step0Result.preparationErrors,
      })
    }

    return step0Result.preparedAssets
  }

  const clearStep1aState = async (): Promise<void> => {
    const run = async () => {
      const next: V3WorkflowState = { ...(state ?? {}) }
      delete next.step1a
      state = next
      await persistWorkflowState(state)
    }

    persistStateMutex = persistStateMutex.then(run, run)
    await persistStateMutex
  }

  const invalidateClothingOverlayCache = async (assets?: Map<string, PreparedAsset>): Promise<void> => {
    const overlayAsset = assets?.get('clothing-overlay-overlay')
    const overlayMetadata = overlayAsset?.data.metadata as Record<string, unknown> | undefined
    const reusedAssetId =
      typeof overlayMetadata?.reusedAssetId === 'string' ? overlayMetadata.reusedAssetId : undefined
    const fingerprint =
      typeof overlayMetadata?.fingerprint === 'string' ? overlayMetadata.fingerprint : undefined

    if (reusedAssetId) {
      try {
        await AssetService.deleteAsset(reusedAssetId)
      } catch (error) {
        Logger.warn('V3 Step 0: Failed to delete reused clothing overlay asset', {
          generationId,
          assetId: reusedAssetId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (!fingerprint) {
      return
    }

    const ownerContext = { teamId, personId }
    const MAX_DELETE_ITERATIONS = 20
    for (let i = 0; i < MAX_DELETE_ITERATIONS; i += 1) {
      const reusable = await AssetService.findReusableAsset(fingerprint, ownerContext)
      if (!reusable) {
        break
      }
      try {
        await AssetService.deleteAsset(reusable.id)
      } catch (error) {
        Logger.warn('V3 Step 0: Failed to delete fingerprint-matched clothing overlay asset', {
          generationId,
          assetId: reusable.id,
          fingerprint,
          error: error instanceof Error ? error.message : String(error),
        })
        break
      }
    }
  }

  let lastStep0FailureReason = 'Unknown Step 0 failure'
  for (let step0Attempt = 1; step0Attempt <= 3; step0Attempt += 1) {
    let currentPreparedAssets: Map<string, PreparedAsset> | undefined
    let currentFailedAssetKeys: string[] = []
    let step0Approved = false

    try {
      currentPreparedAssets = await runStep0Preparation(step0Attempt)

      const step0AssetErrors = getRequiredStep0AssetErrors(styleSettings, currentPreparedAssets)
      if (step0AssetErrors.length > 0) {
        lastStep0FailureReason = `V3 Step 0 required assets missing: ${step0AssetErrors.join(' | ')}`
        if (
          step0AssetErrors.some((error) => error.includes('Clothing branding requires prepared clothing overlay'))
        ) {
          currentFailedAssetKeys.push('clothing-overlay-overlay')
        }
        if (
          step0AssetErrors.some(
            (error) =>
              error.includes('pre-branded background asset') || error.includes('Custom background requested')
          )
        ) {
          currentFailedAssetKeys.push('background-custom-background')
        }
      } else {
        await updateJobProgress(
          job,
          PROGRESS_STEPS.V3_EVALUATING_BRANDING,
          formatProgress(getProgressMessage('v3-evaluating-branding'), PROGRESS_STEPS.V3_EVALUATING_BRANDING),
        )

        const step0EvalOutput = await executeWithRateLimitRetry(
          async () => {
            await consumeApiCallBudget('V3 Step 0 evaluation')
            return executeV3Step0Eval({
              styleSettings,
              preparedAssets: currentPreparedAssets,
              downloadAsset,
              generationId,
              onCostTracking,
            })
          },
          {
            maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
            sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
            operationName: 'V3 Step 0 Eval',
          },
          createProgressRetryCallback(job, PROGRESS_STEPS.V3_EVALUATING_BRANDING)
        )

        if (step0EvalOutput.evaluation.status === 'Approved') {
          step0Approved = true
        } else {
          lastStep0FailureReason = step0EvalOutput.evaluation.reason
          currentFailedAssetKeys = [...step0EvalOutput.evaluation.failedAssetKeys]
        }
      }
    } catch (error) {
      lastStep0FailureReason = error instanceof Error ? error.message : String(error)
      Logger.warn('V3 Step 0 attempt failed', {
        generationId,
        step0Attempt,
        error: lastStep0FailureReason,
      })
    }

    if (step0Approved && currentPreparedAssets) {
      preparedAssets = currentPreparedAssets
      break
    }

    Logger.warn('V3 Step 0 attempt did not pass', {
      generationId,
      step0Attempt,
      reason: lastStep0FailureReason,
      failedAssetKeys: currentFailedAssetKeys,
    })

    if (step0Attempt >= 3) {
      throw new UnrecoverableError(`V3 Step 0 failed after 3 attempts: ${lastStep0FailureReason}`)
    }

    if (currentFailedAssetKeys.includes('clothing-overlay-overlay')) {
      await invalidateClothingOverlayCache(currentPreparedAssets)
    }

    await clearStep1aState()
    preparedAssets = undefined
  }

  if (!preparedAssets) {
    throw new UnrecoverableError(`V3 Step 0 failed after 3 attempts: ${lastStep0FailureReason}`)
  }

  let step1aOutput:
    | {
        imageBuffer: Buffer
        allImageBuffers: Buffer[]
        assetId?: string
        clothingLogoReference?: BaseReferenceImage
        backgroundLogoReference?: BaseReferenceImage
        selfieComposite?: BaseReferenceImage
        faceComposite?: BaseReferenceImage
        bodyComposite?: BaseReferenceImage
        evaluatorComments: string[]
        reused?: boolean
      }
    | undefined
  let step1aPersonFormat: { mimeType: string; extension: string } | undefined

  if (state?.step1a?.personImage) {
      const cachedPersonBuffer = await bufferFromPersisted(state.step1a.personImage)
      if (!cachedPersonBuffer) {
        throw new Error('Cached Step 1a person image missing from storage')
      }

      step1aOutput = {
        imageBuffer: cachedPersonBuffer,
        allImageBuffers: [cachedPersonBuffer],
        clothingLogoReference: state.step1a.clothingLogoReference,
        backgroundLogoReference: state.step1a.backgroundLogoReference,
        selfieComposite,
        faceComposite,
        bodyComposite,
        evaluatorComments: state.step1a.evaluatorComments ?? [],
        reused: true,
      }
      step1aPersonFormat = {
        mimeType: state.step1a.personImage.mimeType,
        extension: extensionFromMimeType(state.step1a.personImage.mimeType),
      }
    } else {
      const evaluatorComments: string[] = []
      let evaluationFeedback: { suggestedAdjustments?: string } | undefined

      const step1aResolution = STAGE_RESOLUTION.STEP_1A_PERSON || '1K'
      const step1aMultiplier = getResolutionMultiplier(step1aResolution)
      const step1aExpectedWidth = expectedWidth * step1aMultiplier
      const step1aExpectedHeight = expectedHeight * step1aMultiplier

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (attempt === 1) {
          logStepStart('V3 Step 1a: Generating person on grey background', generationId)
        }

        await updateJobProgress(
          job,
          PROGRESS_STEPS.V3_GENERATING_PERSON,
          formatProgress(getProgressMessage('v3-generating-person'), PROGRESS_STEPS.V3_GENERATING_PERSON)
        )

        const currentStep1Output = await executeWithRateLimitRetry(
          async () => {
            await consumeApiCallBudget('V3 Step 1a generation')
            return executeV3Step1a({
              selfieReferences: selfieReferences as ReferenceImage[],
              selfieComposite,
              faceComposite,
              bodyComposite,
              styleSettings,
              downloadAsset,
              aspectRatio,
              aspectRatioConfig,
              expectedWidth: step1aExpectedWidth,
              expectedHeight: step1aExpectedHeight,
              canonicalPrompt,
              step1aArtifacts,
              referenceImages,
              generationId,
              personId,
              teamId,
              selfieAssetIds,
              demographics,
              onCostTracking,
              debugMode,
              evaluationFeedback,
              preparedAssets,
            })
          },
          {
            maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
            sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
            operationName: 'V3 Step 1a person generation',
          },
          createProgressRetryCallback(job, PROGRESS_STEPS.V3_GENERATING_PERSON)
        )

        await saveAllIntermediateImages(
          currentStep1Output.allImageBuffers,
          'v3-step1a-person-grey-bg',
          generationId,
          debugMode
        )
        currentStep1Output.allImageBuffers = []

        if (currentStep1Output.thinking) {
          await saveDebugJson(
            { step: 'step1a', thinking: currentStep1Output.thinking },
            'thinking-step1a',
            generationId,
            debugMode
          )
        }

        if (stopAfterStep === 1) {
          throw new Error('Stopped after Step 1a (debug mode)')
        }

        await updateJobProgress(
          job,
          PROGRESS_STEPS.V3_EVALUATING_PERSON,
          formatProgress({ message: '[2/4] Checking portrait quality...', emoji: '🔍' }, PROGRESS_STEPS.V3_EVALUATING_PERSON)
        )

        let garmentCollageReference = referenceImages?.find(
          (ref) =>
            ref.description?.toLowerCase().includes('garment') ||
            ref.description?.toLowerCase().includes('collage')
        )

        if (!garmentCollageReference && preparedAssets) {
          const preparedCollage = preparedAssets.get('custom-clothing-garment-collage')
          if (preparedCollage?.data.base64) {
            garmentCollageReference = {
              base64: preparedCollage.data.base64,
              mimeType: preparedCollage.data.mimeType || 'image/png',
              description: 'Garment collage showing authorized clothing and accessories for this outfit',
            }
          }
        }

        const evalOutput = await executeWithRateLimitRetry(
          async () => {
            await consumeApiCallBudget('V3 Step 1a evaluation')
            return executeV3Step1aEval({
              imageBuffer: currentStep1Output.imageBuffer,
              selfieReferences: selfieReferences as ReferenceImage[],
              selfieComposite,
              faceComposite,
              bodyComposite,
              expectedWidth: step1aExpectedWidth,
              expectedHeight: step1aExpectedHeight,
              aspectRatioConfig,
              generationPrompt: JSON.stringify(projectForStep1a(canonicalPrompt)),
              garmentCollageReference,
              generationId,
              personId,
              teamId,
              onCostTracking,
            })
          },
          {
            maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
            sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
            operationName: 'V3 Step 1a Eval',
          },
          createProgressRetryCallback(job, PROGRESS_STEPS.V3_EVALUATING_PERSON)
        )

        const evaluation = evalOutput.evaluation
        evaluationFeedback = buildEvaluationFeedback(evaluation)

        if (evaluationFeedback.suggestedAdjustments) {
          evaluatorComments.push(evaluationFeedback.suggestedAdjustments)
        }

        const approved = isApproved(evaluation)
        logEvaluationResult('V3 Step 1a Eval', attempt, evaluation, approved)

        if (approved) {
          evaluatorComments.length = 0
          step1aOutput = {
            ...currentStep1Output,
            evaluatorComments,
          }
          break
        }

        if (attempt >= 3) {
          throw new EvaluationFailedError(`V3 Step 1a failed after 3 attempts: ${evaluation.reason}`, {
            evaluation,
            imageS3Key: undefined,
            generationId,
            promptHash: canonicalPromptHash || computePromptHash(canonicalPrompt),
            attempt: currentAttempt,
            aspectRatio,
          })
        }
      }

      if (!step1aOutput) {
        throw new Error('V3 Step 1a: Generation returned no output')
      }

      step1aPersonFormat = await detectImageFormat(step1aOutput.imageBuffer)
      const personImage = await intermediateStorage.saveBuffer(step1aOutput.imageBuffer, {
        fileName: `step1a-person-${Date.now()}.${step1aPersonFormat.extension}`,
        description: 'V3 Step 1a person output',
        mimeType: step1aPersonFormat.mimeType,
      })

      let personAssetId: string | undefined = step1aOutput.assetId
      if (!step1aOutput.reused && selfieAssetIds && selfieAssetIds.length > 0) {
        try {
          const personAsset = await AssetService.createAsset({
            s3Key: personImage.key,
            type: 'intermediate',
            subType: 'person_on_grey',
            mimeType: step1aPersonFormat.mimeType,
            ownerType: teamId ? 'team' : 'person',
            teamId,
            personId,
            parentAssetIds: selfieAssetIds,
            temporary: false,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          })

          const styleParams = StyleFingerprintService.extractFromStyleSettings(styleSettings as Record<string, unknown>)
          const fingerprint = StyleFingerprintService.createPersonFingerprint(selfieAssetIds, {
            aspectRatio,
            expression: styleParams.expression,
            pose: styleParams.pose,
            shotType: styleParams.shotType,
            clothingType: styleParams.clothingType,
            clothingColor: styleParams.clothingColor,
            lighting: styleParams.lighting,
          })

          await AssetService.updateFingerprint(personAsset.id, fingerprint, {
            ...styleParams,
            step: 'person_on_grey',
          })

          personAssetId = personAsset.id
        } catch (error) {
          Logger.warn('V3 Step 1a: Failed to create asset for intermediate', {
            generationId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      await persistStatePatch({
        step1a: {
          personImage,
          personAssetId,
          clothingLogoReference: step1aOutput.clothingLogoReference,
          backgroundLogoReference: step1aOutput.backgroundLogoReference,
          evaluatorComments: step1aOutput.evaluatorComments,
        },
      })
    }

    if (!step1aOutput) {
      throw new Error('V3 Step 1a failed to produce output')
    }
    if (!step1aPersonFormat) {
      step1aPersonFormat = await detectImageFormat(step1aOutput.imageBuffer)
    }
    const resolvedStep1aOutput = step1aOutput

    await updateJobProgress(
      job,
      PROGRESS_STEPS.V3_PERSON_COMPLETE,
      formatProgress(getProgressMessage('v3-person-complete'), PROGRESS_STEPS.V3_PERSON_COMPLETE)
    )

    const allEvaluatorComments = [...(resolvedStep1aOutput.evaluatorComments ?? [])]

    const faceCompositeReference = resolvedStep1aOutput.faceComposite || resolvedStep1aOutput.selfieComposite
    const bodyCompositeReference = resolvedStep1aOutput.bodyComposite

    const MAX_STEP2_RETRIES = 2
    let step2EvalFeedback: string[] = []

    const preparedCustomBackgroundAsset = preparedAssets?.get('background-custom-background')
    const preparedCustomBackgroundBuffer = preparedCustomBackgroundAsset?.data.base64
      ? Buffer.from(preparedCustomBackgroundAsset.data.base64, 'base64')
      : undefined
    const preparedCustomBackgroundMimeType =
      preparedCustomBackgroundAsset?.data.mimeType || 'image/jpeg'
    const preparedCustomBackgroundMetadata = preparedCustomBackgroundAsset?.data.metadata as
      | Record<string, unknown>
      | undefined

    const backgroundBufferForStep2 = preparedCustomBackgroundBuffer ?? undefined

    const personFormatForStep2 = step1aPersonFormat
    const backgroundFormatForStep2 = backgroundBufferForStep2
      ? await detectImageFormat(backgroundBufferForStep2)
      : undefined

    const step2Resolution = STAGE_RESOLUTION.STEP_2_COMPOSITION || resolution
    const resolutionMultiplier = getResolutionMultiplier(step2Resolution)
    const scaledExpectedWidth = expectedWidth * resolutionMultiplier
    const scaledExpectedHeight = expectedHeight * resolutionMultiplier
    const brandingValue =
      styleSettings.branding && hasValue(styleSettings.branding) ? styleSettings.branding.value : undefined
    const hasBackgroundOrElementsBranding =
      brandingValue?.type === 'include' &&
      (brandingValue.position === 'background' || brandingValue.position === 'elements')
    const isBackgroundPreBranded = preparedCustomBackgroundMetadata?.preBrandedWithLogo === true
    const evaluateBrandingPlacement = hasBackgroundOrElementsBranding && !isBackgroundPreBranded

    await updateJobProgress(
      job,
      PROGRESS_STEPS.V3_PREPARING_COMPOSITION,
      formatProgress(getProgressMessage('v3-preparing-composition'), PROGRESS_STEPS.V3_PREPARING_COMPOSITION)
    )

    for (let step2Attempt = 0; step2Attempt <= MAX_STEP2_RETRIES; step2Attempt += 1) {
      const isStep2Retry = step2Attempt > 0

      await updateJobProgress(
        job,
        PROGRESS_STEPS.V3_COMPOSITING,
        formatProgress(getProgressMessage('v3-compositing'), PROGRESS_STEPS.V3_COMPOSITING),
      )

      const compositionComments = [...allEvaluatorComments, ...step2EvalFeedback]

      const step2Output = await executeWithRateLimitRetry(
        async () => {
          await consumeApiCallBudget('V3 Step 2 composition')
          return executeV3Step2(
            {
              personBuffer: resolvedStep1aOutput.imageBuffer,
              personMimeType: personFormatForStep2.mimeType,
              backgroundBuffer: backgroundBufferForStep2,
              backgroundMimeType:
                backgroundFormatForStep2?.mimeType ??
                (preparedCustomBackgroundBuffer ? preparedCustomBackgroundMimeType : undefined),
              styleSettings,
              faceCompositeReference,
              bodyCompositeReference,
              evaluatorComments: compositionComments.length > 0 ? compositionComments : undefined,
              aspectRatio,
              resolution: STAGE_RESOLUTION.STEP_2_COMPOSITION || resolution,
              canonicalPrompt,
              step2Artifacts,
              generationId,
              onCostTracking,
              preparedAssets,
            },
          )
        },
        {
          maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
          sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
          operationName: 'V3 Step 2 composition',
        },
        createProgressRetryCallback(job, PROGRESS_STEPS.V3_COMPOSITING)
      )

      await saveAllIntermediateImages(
        step2Output.allImageBuffers || [step2Output.refinedBuffer],
        'v3-step2-final-composition',
        generationId,
        debugMode
      )
      step2Output.allImageBuffers = []

      if (step2Output.thinking) {
        await saveDebugJson(
          { step: 'step2', thinking: step2Output.thinking },
          'thinking-step2',
          generationId,
          debugMode
        )
      }

      if (stopAfterStep === 2) {
        throw new Error('Stopped after Step 2 (debug mode)')
      }

      await updateJobProgress(
        job,
        PROGRESS_STEPS.V3_FINAL_EVAL,
        formatProgress({ message: '[4/4] Final quality check...', emoji: '🎯' }, PROGRESS_STEPS.V3_FINAL_EVAL),
      )

      const step3Output = await executeWithRateLimitRetry(
        async () => {
          await consumeApiCallBudget('V3 Step 3 final evaluation')
          return executeV3Step3(
            {
              refinedBuffer: step2Output.refinedBuffer,
              selfieComposite: resolvedStep1aOutput.selfieComposite,
              faceComposite: resolvedStep1aOutput.faceComposite,
              bodyComposite: resolvedStep1aOutput.bodyComposite,
              expectedWidth: scaledExpectedWidth,
              expectedHeight: scaledExpectedHeight,
              aspectRatio,
              logoReference: evaluateBrandingPlacement
                ? resolvedStep1aOutput.backgroundLogoReference
                : undefined,
              styleSettings,
              evaluateBrandingPlacement,
              canonicalPrompt,
              step3EvalArtifacts,
              generationId,
              onCostTracking,
            },
          )
        },
        {
          maxRetries: RETRY_CONFIG.MAX_RATE_LIMIT_RETRIES,
          sleepMs: RETRY_CONFIG.RATE_LIMIT_SLEEP_MS,
          operationName: 'V3 Step 3 Final Eval',
        },
        createProgressRetryCallback(job, PROGRESS_STEPS.V3_FINAL_EVAL)
      )

      if (stopAfterStep === 3) {
        throw new Error('Stopped after Step 3 (debug mode)')
      }

      if (step3Output.evaluation.status === 'Approved') {
        await updateJobProgress(
          job,
          PROGRESS_STEPS.V3_COMPLETE,
          formatProgress({ message: 'Generation complete', emoji: '✅' }, PROGRESS_STEPS.V3_COMPLETE)
        )

        return {
          approvedImageBuffers: [step2Output.refinedBuffer],
        }
      }

      const failedCriteria = step3Output.evaluation.failedCriteria ?? []
      const isDimensionFailure = failedCriteria.some(
        (criterion) =>
          criterion.includes('Dimension mismatch') || criterion.includes('Aspect ratio mismatch')
      )
      const needsNewPerson =
        isDimensionFailure ||
        failedCriteria.some(
          (criterion) =>
            criterion.includes('face_similarity') ||
            criterion.includes('characteristic_preservation')
        )

      if (needsNewPerson) {
        const metadata = await sharp(step2Output.refinedBuffer).metadata()
        const evaluationResult: ImageEvaluationResult = {
          status: step3Output.evaluation.status,
          reason: step3Output.evaluation.reason,
          details: {
            actualWidth: metadata.width ?? null,
            actualHeight: metadata.height ?? null,
            dimensionMismatch: isDimensionFailure,
            aspectMismatch: isDimensionFailure,
            selfieDuplicate: false,
            matchingReferenceLabel: null,
            uncertainCount: undefined,
            autoReject: true,
          },
        }

        throw new EvaluationFailedError(
          `V3 Step 3 final evaluation failed: ${step3Output.evaluation.reason}`,
          {
            evaluation: evaluationResult,
            imageS3Key: undefined,
            generationId,
            promptHash: canonicalPromptHash || computePromptHash(canonicalPrompt),
            attempt: currentAttempt,
            aspectRatio,
          }
        )
      }

      if (step2Attempt < MAX_STEP2_RETRIES) {
        step2EvalFeedback = [
          `Previous composition attempt was rejected: ${step3Output.evaluation.reason}. Failed criteria: ${failedCriteria.join(', ')}. Please fix these issues.`,
        ]

        await updateJobProgress(
          job,
          PROGRESS_STEPS.V3_COMPOSITING,
          formatProgress({ message: '[3/4] Refining composition...', emoji: '🔄' }, PROGRESS_STEPS.V3_COMPOSITING),
        )
        continue
      }

      const metadata = await sharp(step2Output.refinedBuffer).metadata()
      const actualWidth = metadata.width ?? null
      const actualHeight = metadata.height ?? null
      const expectedRatio = scaledExpectedWidth / scaledExpectedHeight
      const actualRatio =
        actualWidth && actualHeight && actualHeight !== 0 ? actualWidth / actualHeight : null

      const evaluationResult: ImageEvaluationResult = {
        status: step3Output.evaluation.status,
        reason: step3Output.evaluation.reason,
        details: {
          actualWidth,
          actualHeight,
          dimensionMismatch:
            actualWidth === null ||
            actualHeight === null ||
            Math.abs(actualWidth - scaledExpectedWidth) > 50 ||
            Math.abs(actualHeight - scaledExpectedHeight) > 50,
          aspectMismatch:
            actualRatio === null ? true : Math.abs(actualRatio - expectedRatio) > 0.05,
          selfieDuplicate: false,
          matchingReferenceLabel: null,
          uncertainCount: undefined,
          autoReject: false,
        },
      }

      throw new EvaluationFailedError(
        `V3 Step 3 final evaluation failed after ${MAX_STEP2_RETRIES + 1} composition attempts: ${step3Output.evaluation.reason}`,
        {
          evaluation: evaluationResult,
          imageS3Key: undefined,
          generationId,
          promptHash: canonicalPromptHash || computePromptHash(canonicalPrompt),
          attempt: currentAttempt,
          aspectRatio,
        }
      )
    }

  throw new Error('V3 Step 2→3 retry loop completed without result')
}
