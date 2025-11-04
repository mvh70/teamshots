/**
 * Image Generation Worker
 * 
 * Processes image generation jobs using AI providers
 */

import { Worker, Job } from 'bullmq'
import { ImageGenerationJobData, redis } from '@/queue'
import { prisma } from '@/lib/prisma'
import { refundCreditsForFailedGeneration } from '@/domain/credits/credits'
import { Logger } from '@/lib/logger'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Telemetry } from '@/lib/telemetry'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import sharp from 'sharp'
import { httpFetch } from '@/lib/http'
import { Env } from '@/lib/env'
import { writeFile as fsWriteFile, readFile as fsReadFile } from 'node:fs/promises'
// Gemini SDK per docs: https://ai.google.dev/gemini-api/docs/image-generation#javascript_8
// Ensure dependency '@google/genai' is installed in package.json
// Fallback: type-only import to avoid runtime errors until installed
import { getPackageConfig } from '@/domain/style/packages'
import { PhotoStyleSettings } from '@/types/photo-style'
import { sendSupportNotificationEmail } from '@/lib/email'
import { getProgressMessage, formatProgressMessage } from '@/lib/generation-progress-messages'
// Background removal processing disabled
// import { processSelfieForBackgroundRemoval, getBestSelfieKey } from '@/lib/ai/selfieProcessor'

// New import for Vertex AI (after other imports, e.g., around line 25)
import { VertexAI } from '@google-cloud/vertexai';
import { Content, GenerateContentResult } from '@google-cloud/vertexai';
import { Part } from '@google-cloud/vertexai';

// S3 client configuration (Hetzner-compatible, aligned with /api/files/get)
const endpoint = Env.string('HETZNER_S3_ENDPOINT', '')
const resolvedEndpoint =
  endpoint && (endpoint.startsWith('http://') || endpoint.startsWith('https://'))
    ? endpoint
    : endpoint
    ? `https://${endpoint}`
    : undefined

const s3Client = new S3Client({
  region: Env.string('HETZNER_S3_REGION', 'eu-central'),
  endpoint: resolvedEndpoint,
  credentials: {
    accessKeyId: Env.string('HETZNER_S3_ACCESS_KEY', ''),
    secretAccessKey: Env.string('HETZNER_S3_SECRET_KEY', ''),
  },
  forcePathStyle: false,
})

const BUCKET_NAME = Env.string('HETZNER_S3_BUCKET')

