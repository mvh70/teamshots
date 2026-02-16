/**
 * Image Generation Worker
 * 
 * Processes image generation jobs using AI providers
 */

import { Worker, Job, UnrecoverableError } from 'bullmq'
import sharp from 'sharp'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

import { ImageGenerationJobData, redis } from '@/queue'
import { prisma } from '@/lib/prisma'
import { refundCreditsForFailedGeneration } from '@/domain/credits/credits'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { Env } from '@/lib/env'
import { sendSupportNotificationEmail } from '@/lib/email'
import type { SupportNotificationAttachment } from '@/lib/email'
import { detectImageFormat, mimeTypeFromFileName } from '@/lib/image-format'
import { getProgressMessage, formatProgressWithAttempt } from '@/lib/generation-progress-messages'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'
import { PhotoStyleSettings } from '@/types/photo-style'
import { isRateLimitError } from '@/lib/rate-limit-retry'
import { asRecord } from '@/lib/type-guards'
import { CostTrackingService } from '@/domain/services/CostTrackingService'
import type { CostReason, CostResult } from '@/domain/services/CostTrackingService'
import type { AIModelId, AIProvider } from '@/config/ai-costs'
import { AssetService } from '@/domain/services/AssetService'

import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import { hasValue } from '@/domain/style/elements/base/element-types'
import { extractPackageId } from '@/domain/style/settings-resolver'
import { getServerPackageConfig } from '@/domain/style/packages/server'
import type { ImageEvaluationResult } from './generate-image/evaluator'
import { executeV3Workflow } from './generate-image/workflow-v3'
import { EvaluationFailedError } from './generate-image/errors'
import {
  downloadAssetAsBuffer,
  downloadAssetAsBase64,
  detectImageFormatFromBase64,
  uploadGeneratedImagesToS3,
  prepareSelfies
} from './generate-image/s3-utils'
import type { V3WorkflowState, PersistedImageReference } from '@/types/workflow'
import { getWorkflowState, setWorkflowState } from './generate-image/utils/workflow-state'

const s3Client = createS3Client({ forcePathStyle: false })
const BUCKET_NAME = getS3BucketName()

const VALID_SELFIE_KEY_PATTERN = /^selfies\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/

export function destroyGenerateImageResources(): void {
  s3Client.destroy()
}

// Note: RATE_LIMIT_SLEEP_MS and MAX_RATE_LIMIT_RETRIES now exported from @/lib/rate-limit-retry

