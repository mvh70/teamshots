/**
 * Image Generation Worker
 * 
 * Processes image generation jobs using AI providers
 */

import { Worker, Job, UnrecoverableError } from 'bullmq'
import sharp from 'sharp'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'

import { ImageGenerationJobData, redis } from '@/queue'
import { prisma } from '@/lib/prisma'
import { refundCreditsForFailedGeneration } from '@/domain/credits/credits'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { Env } from '@/lib/env'
import { sendSupportNotificationEmail } from '@/lib/email'
import type { SupportNotificationAttachment } from '@/lib/email'
import { getProgressMessage, formatProgressWithAttempt } from '@/lib/generation-progress-messages'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'
import { PhotoStyleSettings } from '@/types/photo-style'
import { isRateLimitError, MAX_RATE_LIMIT_RETRIES, RATE_LIMIT_SLEEP_MS } from '@/lib/rate-limit-retry'
import { asRecord } from '@/lib/type-guards'
import { CostTrackingService } from '@/domain/services/CostTrackingService'
import type { CostReason, CostResult } from '@/domain/services/CostTrackingService'
import type { AIModelId, AIProvider } from '@/config/ai-costs'
import { AssetService } from '@/domain/services/AssetService'

// Import shared utilities for V1 workflow improvements
import { executeWithRateLimitRetry, createProgressRetryCallback } from './generate-image/utils/retry-handler'

import { ASPECT_RATIOS, DEFAULT_ASPECT_RATIO } from '@/domain/style/elements/aspect-ratio/config'
import type { AspectRatioId } from '@/domain/style/elements/aspect-ratio/config'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import { hasValue } from '@/domain/style/elements/base/element-types'
import { extractPackageId } from '@/domain/style/settings-resolver'
import { getServerPackageConfig } from '@/domain/style/packages/server'
import type { ImageEvaluationResult } from './generate-image/evaluator'
import { executeV3Workflow } from './generate-image/workflow-v3'
import { EvaluationFailedError } from './generate-image/errors'
import {
  downloadAssetAsBase64,
  uploadGeneratedImagesToS3,
  prepareSelfies
} from './generate-image/s3-utils'
import type { V3WorkflowState, PersistedImageReference } from '@/types/workflow'
import { getWorkflowState, setWorkflowState } from './generate-image/utils/workflow-state'

const s3Client = createS3Client({ forcePathStyle: false })
const BUCKET_NAME = getS3BucketName()

// Note: RATE_LIMIT_SLEEP_MS and MAX_RATE_LIMIT_RETRIES now exported from @/lib/rate-limit-retry

