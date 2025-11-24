/**
 * Image Generation Worker
 * 
 * Processes image generation jobs using AI providers
 */

import { Worker, Job, UnrecoverableError } from 'bullmq'
import sharp from 'sharp'

import { ImageGenerationJobData, redis } from '@/queue'
import { prisma } from '@/lib/prisma'
import { refundCreditsForFailedGeneration } from '@/domain/credits/credits'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { Env } from '@/lib/env'
import { sendSupportNotificationEmail } from '@/lib/email'
import type { SupportNotificationAttachment } from '@/lib/email'
import { getProgressMessage, formatProgressWithAttempt } from '@/lib/generation-progress-messages'
import { createS3Client, getS3BucketName } from '@/lib/s3-client'
import { PhotoStyleSettings } from '@/types/photo-style'
import { isRateLimitError, MAX_RATE_LIMIT_RETRIES, RATE_LIMIT_SLEEP_MS, delay } from '@/lib/rate-limit-retry'
import { asRecord } from '@/lib/type-guards'

import { ASPECT_RATIOS, DEFAULT_ASPECT_RATIO } from '@/domain/style/elements/aspect-ratio/config'
import type { AspectRatioId } from '@/domain/style/elements/aspect-ratio/config'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import { resolveStyleSettings } from './generate-image/style-settings'
import { preprocessSelfie } from './generate-image/preprocessing'
import { generateWithGemini } from './generate-image/gemini'
import { evaluateGeneratedImage } from './generate-image/evaluator'
import type { ImageEvaluationResult, SelfieReference } from './generate-image/evaluator'
import { executeV2Workflow } from './generate-image/workflow-v2'
import {
  downloadAssetAsBase64,
  downloadSelfieAsBase64,
  uploadGeneratedImagesToS3
} from './generate-image/s3-utils'
import type { DownloadAssetFn, DownloadSelfieFn } from '@/types/generation'

const USE_COMPOSITE_REFERENCE = Env.boolean('USE_COMPOSITE_REFERENCE', true)
const SKIP_GEMINI_PROMPT = Env.boolean('SKIP_GEMINI_PROMPT', false)

const s3Client = createS3Client({ forcePathStyle: false })
const BUCKET_NAME = getS3BucketName()
const PROGRESS_UPDATE_DEBOUNCE_MS = 100 // Minimum time between identical progress updates

// Note: RATE_LIMIT_SLEEP_MS and MAX_RATE_LIMIT_RETRIES now exported from @/lib/rate-limit-retry