// Create worker
const imageGenerationWorker = new Worker<ImageGenerationJobData>(
  'image-generation',
  async (job: Job<ImageGenerationJobData>) => {
    const { generationId, personId, userId, selfieS3Key, styleSettings, prompt, creditSource } = job.data
    
    // Get attempt info for inclusion in all progress messages
    const maxAttempts = job.opts?.attempts || 3
    const currentAttempt = job.attemptsMade + 1
    const attemptSuffix = maxAttempts > 1 ? ` (Attempt ${currentAttempt}/${maxAttempts})` : ''
    
    // Helper to format progress messages with attempt info
    const formatProgressWithAttempt = (progressMsg: { message: string; emoji?: string }): string => {
      const formatted = formatProgressMessage(progressMsg)
      const result = formatted + attemptSuffix
      Logger.debug('Progress message formatted', { 
        original: formatted.substring(0, 50), 
        suffix: attemptSuffix, 
        final: result.substring(0, 80) 
      })
      return result
    }
    
    try {
      Logger.info(`Starting image generation for job ${job.id}, generation ${generationId}, attempt ${currentAttempt}/${maxAttempts}`)
      
      // Update generation status to processing
      await prisma.generation.update({
        where: { id: generationId },
        data: { 
          status: 'processing',
          updatedAt: new Date()
        }
      })
      
      const firstProgressMsg = formatProgressWithAttempt(getProgressMessage('starting-preprocessing'))
      Logger.info('Updating progress with message', { message: firstProgressMsg, progress: 10 })
      await job.updateProgress({ progress: 10, message: firstProgressMsg })
      
      // Background removal processing disabled - using original selfie
      Logger.debug('Using original selfie without background removal processing')
      
      // Fetch the generation record to get the saved style settings and context
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { 
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
        throw new Error('Generation not found')
      }
      
      // Use saved styleSettings from generation record if available, otherwise fall back to context or job
      const savedStyleSettings = generation.styleSettings
      const contextSettings = generation.context?.settings
      
      let rawStyleSettings: Record<string, unknown> = {}
      if (savedStyleSettings && typeof savedStyleSettings === 'object' && !Array.isArray(savedStyleSettings)) {
        // Use saved styleSettings from generation record (most accurate)
        rawStyleSettings = savedStyleSettings as Record<string, unknown>
        Logger.debug('Using saved styleSettings from generation record')
      } else if (contextSettings && typeof contextSettings === 'object' && !Array.isArray(contextSettings)) {
        // Fall back to context settings
        rawStyleSettings = contextSettings as Record<string, unknown>
        Logger.debug('Using context settings')
      } else {
        // Finally fall back to job styleSettings
        rawStyleSettings = (styleSettings as Record<string, unknown>) || {}
        Logger.debug('Using job styleSettings')
      }
      
      // Determine packageId - check multiple sources if not present
      let packageId = rawStyleSettings['packageId'] as string | undefined
      if (!packageId && savedStyleSettings && typeof savedStyleSettings === 'object' && !Array.isArray(savedStyleSettings)) {
        packageId = (savedStyleSettings as Record<string, unknown>)['packageId'] as string | undefined
      }
      if (!packageId && styleSettings && typeof styleSettings === 'object' && !Array.isArray(styleSettings)) {
        packageId = (styleSettings as Record<string, unknown>)['packageId'] as string | undefined
      }
      packageId = packageId || 'headshot1'
      
      const pkg = getPackageConfig(packageId)
      const finalStyleSettings = pkg.persistenceAdapter.deserialize(rawStyleSettings)

      // Merge explicit overrides from the job payload to ensure latest UI choices are honored
      // Particularly important when context saved values were null (user-choice) but the user
      // provided concrete selections (e.g., clothingColors, branding.position) at generation time
      const jobStyleSettings = (styleSettings && typeof styleSettings === 'object' && !Array.isArray(styleSettings))
        ? (styleSettings as Record<string, unknown>)
        : {}
      const fs = finalStyleSettings as Record<string, unknown>
      const jsBranding = jobStyleSettings['branding'] as { type?: string; logoKey?: string; position?: string } | undefined
      const jsClothingColors = jobStyleSettings['clothingColors'] as { colors?: { topCover?: string; topBase?: string; bottom?: string; shoes?: string } } | undefined
      const jsClothing = jobStyleSettings['clothing'] as { style?: string; details?: string; accessories?: string[] } | undefined
      const jsExpression = jobStyleSettings['expression'] as { type?: string } | undefined
      const jsBackground = jobStyleSettings['background'] as { type?: string; key?: string; prompt?: string; color?: string } | undefined

      if (jsClothingColors && Object.keys(jsClothingColors).length > 0) {
        fs['clothingColors'] = jsClothingColors
      }
      if (jsBranding && Object.keys(jsBranding).length > 0) {
        const currentBranding = (fs['branding'] as Record<string, unknown>) || {}
        fs['branding'] = {
          ...currentBranding,
          ...(jsBranding.type ? { type: jsBranding.type } : {}),
          ...(jsBranding.logoKey ? { logoKey: jsBranding.logoKey } : {}),
          ...(jsBranding.position ? { position: jsBranding.position } : {})
        }
      }
      if (jsClothing && Object.keys(jsClothing).length > 0) {
        const currentClothing = (fs['clothing'] as Record<string, unknown>) || {}
        fs['clothing'] = { ...currentClothing, ...jsClothing }
      }
      if (jsExpression && Object.keys(jsExpression).length > 0) {
        const currentExpression = (fs['expression'] as Record<string, unknown>) || {}
        fs['expression'] = { ...currentExpression, ...jsExpression }
      }
      if (jsBackground && Object.keys(jsBackground).length > 0) {
        const currentBackground = (fs['background'] as Record<string, unknown>) || {}
        fs['background'] = { ...currentBackground, ...jsBackground }
      }

      // Prefer explicit shotType from the job payload if provided (and not user-choice)
      // This prevents stale context defaults (e.g., headshot) from overriding a user's current selection (e.g., full-body)
      const jobShotType = (styleSettings as { shotType?: { type?: string } } | undefined)?.shotType?.type
      const jobHasExplicitShotType = jobShotType && jobShotType !== 'user-choice'
      const mergedStyleSettings: PhotoStyleSettings = jobHasExplicitShotType
        ? { ...(finalStyleSettings as PhotoStyleSettings), shotType: { type: jobShotType as 'headshot' | 'midchest' | 'full-body' | 'user-choice' } }
        : (finalStyleSettings as PhotoStyleSettings)
      
      // Debug logging
      Logger.debug('Generation context', { name: generation.context?.name })
      Logger.debug('Raw saved styleSettings', { savedStyleSettings })
      Logger.debug('Raw context settings', { settings: generation.context?.settings })
      Logger.debug('Raw job styleSettings', { styleSettings })
      Logger.debug('Deserialized finalStyleSettings', { finalStyleSettings })
      if (jobHasExplicitShotType) {
        Logger.debug('Overriding shotType from job payload', { jobShotType })
      }
      Logger.debug('Package ID', { packageId })
      Logger.debug('ShotType in finalStyleSettings', { shotType: finalStyleSettings.shotType })
      
      // Package-specific image preprocessing
      let processedSelfieBuffer: Buffer
      try {
        // Dynamically import package-specific preprocessor
        let preprocessor
        try {
          if (packageId === 'headshot1') {
            const headshot1Module = await import('@/domain/style/packages/headshot1/preprocessor')
            preprocessor = headshot1Module.preprocessHeadshot1
          } else if (packageId === 'freepackage') {
            const freepackageModule = await import('@/domain/style/packages/freepackage/preprocessor')
            preprocessor = freepackageModule.preprocessFreepackage
          }
        } catch (importError) {
          Logger.warn('Could not load package preprocessor, using default', { 
            packageId, 
            error: importError instanceof Error ? importError.message : String(importError) 
          })
        }
        
        if (preprocessor) {
          // Download selfie and process with package-specific preprocessor
          const selfieBuffer = await downloadSelfieAsBase64(selfieS3Key).then(res => Buffer.from(res.base64, 'base64'))
          
          // Prepare additional context for multi-step preprocessing
          const backgroundS3Key = (finalStyleSettings as { background?: { key?: string } })?.background?.key
          const logoS3Key = (finalStyleSettings as { branding?: { logoKey?: string } })?.branding?.logoKey
          
          // Progress callback for preprocessing steps
          const onStepProgress = (stepName: string) => {
            const progressMsg = getProgressMessage(stepName)
            const formattedMsg = formatProgressWithAttempt(progressMsg)
            // Update progress with step message (keep progress percentage at 15% during preprocessing)
            job.updateProgress({ progress: 15, message: formattedMsg }).catch(err => {
              Logger.warn('Failed to update progress', { error: err instanceof Error ? err.message : String(err) })
            })
          }
          
          // Call preprocessor - handle both old signature (2 args) and new signature (3 args with context)
          let preprocessResult
          if (preprocessor.length > 2) {
            // New signature with additional context
            preprocessResult = await (preprocessor as (
              selfieBuffer: Buffer,
              styleSettings: PhotoStyleSettings,
              additionalContext?: { backgroundS3Key?: string; logoS3Key?: string; onStepProgress?: (stepName: string) => void }
            ) => Promise<{ processedBuffer: Buffer; metadata?: Record<string, unknown> }>)(
              selfieBuffer,
              finalStyleSettings as unknown as PhotoStyleSettings,
              { backgroundS3Key, logoS3Key, onStepProgress }
            )
          } else {
            // Old signature (backward compatibility)
            preprocessResult = await preprocessor(selfieBuffer, finalStyleSettings as unknown as PhotoStyleSettings)
          }
          
          processedSelfieBuffer = preprocessResult.processedBuffer
          Logger.debug('Applied package-specific preprocessing', { 
            packageId, 
            metadata: preprocessResult.metadata 
          })
        } else {
          // No preprocessor - use original selfie buffer
          const selfieBase64 = await downloadSelfieAsBase64(selfieS3Key)
          processedSelfieBuffer = Buffer.from(selfieBase64.base64, 'base64')
        }
      } catch (preprocessError) {
        Logger.error('Preprocessing failed, using original image', { 
          packageId, 
          error: preprocessError instanceof Error ? preprocessError.message : String(preprocessError) 
        })
        // Fallback to original selfie
        const selfieBase64 = await downloadSelfieAsBase64(selfieS3Key)
        processedSelfieBuffer = Buffer.from(selfieBase64.base64, 'base64')
      }
      
      // Build prompt from style settings using the style package's prompt builder
      const builtPromptRaw = pkg.promptBuilder(mergedStyleSettings as unknown as PhotoStyleSettings, { prompt })
      let builtPrompt: string
      if (typeof builtPromptRaw === 'string') {
        builtPrompt = builtPromptRaw
      } else {
        // If it returns an object, convert to string
        builtPrompt = JSON.stringify(builtPromptRaw)
      }
      
      // Create composite image with labeled sections (using processed selfie if available)
      const compositeImage = await createCompositeImage(mergedStyleSettings as {
        background?: { type?: string; key?: string; prompt?: string; color?: string }
        branding?: { type?: string; logoKey?: string; position?: string }
        clothing?: { style?: string; details?: string; accessories?: string[]; colors?: { topCover?: string; topBase?: string; bottom?: string } }
        expression?: { type?: string }
        lighting?: { type?: string }
      }, selfieS3Key, processedSelfieBuffer)
      
      // Debug code removed for production security
      
      // Update prompt to reference the labeled sections in the composite image
      const shotTypeForText = (mergedStyleSettings?.shotType?.type || '').toString()
      const shotText = shotTypeForText === 'full-body'
        ? 'full-body portrait'
        : shotTypeForText === 'midchest'
          ? 'mid-chest portrait'
          : 'headshot'
      builtPrompt += `\n\nUse the labeled sections in the composite image: "SUBJECT" for the person, "BACKGROUND" for the background, and "LOGO" for the brand logo if present. Generate a professional photo using the subject and the specified style settings. STRICTLY follow \"framing_composition.shot_type\" (requested: ${shotText}) and \"orientation\". Do not change the requested shot type; avoid cropping that contradicts it.`
      
      await job.updateProgress({ progress: 20, message: formatProgressWithAttempt(getProgressMessage()) })

      // Debug: write composite image to /tmp for inspection
      try {
        const compositePath = `/tmp/composite-${generationId}.png`
        await fsWriteFile(compositePath, Buffer.from(compositeImage.base64, 'base64'))
        Logger.debug('Wrote composite image to /tmp', { path: compositePath })
      } catch (e) {
        Logger.warn('Failed to write composite image to /tmp', { error: e instanceof Error ? e.message : String(e) })
      }

      Logger.info('Generated Prompt for Gemini', { prompt: builtPrompt })

      // Determine aspect ratio from shot type (enforce tall canvas for full body)
      const aspectRatio = shotTypeForText === 'full-body' ? '9:16' : shotTypeForText === 'midchest' ? '3:4' : '1:1'
      // Call Gemini image generation API with composite image only
      const imageBuffers = await generateWithGemini(builtPrompt, [compositeImage], aspectRatio)

      await job.updateProgress({ progress: 60, message: formatProgressWithAttempt(getProgressMessage()) })
      if (!imageBuffers.length) {
        throw new Error('AI generation returned no images')
      }

      // Upload generated images to S3
      const generatedImageKeys = await uploadGeneratedImagesToS3(imageBuffers, personId, generationId)
      await job.updateProgress({ progress: 80, message: formatProgressWithAttempt(getProgressMessage()) })
      
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
      
      await job.updateProgress({ progress: 100, message: `✨ All done! Your photo is ready!${attemptSuffix}` })
      
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
      
      Logger.error(`Image generation failed for job ${job.id}`, errorDetails)
      
      // Truncate error message if too long (database field has limit, but we'll keep it reasonable)
      const maxErrorMessageLength = 2000
      const finalErrorMessage = errorMessage.length > maxErrorMessageLength 
        ? errorMessage.substring(0, maxErrorMessageLength) + '...[truncated]'
        : errorMessage
      
      // Send support notification email on failure (only on final attempt to avoid spam)
      const maxAttempts = job.opts?.attempts || 3
      const isFinalAttempt = job.attemptsMade >= maxAttempts - 1
      
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

// Helper functions

// Downloads selfie object from S3 and returns base64 + mime type
async function downloadSelfieAsBase64(s3Key: string): Promise<{ mimeType: string; base64: string }> {
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key })
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 })
    const res = await httpFetch(url)
    if (!res.ok) throw new Error(`Failed to fetch selfie: ${res.status}`)
    const arrayBuf = await res.arrayBuffer()
    const base64 = Buffer.from(arrayBuf).toString('base64')
    // naive mime detection from key; ideally store mime on upload
    const mimeType = s3Key.endsWith('.png') ? 'image/png' : 'image/jpeg'
    return { mimeType, base64 }
  } catch (e) {
    Logger.error('Failed to download selfie as base64', { error: e instanceof Error ? e.message : String(e) })
    throw new Error('Failed to access selfie image')
  }
}