// Create worker
const imageGenerationWorker = new Worker<ImageGenerationJobData>(
  'image-generation',
  async (job: Job<ImageGenerationJobData>) => {
    const { generationId, personId, userId, teamId, selfieS3Keys, selfieAssetIds, selfieTypeMap, prompt, creditSource, providerOptions } = job.data as (typeof job.data) & {
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
        Logger.warn('Cost tracking failed', {
          generationId,
          stepName: params.stepName,
          error: costError instanceof Error ? costError.message : String(costError),
        })
      }
    }

    let workflowState = getWorkflowState(job)
    let cleanupAfterSuccess = false

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
      const relativeKey = buildIntermediateKey(meta.fileName)
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: getS3Key(relativeKey),
          Body: buffer,
          ContentType: meta.mimeType ?? 'image/png'
        })
      )
      return {
        key: relativeKey,
        mimeType: meta.mimeType ?? 'image/png',
        description: meta.description
      }
    }

    const downloadIntermediateAsset = async (reference: PersistedImageReference): Promise<Buffer> => {
      const asset = await downloadAssetAsBase64({ bucketName: BUCKET_NAME, s3Client, key: reference.key })
      if (!asset) {
        throw new Error(`Intermediate asset missing: ${reference.key}`)
      }
      return Buffer.from(asset.base64, 'base64')
    }

    const referenceFromPersisted = async (reference: PersistedImageReference) => {
      const buffer = await downloadIntermediateAsset(reference)
      return {
        base64: buffer.toString('base64'),
        mimeType: reference.mimeType,
        description: reference.description
      }
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

      if (state.composites?.selfie) refs.push(state.composites.selfie)
      if (state.composites?.faceComposite) refs.push(state.composites.faceComposite)
      if (state.composites?.bodyComposite) refs.push(state.composites.bodyComposite)
      if (state.composites?.background) refs.push(state.composites.background)
      if (state.composites?.garmentCollage) refs.push(state.composites.garmentCollage)
      if (state.step1a?.personImage) refs.push(state.step1a.personImage)
      if (state.step1a?.backgroundImage) refs.push(state.step1a.backgroundImage)
      if (state.step1b?.backgroundImage) refs.push(state.step1b.backgroundImage)

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
          status: true,
          styleSettings: true
        }
      })

      if (!generation) {
        throw new Error(`Generation record not found for ID: ${generationId}. The generation may have been deleted or never created.`)
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

      // V3 is the only supported workflow version
      const workflowVersion = 'v3'

      // Centralized selfie preparation (download, rotate, normalize)
      const { selfieReferences, processedSelfies } = await prepareSelfies({
        bucketName: BUCKET_NAME,
        s3Client,
        selfieKeys: providedKeys
      })

      let basePrompt: string
      let mustFollowRulesFromPayload: string[] = []
      let freedomRulesFromPayload: string[] = []
      let referenceImages =
        [] as {
          description?: string
          base64: string
          mimeType: string
        }[]
      let labelInstruction: string | undefined
      let aspectRatioFromPayload: string
      let aspectRatioDescription: string

      // Check if custom clothing is configured
      const hasCustomClothing = Boolean(
        mergedStyleSettings.customClothing?.value &&
        (mergedStyleSettings.customClothing.value.outfitS3Key || mergedStyleSettings.customClothing.value.assetId)
      )

      // Can only use cached payload if:
      // 1. V3 workflow
      // 2. Has cached payload and selfie composite
      // 3. If custom clothing is configured, must have garment collage in state
      const canUseCachedPayload =
        workflowVersion === 'v3' &&
        Boolean(workflowState?.cachedPayload) &&
        Boolean(workflowState?.composites?.selfie) &&
        (!hasCustomClothing || Boolean(workflowState?.composites?.garmentCollage))

      if (canUseCachedPayload && workflowState?.cachedPayload) {
        basePrompt = workflowState.cachedPayload.prompt
        mustFollowRulesFromPayload = workflowState.cachedPayload.mustFollowRules
        freedomRulesFromPayload = workflowState.cachedPayload.freedomRules
        aspectRatioFromPayload = workflowState.cachedPayload.aspectRatio
        aspectRatioDescription = workflowState.cachedPayload.aspectRatioDescription

        // Restore garment collage from workflow state if it exists
        if (workflowState.composites?.garmentCollage) {
          const garmentCollage = await referenceFromPersisted(workflowState.composites.garmentCollage)
          referenceImages.push(garmentCollage)
          Logger.info('[DEBUG] Restored garment collage from workflow state', {
            generationId,
            s3Key: workflowState.composites.garmentCollage.key
          })
        }
      } else {
        const generationPayload = await stylePackage.buildGenerationPayload({
          generationId,
          personId,
          userId,
          prompt,
          styleSettings: mergedStyleSettings as PhotoStyleSettings,
          selfieKeys: providedKeys,
          processedSelfies,
          selfieTypeMap, // Pass selfie type map for split composite building
          options: {
            workflowVersion
          }
        })

        basePrompt = generationPayload.prompt
        mustFollowRulesFromPayload = generationPayload.mustFollowRules || []
        freedomRulesFromPayload = generationPayload.freedomRules || []
        referenceImages = generationPayload.referenceImages
        labelInstruction = generationPayload.labelInstruction
        aspectRatioFromPayload = generationPayload.aspectRatio
        aspectRatioDescription = generationPayload.aspectRatioDescription

        // Persist split composites (face/body) to workflow state if available
        if (workflowVersion === 'v3') {
          const compositePatch: V3WorkflowState['composites'] = {
            ...(workflowState?.composites ?? {})
          }

          // Persist face composite if available
          if (generationPayload.faceComposite) {
            const persistedFaceComposite = await uploadIntermediateAsset(
              Buffer.from(generationPayload.faceComposite.base64, 'base64'),
              {
                fileName: `face-composite-${randomUUID()}.png`,
                description: generationPayload.faceComposite.description,
                mimeType: generationPayload.faceComposite.mimeType ?? 'image/png'
              }
            )
            compositePatch.faceComposite = persistedFaceComposite
            Logger.info('Persisted face composite to workflow state', {
              generationId,
              s3Key: persistedFaceComposite.key
            })
          }

          // Persist body composite if available
          if (generationPayload.bodyComposite) {
            const persistedBodyComposite = await uploadIntermediateAsset(
              Buffer.from(generationPayload.bodyComposite.base64, 'base64'),
              {
                fileName: `body-composite-${randomUUID()}.png`,
                description: generationPayload.bodyComposite.description,
                mimeType: generationPayload.bodyComposite.mimeType ?? 'image/png'
              }
            )
            compositePatch.bodyComposite = persistedBodyComposite
            Logger.info('Persisted body composite to workflow state', {
              generationId,
              s3Key: persistedBodyComposite.key
            })
          }

          // Update workflow state if we added any split composites
          if (compositePatch.faceComposite || compositePatch.bodyComposite) {
            const patch: V3WorkflowState = {
              ...workflowState,
              composites: compositePatch
            }
            await persistWorkflowState(patch)
            workflowState = patch
          }
        }

        // Persist garment collage to workflow state if it was generated
        const garmentCollage = referenceImages.find((ref) =>
          ref.description?.toLowerCase().includes('garment') ||
          ref.description?.toLowerCase().includes('collage')
        )

        if (garmentCollage && workflowVersion === 'v3') {
          const persistedGarmentCollage = await uploadIntermediateAsset(
            Buffer.from(garmentCollage.base64, 'base64'),
            {
              fileName: `garment-collage-${randomUUID()}.png`,
              description: garmentCollage.description,
              mimeType: garmentCollage.mimeType ?? 'image/png'
            }
          )

          const patch: V3WorkflowState = {
            ...workflowState,
            composites: {
              ...(workflowState?.composites ?? {}),
              garmentCollage: persistedGarmentCollage
            }
          }

          await persistWorkflowState(patch)
          workflowState = patch

          Logger.info('[DEBUG] Persisted garment collage to workflow state', {
            generationId,
            s3Key: persistedGarmentCollage.key
          })
        }
      }

      const finalPrompt = labelInstruction ? `${basePrompt}\n\n${labelInstruction}` : basePrompt

      try {
        await job.updateProgress({ progress: 20, message: formatProgress(getProgressMessage(), 20) })
      } catch (err: unknown) {
        Logger.warn('Failed to update prompt generation progress', {
          error: err instanceof Error ? err.message : String(err)
        })
      }

      Logger.info('Generated Prompt for Gemini', { prompt: basePrompt })

      let approvedImageBuffers: Buffer[] | undefined

      // V3 is the only supported workflow
      try {
          const v3SelfieReferences = selfieReferences.map((ref, index) => ({
            label: ref.label || `SELFIE${index + 1}`,
            base64: ref.base64,
            mimeType: ref.mimeType
          }))

          let v3SelfieComposite
          let v3FaceComposite: { base64: string; mimeType: string; description?: string } | undefined
          let v3BodyComposite: { base64: string; mimeType: string; description?: string } | undefined

          if (workflowState?.composites?.selfie) {
            v3SelfieComposite = await referenceFromPersisted(workflowState.composites.selfie)
          } else {
            const generatedComposite = referenceImages.find((reference) =>
              reference.description?.toLowerCase().includes('composite')
            )

            if (!generatedComposite) {
              throw new Error('V3 workflow requires a selfie composite, but none was generated.')
            }

            v3SelfieComposite = generatedComposite

            const persistedComposite = await uploadIntermediateAsset(
              Buffer.from(generatedComposite.base64, 'base64'),
              {
                fileName: `selfie-composite-${randomUUID()}.png`,
                description: generatedComposite.description,
                mimeType: generatedComposite.mimeType ?? 'image/png'
              }
            )

            const patch: V3WorkflowState = {
              ...workflowState,
              cachedPayload: {
                prompt: basePrompt,
                mustFollowRules: mustFollowRulesFromPayload,
                freedomRules: freedomRulesFromPayload,
                aspectRatio: aspectRatioFromPayload,
                aspectRatioDescription
              },
              composites: {
                ...(workflowState?.composites ?? {}),
                selfie: persistedComposite
              }
            }

            await persistWorkflowState(patch)
            workflowState = patch
          }

          // Load face composite from workflow state if available
          if (workflowState?.composites?.faceComposite) {
            v3FaceComposite = await referenceFromPersisted(workflowState.composites.faceComposite)
            Logger.info('Loaded face composite from workflow state', {
              generationId,
              hasFaceComposite: true
            })
          }

          // Load body composite from workflow state if available
          if (workflowState?.composites?.bodyComposite) {
            v3BodyComposite = await referenceFromPersisted(workflowState.composites.bodyComposite)
            Logger.info('Loaded body composite from workflow state', {
              generationId,
              hasBodyComposite: true
            })
          }

          const intermediateStorage = {
            saveBuffer: uploadIntermediateAsset,
            loadBuffer: (reference: PersistedImageReference) => downloadIntermediateAsset(reference)
          }

          const v3Result = await executeV3Workflow({
            job,
            generationId,
            personId,
            userId,
            teamId,
            selfieReferences: v3SelfieReferences,
            selfieAssetIds,
            backgroundAssetId: job.data.backgroundAssetId,
            logoAssetId: job.data.logoAssetId,
            selfieComposite: v3SelfieComposite,
            faceComposite: v3FaceComposite, // Split face composite (front_view + side_view selfies)
            bodyComposite: v3BodyComposite, // Split body composite (partial_body + full_body selfies)
            styleSettings: mergedStyleSettings,
            prompt: basePrompt,
            mustFollowRules: mustFollowRulesFromPayload,
            freedomRules: freedomRulesFromPayload,
            referenceImages, // Pre-built references from package (e.g., outfit collage)
            aspectRatio: aspectRatioFromPayload,
            downloadAsset: (key) => downloadAssetAsBase64({ bucketName: BUCKET_NAME, s3Client, key }),
            currentAttempt,
            maxAttempts,
            debugMode: providerOptions?.debugMode === true,
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
          if (workflowState?.step1b?.backgroundAssetId) {
            parentAssetIds.push(workflowState.step1b.backgroundAssetId)
          }

          const outputAsset = await AssetService.createAsset({
            s3Key: finalImageKey,
            type: 'generated',
            mimeType: 'image/png',
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
        await job.updateProgress({ progress: 100, message: formatProgress({
          message: 'All done! Your photo is ready!',
          emoji: '✨'
        }, 100) })
      } catch (err: unknown) {
        Logger.warn('Failed to update completion progress', {
          error: err instanceof Error ? err.message : String(err)
        })
      }

      Logger.info(`Image generation completed for job ${job.id}`)
      
      Telemetry.increment('generation.worker.success')

      if (cleanupAfterSuccess) {
        await cleanupIntermediateState()
      }

      return {
        success: true,
        generationId,
        imageKeys: generatedImageKeys,
        cost: undefined
      }
      
    } catch (error) {
      Telemetry.increment('generation.worker.error')
      // Extract comprehensive error details
      let errorMessage = error instanceof Error ? error.message : String(error)
      const errorDetails: Record<string, unknown> = {
        message: errorMessage,
        name: error instanceof Error ? error.name : 'Unknown',
      }
      
      // Try to extract additional details from the error object (e.g., Gemini API response)
      if (error && typeof error === 'object') {
        // Google SDK errors often have additional properties
        if ('status' in error) errorDetails.status = error.status
        if ('statusText' in error) errorDetails.statusText = error.statusText
        if ('response' in error) {
          try {
            errorDetails.response = JSON.stringify(error.response)
            // Enhance error message with response details if available
            errorMessage = `${errorMessage} | Response: ${JSON.stringify(error.response)}`
          } catch {
            errorDetails.response = String(error.response)
            errorMessage = `${errorMessage} | Response: ${String(error.response)}`
          }
        }
        if ('cause' in error) {
          try {
            errorDetails.cause = JSON.stringify(error.cause)
            errorMessage = `${errorMessage} | Cause: ${JSON.stringify(error.cause)}`
          } catch {
            errorDetails.cause = String(error.cause)
            errorMessage = `${errorMessage} | Cause: ${String(error.cause)}`
          }
        }
        // Check for Gemini-specific error properties
        if ('code' in error) errorDetails.code = error.code
        if ('details' in error) {
          try {
            errorDetails.details = JSON.stringify(error.details)
          } catch {
            errorDetails.details = String(error.details)
          }
        }
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
      
      // Send support notification email on failure (only on final attempt to avoid spam)
      const maxAttempts = job.opts?.attempts || 3
      
      // Check if this is a V2 workflow failure (internal retries exhausted)
      // These errors indicate logical failure after multiple internal attempts, so we shouldn't retry the whole job
      // NOTE: EvaluationFailedError is NOT a workflow failure - it should trigger retries
      const isWorkflowFailure = error instanceof Error && (
        error.message.includes('Step 1 failed after') ||
        error.message.includes('Step 5 failed after') ||
        error.message.includes('Step 7 failed after') ||
        error.message.includes('Step 4 validation failed')
      )
      
      const isFinalAttempt = job.attemptsMade >= maxAttempts - 1 || isWorkflowFailure

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
            await notifyEvaluationFailure({
              generationId: error.generationId,
              personId,
              userId,
              jobId: job.id,
              attempt: error.attempt,
              evaluations: [error.evaluation],
              aspectRatioDescription: error.aspectRatio,
              shotLabel: 'N/A',
              imageBase64: [error.imageBase64]
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
        // Wait a bit to ensure the message is visible before retry
        await new Promise(resolve => setTimeout(resolve, 2000))
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

Error: ${finalErrorMessage}
Error Stack: ${error instanceof Error ? error.stack : 'N/A'}
Error Details: ${JSON.stringify(errorDetails, null, 2)}`,
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
                errorDetails,
                selfieS3Keys,
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
      if (isWorkflowFailure) {
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
    message += `Shot guidance: ${shotLabel}\nAspect ratio: ${aspectRatioDescription}\nPerson ID: ${personId}\nUser ID: ${
      userId ?? 'N/A'
    }\nUser Email: ${userEmail ?? 'N/A'}\nJob ID: ${resolvedJobId}\n\n`

    evaluations.forEach((evaluation, index) => {
      const variationNumber = index + 1
      message += `Variation ${variationNumber}: ${evaluation.status}\n`
      message += `Reason: ${evaluation.reason}\n`
      const { actualWidth, actualHeight } = evaluation.details
      message += `Detected dimensions: ${actualWidth ?? 'unknown'}x${
        actualHeight ?? 'unknown'
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
    evaluations.forEach((evaluation, index) => {
      if (evaluation.status === 'Approved') {
        return
      }
      const base64 = imageBase64[index]
      if (!base64) {
        return
      }
      attachments.push({
        filename: `${generationId}-attempt-${attempt}-variation-${index + 1}.png`,
        base64,
        mimeType: 'image/png'
      })
    })

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

// Note: isRateLimitError and rate limit retry logic now centralized in @/lib/rate-limit-retry

function isModelNotFoundError(error: unknown): boolean {
  const metadata = collectErrorMetadata(error)
  if (metadata.statusCodes.includes(404)) {
    return true
  }

  return metadata.messages.some((message) => {
    const normalized = message.toLowerCase()
    return normalized.includes('not found') && normalized.includes('model')
  })
}

function collectErrorMetadata(error: unknown): { statusCodes: number[]; messages: string[] } {
  const statusCodes: number[] = []
  const messages: string[] = []
  const seen = new Set<unknown>()
  const queue: unknown[] = [error]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || seen.has(current)) {
      continue
    }
    seen.add(current)

    if (typeof current === 'string') {
      messages.push(current)
      try {
        const parsed = JSON.parse(current) as unknown
        queue.push(parsed)
      } catch {
        // ignore parse errors
      }
      continue
    }

    if (typeof current !== 'object') {
      continue
    }

    const maybeStatus = (current as { status?: unknown }).status
    if (typeof maybeStatus === 'number') {
      statusCodes.push(maybeStatus)
    }

    const maybeCode = (current as { code?: unknown }).code
    if (typeof maybeCode === 'number') {
      statusCodes.push(maybeCode)
    }

    const maybeMessage = (current as { message?: unknown }).message
    if (typeof maybeMessage === 'string') {
      messages.push(maybeMessage)
    }

    const nestedCandidates: unknown[] = []
    const maybeResponse = (current as { response?: unknown }).response
    if (maybeResponse) nestedCandidates.push(maybeResponse)

    const maybeError = (current as { error?: unknown }).error
    if (maybeError) nestedCandidates.push(maybeError)

    const maybeDetails = (current as { details?: unknown }).details
    if (maybeDetails) nestedCandidates.push(maybeDetails)

    const maybeCause = (current as { cause?: unknown }).cause
    if (maybeCause) nestedCandidates.push(maybeCause)

    for (const candidate of nestedCandidates) {
      if (candidate !== undefined && candidate !== null) {
        queue.push(candidate)
      }
    }
  }

  return {
    statusCodes,
    messages
  }
}

// Note: asRecord now centralized in @/lib/type-guards
// Note: isRateLimitError, RATE_LIMIT_SLEEP_MS, and delay now centralized in @/lib/rate-limit-retry

export default imageGenerationWorker