// Create worker
const imageGenerationWorker = new Worker<ImageGenerationJobData>(
  'image-generation',
  async (job: Job<ImageGenerationJobData>) => {
    const { generationId, personId, userId, teamId, selfieS3Keys, selfieAssetIds, selfieTypeMap, demographics, prompt, creditSource, providerOptions } = job.data as (typeof job.data) & {
      workflowState?: V3WorkflowState
    }

    // Create cost tracking handler for the workflow
    const handleCostTracking = async (params: {
      stepName: string
      reason: CostReason
      result: CostResult
      model: AIModelId
      provider?: AIProvider  // UPDATED: Accept actual provider from generation result
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
    }) => {
      try {
        if (params.reusedAssetId) {
          await CostTrackingService.trackReuse({
            generationId,
            personId,
            teamId,
            model: params.model,
            reason: params.reason,
            reusedAssetId: params.reusedAssetId,
            workflowVersion: providerOptions?.workflowVersion as string || 'v3',
            stepName: params.stepName,
          })
        } else {
          // Use actual provider if provided, otherwise fall back to config
          const provider = params.provider ||
            (await import('@/config/ai-costs').then(m => m.getModelConfig(params.model))).provider as AIProvider

          await CostTrackingService.trackCall({
            generationId,
            personId,
            teamId,
            provider,  // Use actual provider from generation result
            model: params.model,
            inputTokens: params.inputTokens,
            outputTokens: params.outputTokens,
            imagesGenerated: params.imagesGenerated,
            reason: params.reason,
            result: params.result,
            errorMessage: params.errorMessage,
            durationMs: params.durationMs,
            workflowVersion: providerOptions?.workflowVersion as string || 'v3',
            stepName: params.stepName,
            outputAssetId: params.outputAssetId,
            // NEW: Evaluation outcome tracking
            evaluationStatus: params.evaluationStatus,
            rejectionReason: params.rejectionReason,
            intermediateS3Key: params.intermediateS3Key,
          })
        }
      } catch (costError) {
        // Don't fail the generation if cost tracking fails
        Telemetry.increment('generation.cost_tracking.failure')
        Logger.warn('Cost tracking failed', {
          generationId,
          stepName: params.stepName,
          error: costError instanceof Error ? costError.message : String(costError),
        })
      }
    }

    let workflowState = getWorkflowState(job)
    let cleanupAfterSuccess = false
    const debugMode = process.env.NODE_ENV !== 'production' && providerOptions?.debugMode === true

    const persistWorkflowState = async (nextState: V3WorkflowState | undefined) => {
      workflowState = nextState
      await setWorkflowState(job, nextState)
    }

    const buildIntermediateKey = (fileName: string): string =>
      `generations/${personId}/${generationId}/intermediate/${fileName}`

    const uploadIntermediateAsset = async (
      buffer: Buffer,
      meta: { fileName: string; description?: string; mimeType?: string }
    ): Promise<PersistedImageReference> => {
      const detected = meta.mimeType ? undefined : await detectImageFormat(buffer)
      const mimeType = meta.mimeType ?? detected?.mimeType ?? 'image/png'
      const relativeKey = buildIntermediateKey(meta.fileName)
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: getS3Key(relativeKey),
          Body: buffer,
          ContentType: mimeType
        })
      )
      return {
        key: relativeKey,
        mimeType,
        description: meta.description
      }
    }

    const downloadIntermediateAsset = async (reference: PersistedImageReference): Promise<Buffer> => {
      if (!reference.key.startsWith(`generations/${personId}/${generationId}/`)) {
        throw new Error(`Intermediate asset key outside generation scope: ${reference.key}`)
      }

      const asset = await downloadAssetAsBuffer({ bucketName: BUCKET_NAME, s3Client, key: reference.key })
      if (!asset) {
        throw new Error(`Intermediate asset missing: ${reference.key}`)
      }
      return asset.buffer
    }

    const deleteIntermediateAssets = async (references: PersistedImageReference[]): Promise<void> => {
      await Promise.all(
        references.map((reference) =>
          s3Client
            .send(
              new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: getS3Key(reference.key)
              })
            )
            .catch((error: unknown) => {
              Logger.warn('Failed to delete intermediate asset', {
                key: reference.key,
                error: error instanceof Error ? error.message : String(error)
              })
            })
        )
      )
    }

    const collectIntermediateReferences = (state?: V3WorkflowState): PersistedImageReference[] => {
      if (!state) return []

      const refs: PersistedImageReference[] = []

      if (state.step1a?.personImage) refs.push(state.step1a.personImage)

      return refs
    }

    const cleanupIntermediateState = async (): Promise<void> => {
      const refs = collectIntermediateReferences(workflowState)
      if (refs.length > 0) {
        const uniqueRefs = Array.from(new Map(refs.map((ref) => [ref.key, ref])).values())
        await deleteIntermediateAssets(uniqueRefs)
      }
      await persistWorkflowState(undefined)
    }

    // Get attempt info for inclusion in all progress messages
    const maxAttempts = job.opts?.attempts || 3
    const currentAttempt = job.attemptsMade + 1

    // Helper to format progress messages with attempt info (uses centralized utility)
    const formatProgress = (progressMsg: { message: string; emoji?: string }, progress: number): string => {
      const result = formatProgressWithAttempt(progressMsg, progress, currentAttempt)
      return result
    }

    try {
      Logger.info(`Starting image generation for job ${job.id}, generation ${generationId}, attempt ${currentAttempt}/${maxAttempts}`)

      // Check if generation exists before processing
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: {
          id: true,
          personId: true,
          status: true,
          styleSettings: true
        }
      })

      if (!generation) {
        throw new Error(`Generation record not found for ID: ${generationId}. The generation may have been deleted or never created.`)
      }

      if (generation.personId !== personId) {
        throw new UnrecoverableError(
          `Generation/person mismatch: generation ${generationId} belongs to ${generation.personId}, job has ${personId}`
        )
      }

      // Update generation status to processing (only if it exists)
      try {
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'processing',
            updatedAt: new Date()
          }
        })
      } catch (updateError) {
        // If update fails, log but continue (generation might have been deleted)
        Logger.warn('Failed to update generation status to processing', {
          generationId,
          error: updateError instanceof Error ? updateError.message : String(updateError),
          currentStatus: generation.status
        })
        // Re-check if generation still exists
        const stillExists = await prisma.generation.findUnique({
          where: { id: generationId },
          select: { id: true }
        })
        if (!stillExists) {
          throw new Error(`Generation ${generationId} was deleted during processing`)
        }
      }

      const firstProgressMsg = formatProgress(getProgressMessage('starting-preprocessing'), 10)
      Logger.info('Updating progress with message', { message: firstProgressMsg, progress: 10 })
      try {
        await job.updateProgress({ progress: 10, message: firstProgressMsg })
      } catch (err: unknown) {
        Logger.warn('Failed to update initial progress', {
          error: err instanceof Error ? err.message : String(err)
        })
      }

      // Background removal processing disabled - using original selfie

      if (!generation.styleSettings) {
        throw new Error(`Generation ${generationId} is missing styleSettings. This should never happen for valid generations.`)
      }

      if (typeof prompt !== 'string' || prompt.length > 50000) {
        throw new UnrecoverableError('Invalid prompt payload in job data')
      }

      const savedStyleSettings = asRecord(generation.styleSettings)
      if (!savedStyleSettings) {
        throw new Error(`Generation ${generationId} has invalid styleSettings format. Expected object, got: ${typeof generation.styleSettings}`)
      }

      // Extract packageId and deserialize settings
      const packageId = extractPackageId(savedStyleSettings) || 'headshot1'
      const stylePackage = getServerPackageConfig(packageId)
      const mergedStyleSettings = stylePackage.persistenceAdapter.deserialize(savedStyleSettings) as PhotoStyleSettings

      // Ensure presetId is set
      if (!mergedStyleSettings.presetId) {
        mergedStyleSettings.presetId = stylePackage.defaultPresetId
      }

      // Ensure package defaults are applied for non-user-visible settings.
      // Some packages (e.g. headshot1) intentionally do not persist shotType, but
      // the V3 workflow's element composition relies on styleSettings.shotType.
      // If it's missing here, ShotTypeElement falls back to DEFAULT_SHOT_TYPE
      // (medium-close-up) and can inject conflicting framing rules vs the prompt JSON.
      if (!hasValue(mergedStyleSettings.shotType)) {
        const packageDefaultShotType = (stylePackage.defaultSettings as PhotoStyleSettings | undefined)?.shotType
        if (hasValue(packageDefaultShotType)) {
          mergedStyleSettings.shotType = packageDefaultShotType
        }
      }

      const shotTypeInput = hasValue(mergedStyleSettings.shotType)
        ? mergedStyleSettings.shotType.value.type
        : undefined
      const shotTypeConfig = resolveShotType(shotTypeInput)
      const shotLabel = shotTypeConfig.id.replace(/-/g, ' ')
      const shotDescription = shotTypeConfig.framingDescription

      const providedKeys = selfieS3Keys

      if (!providedKeys || providedKeys.length === 0) {
        throw new Error('At least one selfieS3Key is required')
      }

      if (!providedKeys.every((key) => VALID_SELFIE_KEY_PATTERN.test(key))) {
        throw new UnrecoverableError('Invalid selfieS3Keys format in job payload')
      }

      // V3 is the only supported workflow version
      const workflowVersion = 'v3'

      // Centralized selfie preparation (download, rotate, normalize)
      const { selfieReferences, processedSelfies } = await prepareSelfies({
        bucketName: BUCKET_NAME,
        s3Client,
        selfieKeys: providedKeys
      })

      let basePrompt: string
      let referenceImages =
        [] as {
          description?: string
          base64: string
          mimeType: string
        }[]
      let aspectRatioFromPayload: string
      let aspectRatioDescription: string
      let v3SelfieComposite: { base64: string; mimeType: string; description?: string } | undefined
      let v3FaceComposite: { base64: string; mimeType: string; description?: string } | undefined
      let v3BodyComposite: { base64: string; mimeType: string; description?: string } | undefined

      const generationPayload = await stylePackage.buildGenerationPayload({
        generationId,
        personId,
        userId,
        prompt,
        demographics,
        styleSettings: mergedStyleSettings as PhotoStyleSettings,
        selfieKeys: providedKeys,
        processedSelfies,
        selfieTypeMap,
        options: {
          workflowVersion,
        },
      })

      basePrompt = generationPayload.prompt
      referenceImages = generationPayload.referenceImages
      aspectRatioFromPayload = generationPayload.aspectRatio
      aspectRatioDescription = generationPayload.aspectRatioDescription
      v3SelfieComposite = generationPayload.selfieComposite
      v3FaceComposite = generationPayload.faceComposite
      v3BodyComposite = generationPayload.bodyComposite

      if (!v3SelfieComposite && !v3FaceComposite && !v3BodyComposite) {
        throw new Error('V3 workflow requires at least one selfie/face/body composite reference.')
      }

      try {
        await job.updateProgress({ progress: 12, message: formatProgress(getProgressMessage('starting-preprocessing'), 12) })
      } catch (err: unknown) {
        Logger.warn('Failed to update prompt generation progress', {
          error: err instanceof Error ? err.message : String(err)
        })
      }

      Logger.info('Generated Prompt for Gemini\nPrompt:\n' + basePrompt)

      let approvedImageBuffers: Buffer[] | undefined

      // V3 is the only supported workflow
      try {
        const v3SelfieReferences = selfieReferences.map((ref, index) => ({
          label: providedKeys[index] || ref.label || `SELFIE${index + 1}`,
          base64: ref.base64,
          mimeType: ref.mimeType
        }))

        const intermediateStorage = {
          saveBuffer: uploadIntermediateAsset,
          loadBuffer: (reference: PersistedImageReference) => downloadIntermediateAsset(reference)
        }

        const v3Result = await executeV3Workflow({
          job,
          generationId,
          personId,
          teamId,
          selfieReferences: v3SelfieReferences,
          selfieAssetIds,
          demographics, // Aggregated demographics from selfies
          selfieComposite: v3SelfieComposite,
          faceComposite: v3FaceComposite, // Split face composite (front_view + side_view selfies)
          bodyComposite: v3BodyComposite, // Split body composite (partial_body + full_body selfies)
          styleSettings: mergedStyleSettings,
          prompt: basePrompt,
          referenceImages, // Pre-built references from package (e.g., outfit collage)
          aspectRatio: aspectRatioFromPayload,
          downloadAsset: (key) => downloadAssetAsBase64({ bucketName: BUCKET_NAME, s3Client, key }),
          currentAttempt,
          maxAttempts,
          debugMode,
          stopAfterStep: providerOptions?.stopAfterStep as number | undefined,
          workflowState,
          persistWorkflowState,
          intermediateStorage,
          onCostTracking: handleCostTracking,
        })

        approvedImageBuffers = v3Result.approvedImageBuffers
        cleanupAfterSuccess = true
      } catch (error) {
        Logger.error('V3 workflow failed', {
          generationId,
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }

      // Upload generated images to S3
      const generatedImageKeys = await uploadGeneratedImagesToS3({
        images: approvedImageBuffers!,
        bucketName: BUCKET_NAME,
        s3Client,
        personId,
        generationId
      })
      try {
        await job.updateProgress({ progress: 80, message: formatProgress(getProgressMessage(), 80) })
      } catch (err: unknown) {
        Logger.warn('Failed to update upload progress', {
          error: err instanceof Error ? err.message : String(err)
        })
      }

      // Track output assets (create Asset records for final generated images)
      const outputAssets: string[] = []
      for (const finalImageKey of generatedImageKeys) {
        try {
          // Get parent asset IDs from workflow state
          const parentAssetIds: string[] = []
          if (workflowState?.step1a?.personAssetId) {
            parentAssetIds.push(workflowState.step1a.personAssetId)
          }

          const outputAsset = await AssetService.createAsset({
            s3Key: finalImageKey,
            type: 'generated',
            mimeType: mimeTypeFromFileName(finalImageKey),
            ownerType: teamId ? 'team' : 'person',
            teamId: teamId ?? undefined,
            personId: personId,
            parentAssetIds,
            // No fingerprint for final outputs (unique per generation)
          })

          outputAssets.push(outputAsset.id)

          Logger.info('Created Asset for final output', {
            assetId: outputAsset.id,
            generationId,
            s3Key: finalImageKey,
            parentAssetIds,
          })
        } catch (error) {
          Logger.warn('Failed to create asset for final output', {
            error: error instanceof Error ? error.message : String(error),
            s3Key: finalImageKey,
            generationId,
          })
        }
      }

      // Link first output asset to generation
      if (outputAssets.length > 0) {
        try {
          await AssetService.linkGenerationToAsset(generationId, outputAssets[0])
          Logger.info('Linked generation to output asset', {
            generationId,
            outputAssetId: outputAssets[0],
          })
        } catch (error) {
          Logger.warn('Failed to link generation to asset', {
            error: error instanceof Error ? error.message : String(error),
            generationId,
            outputAssetId: outputAssets[0],
          })
        }
      }

      // Update generation record with results
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: 'completed',
          generatedPhotoKeys: generatedImageKeys,
          provider: 'gemini',
          completedAt: new Date(),
          updatedAt: new Date()
        }
      })

      try {
        await job.updateProgress({
          progress: 100, message: formatProgress({
            message: 'All done! Your photo is ready!',
            emoji: '✨'
          }, 100)
        })
      } catch (err: unknown) {
        Logger.warn('Failed to update completion progress', {
          error: err instanceof Error ? err.message : String(err)
        })
      }

      Logger.info(`Image generation completed for job ${job.id}`)

      Telemetry.increment('generation.worker.success')

      if (cleanupAfterSuccess) {
        try {
          await cleanupIntermediateState()
        } catch (cleanupError) {
          Logger.warn('Failed to cleanup intermediate assets after success', {
            generationId,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          })
        }
      }

      return {
        success: true,
        generationId,
        imageKeys: generatedImageKeys,
        cost: undefined
      }

    } catch (error) {
      Logger.error('Critical image generation worker failure', {
        generationId,
        error: error instanceof Error ? error.message : String(error)
      })

      Telemetry.increment('generation.worker.error')
      // Extract comprehensive error details
      let errorMessage = error instanceof Error ? error.message : String(error)
      const errorDetails: Record<string, unknown> = {
        message: errorMessage,
        name: error instanceof Error ? error.name : 'Unknown',
      }

      // Allowlist only non-sensitive fields from provider errors.
      if (error && typeof error === 'object') {
        if ('status' in error) errorDetails.status = error.status
        if ('statusText' in error) errorDetails.statusText = error.statusText
        if ('code' in error) errorDetails.code = error.code
      }

      // Check if this is a rate limit error (429) - filter out stack trace
      const isRateLimit = isRateLimitError(error)

      // Track if we've already sent an evaluation failure email (with image attachments)
      let evaluationFailureEmailSent = false

      // Log EvaluationFailedError but don't send notification yet - wait for final attempt
      if (error instanceof EvaluationFailedError) {
        Logger.warn('Image generation failed evaluation checks', {
          generationId,
          reason: error.message,
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts?.attempts || 3
        })
        // Notification with image attachments will be sent on final attempt (see below)
      }

      if (isRateLimit) {
        // For rate limit errors, log without stack trace
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { stack, ...errorDetailsWithoutStack } = errorDetails
        Logger.error(`Image generation rate limited (429) for job ${job.id}`, errorDetailsWithoutStack)
      } else {
        Logger.error(`Image generation failed for job ${job.id}`, errorDetails)
      }

      // Truncate error message if too long (database field has limit, but we'll keep it reasonable)
      const maxErrorMessageLength = 2000
      const finalErrorMessage = errorMessage.length > maxErrorMessageLength
        ? errorMessage.substring(0, maxErrorMessageLength) + '...[truncated]'
        : errorMessage

      // Check if this is a workflow failure (internal retries exhausted)
      // These errors indicate logical failure after multiple internal attempts, so we shouldn't retry the whole job.
      // NOTE: EvaluationFailedError is NOT a workflow failure - it should trigger retries.
      const isWorkflowFailure = error instanceof Error && (
        error.message.includes('V3 Step 1a failed after') ||
        error.message.includes('V3 Step 3 final evaluation failed after') ||
        error.message.includes('V3 Step 2→3 retry loop completed without result')
      )
      const isApiBudgetExceeded =
        error instanceof Error && error.message.includes('V3 API call budget exceeded')

      const isFinalAttempt = job.attemptsMade >= maxAttempts - 1 || isWorkflowFailure || isApiBudgetExceeded

      if (isFinalAttempt) {
        try {
          await cleanupIntermediateState()
        } catch (cleanupError) {
          Logger.warn('Failed to cleanup intermediate assets after final failure', {
            generationId,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          })
        }

        // Send evaluation failure notification with image attachments ONLY on final attempt
        if (error instanceof EvaluationFailedError) {
          try {
            const attachmentImages: string[] = []
            if (error.imageS3Key) {
              const attachmentAsset = await downloadAssetAsBase64({
                bucketName: BUCKET_NAME,
                s3Client,
                key: error.imageS3Key,
              })
              if (attachmentAsset?.base64) {
                attachmentImages.push(attachmentAsset.base64)
              }
            }

            await notifyEvaluationFailure({
              generationId: error.generationId,
              personId,
              userId,
              jobId: job.id,
              attempt: error.attempt,
              evaluations: [error.evaluation],
              aspectRatioDescription: error.aspectRatio,
              shotLabel: 'N/A',
              imageBase64: attachmentImages
            })
            evaluationFailureEmailSent = true
          } catch (notifyError) {
            Logger.error('Failed to send evaluation failure notification', {
              generationId,
              error: notifyError instanceof Error ? notifyError.message : String(notifyError)
            })
          }
        }
      }

      // Get current progress for retry message
      const currentProgress = typeof job.progress === 'object' && job.progress !== null && 'progress' in job.progress
        ? (job.progress as { progress?: number }).progress || 0
        : typeof job.progress === 'number' ? job.progress : 0

      if (!isFinalAttempt) {
        // Update progress with retry message before throwing to trigger retry
        // Make retry message more prominent by keeping it at current progress
        const retryMessage = `🔄 Attempt ${currentAttempt} of ${maxAttempts} failed. Retrying...`
        await job.updateProgress({ progress: currentProgress, message: retryMessage })
      }

      // Update generation status to failed on final attempt
      if (isFinalAttempt) {
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'failed',
            errorMessage: finalErrorMessage,
            updatedAt: new Date()
          }
        })

        // Check if this is a regeneration (free) before attempting refund
        // Get generation record with creditSource and person info
        const generationRecord = await prisma.generation.findUnique({
          where: { id: generationId },
          select: {
            creditsUsed: true,
            creditSource: true,
            person: {
              select: {
                teamId: true,
                userId: true
              }
            }
          }
        })

        // Only refund credits if this was a paid generation (not a regeneration)
        if (generationRecord && generationRecord.creditsUsed > 0) {
          try {
            // Use creditSource from generation record (more reliable than job data)
            const genCreditSource = (generationRecord.creditSource as 'individual' | 'team') || creditSource

            // Get teamId from person record (for team credits)
            const refundTeamId = genCreditSource === 'team' ? (generationRecord.person.teamId || undefined) : undefined

            Logger.debug('Refunding credits', {
              genCreditSource,
              personId,
              teamId: refundTeamId,
              creditsRefunded: generationRecord.creditsUsed
            })

            // Credits are always refunded to personId (Person is the business entity)
            await refundCreditsForFailedGeneration(
              personId,
              generationRecord.creditsUsed, // Use actual credits used, not config value
              `Refund for failed generation ${generationId}`,
              refundTeamId
            )
            Logger.info(`Credits refunded for failed generation ${generationId}`, {
              personId,
              teamId: refundTeamId,
              creditsRefunded: generationRecord.creditsUsed,
              creditSource: genCreditSource
            })
          } catch (refundError) {
            Logger.error(`Failed to refund credits for generation ${generationId}`, {
              error: refundError instanceof Error ? refundError.message : String(refundError),
              personId,
              creditSource,
              creditsUsed: generationRecord.creditsUsed
            })
          }
        } else {
          Logger.debug(`Skipping refund for regeneration ${generationId} (free)`, {
            creditsUsed: generationRecord?.creditsUsed
          })
        }

        // Only send support notification email on final attempt to avoid spam
        // Skip if we already sent an evaluation failure email (which includes the image)
        if (!evaluationFailureEmailSent) {
          try {
            // Get user email for context
            const userEmail = userId ? await prisma.user.findUnique({
              where: { id: userId },
              select: { email: true }
            }).then(u => u?.email) : undefined

            // Extract packageId from generation record for error reporting
            const errorGeneration = await prisma.generation.findUnique({
              where: { id: generationId },
              select: { styleSettings: true }
            })
            const errorPackageId = errorGeneration?.styleSettings && typeof errorGeneration.styleSettings === 'object' && !Array.isArray(errorGeneration.styleSettings)
              ? extractPackageId(errorGeneration.styleSettings as Record<string, unknown>) || 'unknown'
              : 'unknown'

            await sendSupportNotificationEmail({
              subject: `Image Generation Failed - Generation ${generationId}`,
              message: `Image generation has failed after ${maxAttempts} attempts.

Generation ID: ${generationId}
Person ID: ${personId}
User ID: ${userId || 'N/A'}
User Email: ${userEmail || 'N/A'}
Job ID: ${job.id}
Attempts: ${job.attemptsMade}/${maxAttempts}

Error Name: ${error instanceof Error ? error.name : 'UnknownError'}
Error Message: ${finalErrorMessage}`,
              metadata: {
                generationId,
                personId,
                userId,
                userEmail,
                jobId: job.id,
                attemptsMade: job.attemptsMade,
                maxAttempts,
                errorMessage: finalErrorMessage,
                errorName: error instanceof Error ? error.name : 'Unknown',
                errorDetails: {
                  name: error instanceof Error ? error.name : 'Unknown',
                  message: finalErrorMessage,
                },
                selfieCount: selfieS3Keys?.length ?? 0,
                packageId: errorPackageId
              }
            })
            Logger.info(`Support notification sent for failed generation ${generationId}`)
          } catch (emailError) {
            Logger.error(`Failed to send support notification for generation ${generationId}`, {
              error: emailError instanceof Error ? emailError.message : String(emailError)
            })
          }
        } else {
          Logger.info(`Skipping duplicate support notification for evaluation failure - already sent with image attachments`, {
            generationId
          })
        }
      }

      // Rethrow to trigger retry mechanism if attempts remain
      if (isWorkflowFailure || isApiBudgetExceeded) {
        throw new UnrecoverableError(error instanceof Error ? error.message : String(error))
      }
      throw error
    }
  },
  {
    connection: redis,
    concurrency: 3, // Process up to 3 jobs concurrently
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  }
)