// Generic S3 download helper for additional assets (backgrounds, logos)
async function downloadAssetAsBase64(s3Key: string): Promise<{ mimeType: string; base64: string } | null> {
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key })
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 })
    const res = await httpFetch(url)
    if (!res.ok) return null
    const arrayBuf = await res.arrayBuffer()
    const base64 = Buffer.from(arrayBuf).toString('base64')
    const mimeType = s3Key.endsWith('.png') ? 'image/png' : 'image/jpeg'
    return { mimeType, base64 }
  } catch {
    return null
  }
}

// Create composite image with labeled sections
async function createCompositeImage(
  styleSettings: {
    background?: { type?: string; key?: string; prompt?: string; color?: string }
    branding?: { type?: string; logoKey?: string; position?: string }
    clothing?: { style?: string; details?: string; accessories?: string[]; colors?: { topCover?: string; topBase?: string; bottom?: string } }
    expression?: { type?: string }
    lighting?: { type?: string }
  },
  selfieS3Key: string,
  preprocessedSelfieBuffer?: Buffer
): Promise<{ mimeType: string; base64: string }> {
  Logger.debug('Creating composite image for selfie', { selfieS3Key, hasPreprocessed: !!preprocessedSelfieBuffer })
  
  // Use preprocessed buffer if provided, otherwise download from S3
  let selfieBuffer: Buffer
  if (preprocessedSelfieBuffer) {
    selfieBuffer = preprocessedSelfieBuffer
    Logger.debug('Using preprocessed selfie buffer', { bytes: selfieBuffer.length })
  } else {
    const selfie = await downloadSelfieAsBase64(selfieS3Key)
    Logger.debug('Selfie downloaded', { sizeChars: selfie.base64.length })
    selfieBuffer = Buffer.from(selfie.base64, 'base64')
  }
  
  // Simple vertical stacking approach with more spacing
  const margin = 20
  const labelHeight = 50
  const spacing = 100  // Increased spacing between images
  
  // Prepare all composite elements
  const compositeElements: Array<Record<string, unknown>> = []
  let currentY = margin
  let maxWidth = 0
  
  // Load selfie and get original dimensions
  Logger.debug('Selfie buffer size', { bytes: selfieBuffer.length })
  
  const selfieSharp = sharp(selfieBuffer)
  const selfieMetadata = await selfieSharp.metadata()
  Logger.debug('Selfie original dimensions', { width: selfieMetadata.width, height: selfieMetadata.height })
  
  // Use selfie buffer (either preprocessed or original)
  const selfieProcessed = selfieBuffer
  Logger.debug('Using selfie buffer size', { bytes: selfieProcessed.length, preprocessed: !!preprocessedSelfieBuffer })
  
  // Add selfie at top
  const subjectText = await createTextOverlay('SUBJECT', 24, '#000000')
  compositeElements.push(
    { input: selfieProcessed, left: margin, top: currentY },
    { input: subjectText, left: margin, top: currentY + (selfieMetadata.height || 0) + 10 }
  )
  currentY += (selfieMetadata.height || 0) + labelHeight + spacing
  maxWidth = Math.max(maxWidth, (selfieMetadata.width || 0) + margin * 2)
  Logger.debug('Added SUBJECT position', { y: currentY - (selfieMetadata.height || 0) - labelHeight - spacing })
  
  // Add background section if custom
  if (styleSettings?.background?.type === 'custom' && styleSettings?.background?.key) {
    Logger.debug('Adding custom background section')
    const bg = await downloadAssetAsBase64(styleSettings.background.key)
    if (bg) {
      const bgBuffer = Buffer.from(bg.base64, 'base64')
      const bgSharp = sharp(bgBuffer)
      const bgMetadata = await bgSharp.metadata()
      Logger.debug('Background original dimensions', { width: bgMetadata.width, height: bgMetadata.height })
      
      const bgText = await createTextOverlay('BACKGROUND', 24, '#000000')
      
      compositeElements.push(
        { input: await bgSharp.png().toBuffer(), left: margin, top: currentY },
        { input: bgText, left: margin, top: currentY + (bgMetadata.height || 0) + 10 }
      )
      currentY += (bgMetadata.height || 0) + labelHeight + spacing
      maxWidth = Math.max(maxWidth, (bgMetadata.width || 0) + margin * 2)
      Logger.debug('Added BACKGROUND position', { y: currentY - (bgMetadata.height || 0) - labelHeight - spacing })
    }
  }
  
  // Add logo section if included
  if (styleSettings?.branding?.type === 'include' && styleSettings?.branding?.logoKey) {
    Logger.debug('Adding logo section')
    const logo = await downloadAssetAsBase64(styleSettings.branding.logoKey)
    if (logo) {
      const logoBuffer = Buffer.from(logo.base64, 'base64')
      const logoSharp = sharp(logoBuffer)
      const logoMetadata = await logoSharp.metadata()
      Logger.debug('Logo original dimensions', { width: logoMetadata.width, height: logoMetadata.height })
      
      const logoText = await createTextOverlay('LOGO', 24, '#000000')
      
      compositeElements.push(
        { input: await logoSharp.png().toBuffer(), left: margin, top: currentY },
        { input: logoText, left: margin, top: currentY + (logoMetadata.height || 0) + 10 }
      )
      currentY += (logoMetadata.height || 0) + labelHeight + spacing
      maxWidth = Math.max(maxWidth, (logoMetadata.width || 0) + margin * 2)
      Logger.debug('Added LOGO position', { y: currentY - (logoMetadata.height || 0) - labelHeight - spacing })
    }
  }
  
  // Calculate final canvas size
  const compositeWidth = maxWidth
  const compositeHeight = currentY + margin
  
  Logger.debug('Calculated canvas size', { width: compositeWidth, height: compositeHeight })
  Logger.debug('Creating composite', { elements: compositeElements.length })
  
  const composite = sharp({
    create: {
      width: compositeWidth,
      height: compositeHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  }).png().composite(compositeElements)
  
  // Generate final composite
  const compositeBuffer = await composite.toBuffer()
  const compositeBase64 = compositeBuffer.toString('base64')
  
  Logger.debug('Composite image created', { sizeChars: compositeBase64.length })
  Logger.debug('Composite buffer size', { bytes: compositeBuffer.length })
  
  return {
    mimeType: 'image/png',
    base64: compositeBase64
  }
}

// Helper function to create text overlay using Sharp
async function createTextOverlay(text: string, fontSize: number, color: string): Promise<Buffer> {
  // Create a simple text overlay using SVG
  const svg = `
    <svg width="200" height="40" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="40" fill="rgba(255,255,255,0.8)" stroke="${color}" stroke-width="2" rx="5"/>
      <text x="100" y="25" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${color}" text-anchor="middle" dominant-baseline="middle">${text}</text>
    </svg>
  `
  
  return await sharp(Buffer.from(svg))
    .png()
    .toBuffer()
}

// moved to '@/lib/ai/promptBuilder'

async function generateWithGemini(
  prompt: string,
  images: Array<{ mimeType: string; base64: string }>,
  aspectRatio?: string
): Promise<Buffer[]> {
  void aspectRatio
  let projectId = Env.string('GOOGLE_PROJECT_ID', '')
  const location = Env.string('GOOGLE_LOCATION', 'us-central1') // Default to US for reliability

  // If project ID not explicitly set, try to extract it from service account JSON
  if (!projectId) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (credentialsPath) {
      try {
        const credentialsContent = await fsReadFile(credentialsPath, 'utf-8')
        const credentials = JSON.parse(credentialsContent) as { project_id?: string }
        if (credentials.project_id) {
          projectId = credentials.project_id
          Logger.debug('Extracted project ID from service account credentials', { projectId, credentialsPath })
        }
      } catch (error) {
        Logger.warn('Failed to read project ID from service account credentials', { 
          credentialsPath, 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    }
  }

  if (!projectId) {
    throw new Error('GOOGLE_PROJECT_ID is not set in environment and could not be extracted from GOOGLE_APPLICATION_CREDENTIALS. Please set GOOGLE_PROJECT_ID in your .env file or deployment environment variables.')
  }

  const vertexAI = new VertexAI({ project: projectId, location });

  const model = vertexAI.getGenerativeModel({
    model: Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash'),
  });

  // Prepare contents with explicit types
  const contents: Content[] = [{
    role: 'user',
    parts: [
      { text: prompt },
      ...images.map((img): Part => ({
        inlineData: { mimeType: img.mimeType, data: img.base64 }
      }))
    ]
  }];

  // Generate without generationConfig if no params
  const response: GenerateContentResult = await model.generateContent({ contents });

  // Access candidates safely
  const parts = response.response.candidates?.[0]?.content?.parts ?? [];
  const out: Buffer[] = [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      out.push(Buffer.from(part.inlineData.data, 'base64'));
    }
  }
  return out;
}

async function uploadGeneratedImagesToS3(images: Buffer[], personId: string, generationId: string): Promise<string[]> {
  const uploadedKeys: string[] = []
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    const key = `generations/${personId}/${generationId}/variation-${i + 1}.png`
    
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: image,
        ContentType: 'image/png',
      }))
      uploadedKeys.push(key)
    } catch (error) {
      Logger.error('Failed to upload image', { index: i + 1, error: error instanceof Error ? error.message : String(error) })
      throw new Error(`Failed to upload generated image ${i + 1}`)
    }
  }
  
  return uploadedKeys
}

export default imageGenerationWorker

