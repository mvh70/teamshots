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
import { PRICING_CONFIG } from '@/config/pricing'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Telemetry } from '@/lib/telemetry'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import sharp from 'sharp'
import { httpFetch } from '@/lib/http'
import { Env } from '@/lib/env'
// Gemini SDK per docs: https://ai.google.dev/gemini-api/docs/image-generation#javascript_8
// Ensure dependency '@google/genai' is installed in package.json
// Fallback: type-only import to avoid runtime errors until installed
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GoogleGenAI } from '@google/genai'
import { buildStructuredPromptFromStyle } from '@/lib/ai/promptBuilder'
// Background removal processing disabled
// import { processSelfieForBackgroundRemoval, getBestSelfieKey } from '@/lib/ai/selfieProcessor'

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
    const { generationId, personId, userId, selfieS3Key, styleSettings, prompt } = job.data
    
    try {
      Logger.info(`Starting image generation for job ${job.id}, generation ${generationId}`)
      
      // Update generation status to processing
      await prisma.generation.update({
        where: { id: generationId },
        data: { 
          status: 'processing',
          updatedAt: new Date()
        }
      })
      
      await job.updateProgress(10)
      
      // Check if selfie needs processing and get the best available version
      const bestSelfieKey = selfieS3Key
      
      // Background removal processing disabled - using original selfie
      Logger.debug('Using original selfie without background removal processing')
      
      // Fetch the generation record to get the context
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        include: { context: true }
      })
      
      if (!generation) {
        throw new Error('Generation not found')
      }
      
      // Use context settings if available, otherwise fall back to job styleSettings
      const contextSettings = generation.context?.settings
      const finalStyleSettings =
        (typeof contextSettings === 'object' &&
          contextSettings !== null &&
          !Array.isArray(contextSettings))
          ? contextSettings
          : styleSettings || {}
      
      // Debug logging
      Logger.debug('Generation context', { name: generation.context?.name })
      Logger.debug('Context settings', { settings: generation.context?.settings })
      Logger.debug('Job styleSettings', { styleSettings })
      Logger.debug('Final styleSettings', { finalStyleSettings })
      
      // Build prompt from style settings (structured only)
      let builtPrompt = buildStructuredPromptFromStyle(finalStyleSettings as Record<string, unknown>, prompt)

      // Create composite image with labeled sections
      const compositeImage = await createCompositeImage(finalStyleSettings as {
        background?: { type?: string; key?: string; prompt?: string; color?: string }
        branding?: { type?: string; logoKey?: string; position?: string }
        clothing?: { style?: string; details?: string; accessories?: string[]; colors?: { topCover?: string; topBase?: string; bottom?: string } }
        expression?: { type?: string }
        lighting?: { type?: string }
      }, bestSelfieKey)
      
      // Debug code removed for production security
      
      // Update prompt to reference the labeled sections in the composite image
      builtPrompt += `\n\nUse the labeled sections in the composite image: "SUBJECT" for the person, "BACKGROUND" for the background, and "LOGO" for the brand logo if present. Generate a professional headshot using the subject and applying the specified style settings.`
      await job.updateProgress(20)

      // Log the generated prompt for debugging
      Logger.debug('Generated Prompt for Gemini', { prompt: builtPrompt })

      // Call Gemini image generation API with composite image only
      const imageBuffers = await generateWithGemini(builtPrompt, [compositeImage])

      await job.updateProgress(60)
      if (!imageBuffers.length) {
        throw new Error('AI generation returned no images')
      }

      // Upload generated images to S3
      const generatedImageKeys = await uploadGeneratedImagesToS3(imageBuffers, personId, generationId)
      await job.updateProgress(80)
      
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
      
      await job.updateProgress(100)
      
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
      Logger.error(`Image generation failed for job ${job.id}`, { error: error instanceof Error ? error.message : String(error) })
      
      // Update generation status to failed
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date()
        }
      })
      
      // Refund credits
      try {
        await refundCreditsForFailedGeneration(
          personId,
          userId || null,
          PRICING_CONFIG.credits.perGeneration, // Credits per generation from config
          `Refund for failed generation ${generationId}`
        )
        Logger.info(`Credits refunded for failed generation ${generationId}`)
      } catch (refundError) {
        Logger.error(`Failed to refund credits for generation ${generationId}`, { error: refundError instanceof Error ? refundError.message : String(refundError) })
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
async function createCompositeImage(styleSettings: {
  background?: { type?: string; key?: string; prompt?: string; color?: string }
  branding?: { type?: string; logoKey?: string; position?: string }
  clothing?: { style?: string; details?: string; accessories?: string[]; colors?: { topCover?: string; topBase?: string; bottom?: string } }
  expression?: { type?: string }
  lighting?: { type?: string }
}, selfieS3Key: string): Promise<{ mimeType: string; base64: string }> {
  Logger.debug('Creating composite image for selfie', { selfieS3Key })
  const selfie = await downloadSelfieAsBase64(selfieS3Key)
  Logger.debug('Selfie downloaded', { sizeChars: selfie.base64.length })
  
  // Simple vertical stacking approach with more spacing
  const margin = 20
  const labelHeight = 50
  const spacing = 100  // Increased spacing between images
  
  // Prepare all composite elements
  const compositeElements: Array<Record<string, unknown>> = []
  let currentY = margin
  let maxWidth = 0
  
  // Load selfie and get original dimensions
  const selfieBuffer = Buffer.from(selfie.base64, 'base64')
  Logger.debug('Selfie buffer size', { bytes: selfieBuffer.length })
  
  const selfieSharp = sharp(selfieBuffer)
  const selfieMetadata = await selfieSharp.metadata()
  Logger.debug('Selfie original dimensions', { width: selfieMetadata.width, height: selfieMetadata.height })
  
  // Use original selfie buffer without additional processing to preserve quality
  const selfieProcessed = selfieBuffer
  Logger.debug('Using original selfie buffer size', { bytes: selfieProcessed.length })
  
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
  images: Array<{ mimeType: string; base64: string }>
): Promise<Buffer[]> {
  const ai = new GoogleGenAI({})
  const contents: Array<Record<string, unknown>> = [{ text: prompt }]
  for (const img of images) {
    contents.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } })
  }
  const response = await ai.models.generateContent({
    model: Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'),
    contents,
    // Optional aspect ratio via config
    // config: { imageConfig: { aspectRatio: providerOptions?.aspectRatio || '1:1' } }
  })

  const parts = (response as unknown as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> })?.candidates?.[0]?.content?.parts ?? []
  const out: Buffer[] = []
  for (const part of parts) {
    if (part?.inlineData?.data) {
      out.push(Buffer.from(part.inlineData.data, 'base64'))
    }
  }
  return out
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