// Worker event handlers
imageGenerationWorker.on('completed', (job) => {
  Logger.info('Job completed successfully', { jobId: job.id })
})

imageGenerationWorker.on('failed', (job, error) => {
  if (!job) {
    Logger.error('Job (unknown) failed', { error: error instanceof Error ? error.message : String(error) })
    return
  }
  Logger.error('Job failed', { jobId: job.id, attempts: job.attemptsMade, error: error instanceof Error ? error.message : String(error) })
})

imageGenerationWorker.on('stalled', (jobId) => {
  Logger.warn('Job stalled', { jobId })
})

async function notifyEvaluationFailure({
  generationId,
  personId,
  userId,
  jobId,
  attempt,
  evaluations,
  aspectRatioDescription,
  shotLabel,
  imageBase64
}: {
  generationId: string
  personId: string
  userId?: string
  jobId?: string | number
  attempt: number
  evaluations: ImageEvaluationResult[]
  aspectRatioDescription: string
  shotLabel: string
  imageBase64: string[]
}): Promise<void> {
  try {
    const userEmail =
      userId && typeof userId === 'string'
        ? await prisma.user
          .findUnique({
            where: { id: userId },
            select: { email: true }
          })
          .then((user) => user?.email ?? undefined)
        : undefined

    const resolvedJobId = jobId ?? 'N/A'

    let message = `Automated evaluation rejected generated images for generation ${generationId} (attempt ${attempt}).\n`
    message += `Shot guidance: ${shotLabel}\nAspect ratio: ${aspectRatioDescription}\nPerson ID: ${personId}\nUser ID: ${userId ?? 'N/A'
      }\nUser Email: ${userEmail ?? 'N/A'}\nJob ID: ${resolvedJobId}\n\n`

    evaluations.forEach((evaluation, index) => {
      const variationNumber = index + 1
      message += `Variation ${variationNumber}: ${evaluation.status}\n`
      message += `Reason: ${evaluation.reason}\n`
      const { actualWidth, actualHeight } = evaluation.details
      message += `Detected dimensions: ${actualWidth ?? 'unknown'}x${actualHeight ?? 'unknown'
        }px\n`
      if (evaluation.details.selfieDuplicate) {
        message += `Flagged duplicate of reference ${evaluation.details.matchingReferenceLabel ?? 'unknown'}.\n`
      }
      message += '\n'
    })

    const metadata = {
      generationId,
      attempt,
      personId,
      userId,
      userEmail,
      jobId: resolvedJobId === 'N/A' ? null : String(resolvedJobId),
      aspectRatioDescription,
      shotLabel,
      evaluations: evaluations.map((evaluation, index) => ({
        variation: index + 1,
        status: evaluation.status,
        reason: evaluation.reason,
        details: evaluation.details
      }))
    }

    const attachments: SupportNotificationAttachment[] = []
    for (let index = 0; index < evaluations.length; index += 1) {
      const evaluation = evaluations[index]
      if (evaluation.status === 'Approved') {
        continue
      }
      const base64 = imageBase64[index]
      if (!base64) {
        continue
      }
      const imageFormat = detectImageFormatFromBase64(base64)
      attachments.push({
        filename: `${generationId}-attempt-${attempt}-variation-${index + 1}.${imageFormat.extension}`,
        base64,
        mimeType: imageFormat.mimeType
      })
    }

    await sendSupportNotificationEmail({
      subject: `Image QA Rejection - Generation ${generationId}`,
      message,
      metadata,
      attachments
    })
    Logger.info('Sent QA rejection notification to support', {
      generationId,
      attempt,
      jobId: resolvedJobId
    })
  } catch (error) {
    Logger.error('Failed to send QA rejection notification', {
      error: error instanceof Error ? error.message : String(error),
      generationId,
      attempt
    })
  }
}

export default imageGenerationWorker
