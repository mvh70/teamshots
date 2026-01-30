/**
 * Generate hero images for vertical landing pages
 *
 * This script generates before/after hero images for each industry vertical:
 * 1. Generate synthetic "before" selfie using Gemini 3 Pro Image
 * 2. Upload to S3 and create database records
 * 3. Trigger V3 generation with industry-headshot package
 * 4. Save both images to public/images/solutions/
 *
 * Usage: npx tsx scripts/generate-vertical-images.ts [industry]
 *
 * Examples:
 *   npx tsx scripts/generate-vertical-images.ts           # Generate all
 *   npx tsx scripts/generate-vertical-images.ts law-firms # Generate one
 */

// Load environment variables FIRST (before any other imports)
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
config({ path: path.resolve(__dirname, '../.env') })

// Now dynamically import modules that depend on env vars
async function run() {
  const { prisma } = await import('../src/lib/prisma')
  const { getS3BucketName, createS3Client, getS3Key } = await import('../src/lib/s3-client')
  const { GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const { imageGenerationQueue } = await import('../src/queue')
  const industryStyles = await import('../src/domain/style/elements/industry/industry-styles')
  const AVAILABLE_INDUSTRIES = industryStyles.AVAILABLE_INDUSTRIES
  type IndustryType = typeof AVAILABLE_INDUSTRIES[number]
  const fs = await import('fs/promises')

  // Gender assignments for each vertical (alternating)
  const VERTICAL_GENDERS: Record<IndustryType, 'male' | 'female'> = {
    'law-firms': 'female',
    medical: 'male',
    'real-estate': 'female',
    'financial-services': 'male',
    'actively-hiring': 'female',
    consulting: 'male',
    accounting: 'female',
  }

  // Output directory for hero images
  const OUTPUT_DIR = path.join(process.cwd(), 'public/images/solutions')
  const BACKUP_DIR = path.join(process.cwd(), 'backup_images/solutions')

  /**
   * Upload a buffer to S3
   */
  async function uploadToS3(
    s3Client: ReturnType<typeof createS3Client>,
    bucketName: string,
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    const fullKey = getS3Key(key)
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fullKey,
        Body: buffer,
        ContentType: contentType,
      })
    )
  }

  /**
   * Download a buffer from S3
   */
  async function downloadFromS3(
    s3Client: ReturnType<typeof createS3Client>,
    bucketName: string,
    key: string
  ): Promise<Buffer> {
    const fullKey = getS3Key(key)
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: fullKey,
      })
    )
    const byteArray = await response.Body?.transformToByteArray()
    if (!byteArray) {
      throw new Error(`Failed to download ${key} from S3`)
    }
    return Buffer.from(byteArray)
  }

  /**
   * Generate synthetic selfie using Gemini 3 Pro Image
   */
  async function generateSyntheticSelfie(industry: IndustryType, gender: string): Promise<Buffer> {
    // Support both GOOGLE_CLOUD_API_KEY and GEMINI_API_KEY (same as rest of codebase)
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_CLOUD_API_KEY or GEMINI_API_KEY not configured')
    }

    const prompt = `Create a casual smartphone selfie photo of a ${gender} professional in their 30s-40s.

CRITICAL REQUIREMENTS:
- Natural, authentic appearance with realistic skin texture, visible pores, subtle imperfections
- ${gender === 'female' ? 'Woman' : 'Man'} with a relaxed, friendly expression
- Wearing casual everyday clothes (t-shirt or casual button-down, NOT professional attire)
- At home or casual setting (living room, kitchen, or natural outdoor setting)
- Natural window lighting or soft ambient light
- iPhone selfie quality with slight wide-angle lens distortion
- Looking directly at camera with genuine, relaxed expression
- NOT a professional studio photo - this should look like a real casual selfie

This is a "before" photo that will be transformed into a professional headshot. Make it look authentic and casual, like something someone would actually take with their phone.`

    console.log(`[${industry}] Generating synthetic selfie for ${gender}...`)

    const model = 'gemini-3-pro-image-preview'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['Text', 'Image'],
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const parts = data.candidates?.[0]?.content?.parts || []

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        const base64Data = part.inlineData.data
        return Buffer.from(base64Data, 'base64')
      }
    }

    throw new Error('No image in Gemini response')
  }

  /**
   * Upload selfie to S3 and create database records
   */
  async function createSelfieRecord(
    industry: IndustryType,
    selfieBuffer: Buffer
  ): Promise<{ personId: string; selfieKey: string }> {
    const s3Key = `hero-selfies/${industry}-selfie.webp`

    console.log(`[${industry}] Uploading selfie to S3...`)

    // Upload to S3
    const s3Client = createS3Client({ forcePathStyle: false })
    const bucketName = getS3BucketName()
    await uploadToS3(s3Client, bucketName, s3Key, selfieBuffer, 'image/webp')

    // Create Person record (no User linked - simulates invited person)
    const person = await prisma.person.create({
      data: {
        firstName: `Hero-${industry}`,
      },
    })

    // Create Selfie record
    await prisma.selfie.create({
      data: {
        personId: person.id,
        key: s3Key,
        validated: true,
        fitnessApproved: true,
        selfieType: 'front_view',
        selfieTypeConfidence: 1.0,
        personCount: 1,
        isProper: true,
      },
    })

    console.log(`[${industry}] Created Person ${person.id} with selfie`)

    return { personId: person.id, selfieKey: s3Key }
  }

  /**
   * Trigger V3 generation and wait for completion
   */
  async function triggerGeneration(
    personId: string,
    selfieKey: string,
    industry: IndustryType
  ): Promise<string[]> {
    console.log(`[${industry}] Creating generation record...`)

    // Create Generation record
    const generation = await prisma.generation.create({
      data: {
        personId,
        status: 'processing',
        provider: 'gemini',
        creditsUsed: 0, // Hero images are free
        styleSettings: {
          packageId: 'industry-headshot',
          industry,
        },
      },
    })

    console.log(`[${industry}] Enqueueing generation job ${generation.id}...`)

    // Enqueue job
    await imageGenerationQueue.add('generate', {
      generationId: generation.id,
      personId,
      selfieS3Keys: [selfieKey],
      prompt: JSON.stringify({}),
      creditSource: 'individual',
      styleSettings: {
        packageId: 'industry-headshot',
        industry,
      },
    })

    // Wait for completion
    console.log(`[${industry}] Waiting for generation to complete...`)
    const result = await waitForGeneration(generation.id, industry)

    return result
  }

  /**
   * Wait for generation to complete
   */
  async function waitForGeneration(generationId: string, industry: IndustryType): Promise<string[]> {
    const maxWaitMs = 5 * 60 * 1000 // 5 minutes
    const pollIntervalMs = 5000 // 5 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
      })

      if (!generation) {
        throw new Error(`Generation ${generationId} not found`)
      }

      if (generation.status === 'completed') {
        console.log(`[${industry}] Generation completed!`)
        return generation.generatedPhotoKeys
      }

      if (generation.status === 'failed') {
        throw new Error(`Generation failed: ${generationId}`)
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    throw new Error(`Generation timed out after ${maxWaitMs}ms`)
  }

  /**
   * Backup existing images before overwriting
   */
  async function backupExistingImages(industry: IndustryType): Promise<void> {
    const beforePath = path.join(OUTPUT_DIR, `${industry}-before.webp`)
    const afterPath = path.join(OUTPUT_DIR, `${industry}-after.webp`)

    // Check if any images exist
    const beforeExists = await fs.access(beforePath).then(() => true).catch(() => false)
    const afterExists = await fs.access(afterPath).then(() => true).catch(() => false)

    if (!beforeExists && !afterExists) {
      return // Nothing to backup
    }

    // Create backup directory
    await fs.mkdir(BACKUP_DIR, { recursive: true })

    // Generate timestamp for unique backup folder
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupSubdir = path.join(BACKUP_DIR, `${industry}-${timestamp}`)
    await fs.mkdir(backupSubdir, { recursive: true })

    // Move existing images to backup
    if (beforeExists) {
      const backupBeforePath = path.join(backupSubdir, `${industry}-before.webp`)
      await fs.rename(beforePath, backupBeforePath)
      console.log(`[${industry}] Backed up: ${backupBeforePath}`)
    }

    if (afterExists) {
      const backupAfterPath = path.join(backupSubdir, `${industry}-after.webp`)
      await fs.rename(afterPath, backupAfterPath)
      console.log(`[${industry}] Backed up: ${backupAfterPath}`)
    }
  }

  /**
   * Save hero images to public directory
   */
  async function saveHeroImages(
    industry: IndustryType,
    beforeBuffer: Buffer,
    afterS3Keys: string[]
  ): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true })

    // Backup existing images before overwriting
    await backupExistingImages(industry)

    // Save before image
    const beforePath = path.join(OUTPUT_DIR, `${industry}-before.webp`)
    await fs.writeFile(beforePath, beforeBuffer)
    console.log(`[${industry}] Saved: ${beforePath}`)

    // Download and save after image
    if (afterS3Keys.length > 0) {
      const s3Client = createS3Client({ forcePathStyle: false })
      const bucketName = getS3BucketName()
      const afterBuffer = await downloadFromS3(s3Client, bucketName, afterS3Keys[0])

      const afterPath = path.join(OUTPUT_DIR, `${industry}-after.webp`)
      await fs.writeFile(afterPath, afterBuffer)
      console.log(`[${industry}] Saved: ${afterPath}`)
    }
  }

  /**
   * Generate hero images for a single industry
   */
  async function generateForIndustry(industry: IndustryType): Promise<void> {
    const gender = VERTICAL_GENDERS[industry]
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Generating hero images for: ${industry} (${gender})`)
    console.log(`${'='.repeat(60)}`)

    try {
      // Step 1: Generate synthetic selfie
      const selfieBuffer = await generateSyntheticSelfie(industry, gender)
      console.log(`[${industry}] Selfie generated (${selfieBuffer.length} bytes)`)

      // Step 2: Upload and create records
      const { personId, selfieKey } = await createSelfieRecord(industry, selfieBuffer)

      // Step 3: Trigger generation
      const afterS3Keys = await triggerGeneration(personId, selfieKey, industry)

      // Step 4: Save images
      await saveHeroImages(industry, selfieBuffer, afterS3Keys)

      console.log(`[${industry}] Hero images generated successfully!`)
    } catch (error) {
      console.error(`[${industry}] Failed:`, error)
      throw error
    }
  }

  // Main logic
  const targetIndustry = process.argv[2] as IndustryType | undefined

  console.log('\n Vertical Hero Image Generator')
  console.log('================================\n')

  if (targetIndustry) {
    if (!AVAILABLE_INDUSTRIES.includes(targetIndustry)) {
      console.error(`Invalid industry: ${targetIndustry}`)
      console.error(`Available: ${AVAILABLE_INDUSTRIES.join(', ')}`)
      process.exit(1)
    }
    await generateForIndustry(targetIndustry)
  } else {
    console.log(`Generating hero images for ${AVAILABLE_INDUSTRIES.length} industries...\n`)

    for (const industry of AVAILABLE_INDUSTRIES) {
      try {
        await generateForIndustry(industry)
      } catch (error) {
        console.error(`Failed to generate for ${industry}, continuing...`)
      }
    }
  }

  console.log('\n All done!')
  await prisma.$disconnect()
}

// Run the script
run().catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