// Create worker
const imageGenerationWorker = new Worker<ImageGenerationJobData>(
  'image-generation',
  async (job: Job<ImageGenerationJobData>) => {
    const { generationId, personId, userId, selfieS3Key, selfieS3Keys, styleSettings, prompt, creditSource, providerOptions } = job.data
    
    // Get attempt info for inclusion in all progress messages
    const maxAttempts = job.opts?.attempts || 3
    const currentAttempt = job.attemptsMade + 1
    
    // Helper to format progress messages with attempt info (uses centralized utility)
    const formatProgress = (progressMsg: { message: string; emoji?: string }, progress: number): string => {
      const result = formatProgressWithAttempt(progressMsg, progress, currentAttempt)
      Logger.debug('Progress message formatted', { 
        original: progressMsg.message.substring(0, 50), 
        progress,
        attempt: currentAttempt,
        final: result.substring(0, 80) 
      })
      return result
    }
    
    try {
      Logger.info(`Starting image generation for job ${job.id}, generation ${generationId}, attempt ${currentAttempt}/${maxAttempts}`)
      Logger.debug('Reference mode selected', { useCompositeReference: USE_COMPOSITE_REFERENCE })
      
      // Check if generation exists before processing
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: {
          id: true,
          status: true,
          styleSettings: true,
          context: {
            select: {
              name: true,
              settings: true
            }
          }
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
      Logger.debug('Using original selfie without background removal processing')

      const savedStyleSettings = asRecord(generation.styleSettings)
      const contextSettings = asRecord(generation.context?.settings)
      const jobStyleSettingsRecord = asRecord(styleSettings)

      const styleResolution = resolveStyleSettings({
        savedStyleSettings,
        contextSettings,
        jobStyleSettings: jobStyleSettingsRecord
      })

      const { packageId, stylePackage, mergedStyleSettings } = styleResolution

      const shotTypeInput =
        typeof mergedStyleSettings.shotType?.type === 'string'
          ? mergedStyleSettings.shotType.type
          : undefined
      const shotTypeConfig = resolveShotType(shotTypeInput)
      const shotLabel = shotTypeConfig.label
      const shotDescription = shotTypeConfig.framingDescription

      Logger.debug('Generation context', { name: generation.context?.name })
      Logger.debug('Raw saved styleSettings', { savedStyleSettings })
      Logger.debug('Raw context settings', { settings: generation.context?.settings })
      Logger.debug('Raw job styleSettings', { styleSettings })
      Logger.debug('Package ID', { packageId })
      Logger.debug('ShotType in mergedStyleSettings', { shotType: mergedStyleSettings.shotType })
      
      const downloadSelfie: DownloadSelfieFn = (key) =>
        downloadSelfieAsBase64({ bucketName: BUCKET_NAME, s3Client, key })

      const downloadAsset: DownloadAssetFn = (key) =>
        downloadAssetAsBase64({ bucketName: BUCKET_NAME, s3Client, key })

      const providedKeys = Array.isArray(selfieS3Keys) && selfieS3Keys.length > 0
        ? selfieS3Keys
        : (selfieS3Key ? [selfieS3Key] : [])

      if (providedKeys.length === 0) {
        throw new Error('At least one selfieS3Key is required')
      }

      // Check if V2 workflow is requested (needed to skip preprocessing progress)
      const useV2 = providerOptions?.useV2 === true
      const skipPreprocessingProgress = useV2 // Skip preprocessing progress for V2 (Step 2 handles it)

      const primarySelfieKey = selfieS3Key ?? providedKeys[0]

      const processedSelfies: Record<string, Buffer> = {}

      let lastProgressMessage = ''
      let lastProgressUpdateTime = 0
      const preprocessWithProgress = async (key: string): Promise<Buffer> => {
        if (processedSelfies[key]) {
          return processedSelfies[key]
        }
        const buffer = await preprocessSelfie({
          packageId,
          selfieKey: key,
          styleSettings: mergedStyleSettings,
          downloadSelfie,
          skipLogoPlacement: useV2, // Skip logo placement for V2 (Step 1 handles it separately)
          skipBackgroundProcessing: useV2, // Skip background processing for V2 (Step 2 handles it)
          onStepProgress: skipPreprocessingProgress 
            ? undefined // Skip progress updates for V2 workflow
            : async (stepName) => {
                const progressMsg = getProgressMessage(stepName)
                const formattedMsg = formatProgress(progressMsg, 15)

                // Only debounce identical messages within a short time window
                const now = Date.now()
                if (formattedMsg === lastProgressMessage && now - lastProgressUpdateTime < PROGRESS_UPDATE_DEBOUNCE_MS) {
                  Logger.debug('Skipping duplicate progress update', {
                    stepName,
                    message: formattedMsg.substring(0, 50)
                  })
                  return
                }

                try {
                  await job.updateProgress({ progress: 15, message: formattedMsg })
                  lastProgressMessage = formattedMsg
                  lastProgressUpdateTime = Date.now()
                  Logger.debug('Progress update sent for preprocessing step', {
                    stepName,
                    progress: 15,
                    messagePreview: formattedMsg.substring(0, 50)
                  })
                } catch (err: unknown) {
                  Logger.warn('Failed to update progress', {
                    error: err instanceof Error ? err.message : String(err)
                  })
                }
              }
        })
        processedSelfies[key] = buffer
        return buffer
      }

      await preprocessWithProgress(primarySelfieKey)

      const selfieReferences: SelfieReference[] = []
      for (let index = 0; index < providedKeys.length; index += 1) {
        const key = providedKeys[index]
        const processedBuffer = await preprocessWithProgress(key)
        const pngBuffer = await sharp(processedBuffer).png().toBuffer()
        selfieReferences.push({
          label: `SELFIE${index + 1}`,
          base64: pngBuffer.toString('base64'),
          mimeType: 'image/png'
        })
      }

      const generationPayload = await stylePackage.buildGenerationPayload({
        generationId,
        personId,
        userId,
        prompt,
        styleSettings: mergedStyleSettings as PhotoStyleSettings,
        selfieKeys: providedKeys,
        primarySelfieKey,
        processedSelfies,
        options: {
          useCompositeReference: USE_COMPOSITE_REFERENCE,
          skipLogoInComposite: useV2 // Skip logo in composite for V2 (Step 1/2 handle it separately)
        },
        assets: {
          downloadSelfie,
          downloadAsset,
          preprocessSelfie: preprocessWithProgress
        }
      })

      const {
        prompt: basePrompt,
        referenceImages,
        labelInstruction,
        aspectRatio,
        aspectRatioDescription
      } = generationPayload

      const finalPrompt = labelInstruction ? `${basePrompt}\n\n${labelInstruction}` : basePrompt

      try {
        await job.updateProgress({ progress: 20, message: formatProgress(getProgressMessage(), 20) })
      } catch (err: unknown) {
        Logger.warn('Failed to update prompt generation progress', {
          error: err instanceof Error ? err.message : String(err)
        })
      }

      Logger.info('Generated Prompt for Gemini', { prompt: finalPrompt })

      let approvedImageBuffers: Buffer[] | undefined

      if (useV2) {
        Logger.info('Using V2 workflow for image generation', { generationId })

        try {
          // For V2 workflow, we need to modify the selfie references to exclude logos
          // The V2 workflow handles logos separately in Step 2
          const v2SelfieReferences = selfieReferences.map(ref => ({
            label: ref.label,
            base64: ref.base64,
            mimeType: ref.mimeType
          }))

          const v2Result = await executeV2Workflow({
            job,
            generationId,
            personId,
            userId,
            selfieReferences: v2SelfieReferences,
            styleSettings: mergedStyleSettings,
            prompt: basePrompt, // Use base prompt without label instructions for V2
            aspectRatio,
            resolution: undefined, // V2 workflow handles resolution internally
            downloadAsset,
            currentAttempt,
            maxAttempts,
            debugMode: providerOptions?.debugMode === true
          })

          approvedImageBuffers = v2Result.approvedImageBuffers

        } catch (error) {
          Logger.error('V2 workflow failed', {
            generationId,
            error: error instanceof Error ? error.message : String(error)
          })
          throw error
        }

      } else {
        // Original V1 workflow
        if (SKIP_GEMINI_PROMPT) {
        Logger.warn('SKIP_GEMINI_PROMPT enabled – skipping Gemini call and returning prompt only')

        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'completed',
            generatedPhotoKeys: [],
            actualCost: undefined,
            provider: 'debug-skip',
            completedAt: new Date(),
            updatedAt: new Date()
          }
        })

        await job.updateProgress({
          progress: 100,
          message: formatProgress({
            message: 'Prompt logged for inspection',
            emoji: '📝'
          }, 100)
        })

        return {
          success: true,
          generationId,
          imageKeys: [],
          cost: undefined
        }
      }

      const resolvedAspectRatioId =
        (aspectRatio as AspectRatioId | undefined) ?? (DEFAULT_ASPECT_RATIO.id as AspectRatioId)
      const aspectRatioConfig =
        ASPECT_RATIOS[resolvedAspectRatioId] ?? DEFAULT_ASPECT_RATIO

      // Extract resolution from providerOptions or environment variable
      const resolution = (providerOptions?.resolution as '1K' | '2K' | '4K' | undefined) ||
        (Env.string('GEMINI_IMAGE_RESOLUTION', '') as '1K' | '2K' | '4K' | undefined) ||
        undefined

      const MAX_LOCAL_GENERATION_ATTEMPTS = 2
      let localAttempt = 0
      let approvedImageBuffers: Buffer[] | null = null
      const compositeReference = referenceImages.find((reference) =>
        reference.description?.toLowerCase().includes('composite')
      )
      const logoReference = referenceImages.find((reference) =>
        reference.description?.toLowerCase().includes('logo')
      )
      const backgroundReference = referenceImages.find((reference) =>
        reference.description?.toLowerCase().includes('background')
      )

      while (localAttempt < MAX_LOCAL_GENERATION_ATTEMPTS) {
        let generatedBuffers: Buffer[] = []

        let rateLimitRetries = 0
        while (true) {
          try {
            generatedBuffers = await generateWithGemini(finalPrompt, referenceImages, aspectRatio, resolution)
            break
          } catch (error) {
            if (isModelNotFoundError(error)) {
              Logger.error('Gemini model not found for generation', {
                generationId,
                model: Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash')
              })
              await job.updateProgress({
                progress: 55,
                message: formatProgress({
                  message:
                    'Gemini model configuration error. Please verify GEMINI_IMAGE_MODEL or Vertex AI access.',
                  emoji: '⚠️'
                }, 55)
              })
              throw error
            }

            if (isRateLimitError(error)) {
              rateLimitRetries += 1
              if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
                Logger.error('Exceeded Gemini rate-limit retries', {
                  generationId,
                  rateLimitRetries
                })
                throw error
              }

              const waitSeconds = Math.round(RATE_LIMIT_SLEEP_MS / 1000)
              Logger.warn('Gemini request rate limited; waiting before retry', {
                generationId,
                waitSeconds,
                rateLimitRetries
              })

              await job.updateProgress({
                progress: 55,
                message: formatProgress({
                  message: `Gemini is busy (rate limited). Trying again in ${waitSeconds} seconds...`,
                  emoji: '⏳'
                }, 55)
              })

              await delay(RATE_LIMIT_SLEEP_MS)
              continue
            }

            throw error
          }
        }

        await job.updateProgress({
          progress: 60,
          message: formatProgress(getProgressMessage(), 60)
        })

        if (!generatedBuffers.length) {
          throw new Error('AI generation returned no images')
        }

        const processedVariants = await Promise.all(
          generatedBuffers.map(async (buffer) => {
            const metadata = await sharp(buffer).metadata()
            const pngBuffer = await sharp(buffer).png().toBuffer()
            return {
              buffer: pngBuffer,
              base64: pngBuffer.toString('base64'),
              width: metadata.width ?? null,
              height: metadata.height ?? null
            }
          })
        )

        const attemptIndex = localAttempt + 1
        const evaluations: ImageEvaluationResult[] = []
        let allApproved = true

        await job.updateProgress({
          progress: 65,
          message: formatProgress({
            message: 'Running automated quality check',
            emoji: '🔍'
          }, 65)
        })

        for (let index = 0; index < processedVariants.length; index += 1) {
          const variant = processedVariants[index]
          const evaluation = await evaluateGeneratedImage({
            imageBase64: variant.base64,
            imageIndex: index,
            actualWidth: variant.width,
            actualHeight: variant.height,
            expectedWidth: aspectRatioConfig.width,
            expectedHeight: aspectRatioConfig.height,
            aspectRatioId: aspectRatioConfig.id,
            aspectRatioDescription,
            shotLabel,
            shotDescription,
            generationPrompt: finalPrompt,
            labelInstruction,
            selfieReferences,
            compositeReference: compositeReference
              ? {
                  base64: compositeReference.base64,
                  mimeType: compositeReference.mimeType,
                  description: compositeReference.description
                }
              : undefined,
            logoReference: logoReference
              ? {
                  base64: logoReference.base64,
                  mimeType: logoReference.mimeType,
                  description: logoReference.description
                }
              : undefined,
            backgroundReference: backgroundReference
              ? {
                  base64: backgroundReference.base64,
                  mimeType: backgroundReference.mimeType,
                  description: backgroundReference.description
                }
              : undefined
          })
          evaluations.push(evaluation)
          if (evaluation.status !== 'Approved') {
            allApproved = false
          }
        }

        Logger.info('Gemini evaluation results', {
          generationId,
          attempt: attemptIndex,
          evaluations: evaluations.map((result, idx) => ({
            variation: idx + 1,
            status: result.status,
            reasonPreview: result.reason.slice(0, 200),
            details: result.details
          }))
        })

        if (allApproved) {
          await job.updateProgress({
            progress: 70,
            message: formatProgress({
              message: 'Image approved! Finalizing delivery',
              emoji: '✅'
            }, 70)
          })
          approvedImageBuffers = processedVariants.map((item) => item.buffer)
          break
        }

        await notifyEvaluationFailure({
          generationId,
          personId,
          userId,
          jobId: job.id,
          attempt: attemptIndex,
          evaluations,
          aspectRatioDescription,
          shotLabel,
          imageBase64: processedVariants.map((item) => item.base64)
        })

        localAttempt += 1
        if (localAttempt >= MAX_LOCAL_GENERATION_ATTEMPTS) {
          throw new Error('Generated images failed automated evaluation')
        }

        await job.updateProgress({
          progress: 60,
          message: formatProgress({
            message: 'Image not approved. Regenerating another version for free...',
            emoji: '♻️'
          }, 60)
        })

        Logger.warn('Retrying Gemini image generation after QA rejection', {
          generationId,
          nextAttempt: localAttempt + 1
        })
      }

      if (!approvedImageBuffers || approvedImageBuffers.length === 0) {
        throw new Error('Generated images could not be approved after evaluation retries')
      }
      } // End of original V1 workflow

      // Run final evaluation on V2 output if using V2 workflow
      if (useV2 && approvedImageBuffers && approvedImageBuffers.length > 0) {
        const resolvedAspectRatioId =
          (aspectRatio as AspectRatioId | undefined) ?? (DEFAULT_ASPECT_RATIO.id as AspectRatioId)
        const aspectRatioConfig =
          ASPECT_RATIOS[resolvedAspectRatioId] ?? DEFAULT_ASPECT_RATIO

        const processedVariants = await Promise.all(
          approvedImageBuffers.map(async (buffer: Buffer, index: number) => {
            const metadata = await sharp(buffer).metadata()
            const pngBuffer = await sharp(buffer).png().toBuffer()
            return {
              buffer: pngBuffer,
              base64: pngBuffer.toString('base64'),
              width: metadata.width ?? null,
              height: metadata.height ?? null,
              index
            }
          })
        )

        // Use simplified evaluation for V2 (no complex references needed)
        const evaluations: ImageEvaluationResult[] = []
        let allApproved = true

        await job.updateProgress({
          progress: 95,
          message: formatProgress({
            message: 'Running final quality check',
            emoji: '🔍'
          }, 95)
        })

        for (let index = 0; index < processedVariants.length; index += 1) {
          const variant = processedVariants[index]
          const evaluation = await evaluateGeneratedImage({
            imageBase64: variant.base64,
            imageIndex: index,
            actualWidth: variant.width,
            actualHeight: variant.height,
            expectedWidth: aspectRatioConfig.width,
            expectedHeight: aspectRatioConfig.height,
            aspectRatioId: aspectRatioConfig.id,
            aspectRatioDescription,
            shotLabel,
            shotDescription,
            generationPrompt: finalPrompt,
            labelInstruction,
            selfieReferences,
            compositeReference: undefined, // V2 doesn't use composite references
            logoReference: undefined, // V2 handles branding separately
            backgroundReference: undefined // V2 handles background separately
          })
          evaluations.push(evaluation)
          if (evaluation.status !== 'Approved') {
            allApproved = false
          }
        }

        if (!allApproved) {
          Logger.warn('V2 final output failed evaluation', {
            generationId,
            evaluations: evaluations.map((result, idx) => ({
              variation: idx + 1,
              status: result.status,
              reasonPreview: result.reason.slice(0, 200)
            }))
          })
          // For V2, if final evaluation fails, we still proceed but log the issue
          // This maintains backward compatibility while allowing V2 workflow to complete
          Logger.info('V2 workflow completed despite evaluation concerns', { generationId })
        } else {
          Logger.info('V2 final evaluation passed', { generationId })
        }
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

      // Update generation record with results
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: 'completed',
          generatedPhotoKeys: generatedImageKeys,
          actualCost: undefined,
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
      const isWorkflowFailure = error instanceof Error && (
        error.message.includes('Step 1 failed after') ||
        error.message.includes('Step 5 failed after') ||
        error.message.includes('Step 7 failed after') ||
        error.message.includes('Step 4 validation failed')
      )
      
      const isFinalAttempt = job.attemptsMade >= maxAttempts - 1 || isWorkflowFailure
      
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
            
            // Match the same pattern used when reserving credits:
            // For individual: personId = null, userId = userId
            // For team: personId = personId, userId = null
            const refundPersonId = genCreditSource === 'individual' ? null : personId
            const refundUserId = genCreditSource === 'individual' ? (generationRecord.person.userId || userId || null) : null
            
            // Get teamId from person record (from generation)
            const teamId = generationRecord.person.teamId || undefined
            
            Logger.debug('Refunding credits', { 
              genCreditSource, 
              refundPersonId, 
              refundUserId, 
              teamId,
              creditsRefunded: generationRecord.creditsUsed,
              personTeamId: generationRecord.person.teamId
            })
            
            // Credits are tracked per person, not per invite
            await refundCreditsForFailedGeneration(
              refundPersonId,
              refundUserId,
              generationRecord.creditsUsed, // Use actual credits used, not config value
              `Refund for failed generation ${generationId}`,
              teamId
            )
            Logger.info(`Credits refunded for failed generation ${generationId}`, { 
              personId: refundPersonId, 
              userId: refundUserId, 
              teamId, 
              creditsRefunded: generationRecord.creditsUsed,
              creditSource: genCreditSource 
            })
          } catch (refundError) {
            Logger.error(`Failed to refund credits for generation ${generationId}`, { 
              error: refundError instanceof Error ? refundError.message : String(refundError),
              personId,
              userId,
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
        try {
          // Get user email for context
          const userEmail = userId ? await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true }
          }).then(u => u?.email) : undefined

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
              selfieS3Key,
              packageId: (styleSettings as { packageId?: string })?.packageId || 'unknown'
            }
          })
          Logger.info(`Support notification sent for failed generation ${generationId}`)
        } catch (emailError) {
          Logger.error(`Failed to send support notification for generation ${generationId}`, { 
            error: emailError instanceof Error ? emailError.message : String(emailError) 
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
      if (evaluation.status !== 'Approved' && imageBase64[index]) {
        message += `<img src="data:image/png;base64,${
          imageBase64[index]
        }" alt="Variation ${variationNumber} QA snapshot" style="max-width:100%;height:auto;" />\n`
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

