/**
 * Generate a custom image using selfies from a specific user
 * This script bypasses the package system and feeds a raw JSON prompt directly to the workflow.
 *
 * Usage: npx tsx scripts/generate-custom-image.ts
 */

import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
config({ path: path.resolve(__dirname, '../.env') })

async function run() {
  const { prisma } = await import('../src/lib/prisma')
  const { createS3Client, getS3BucketName } = await import('../src/lib/s3-client')
  const { prepareSelfies } = await import('../src/queue/workers/generate-image/s3-utils')
  const { buildSelfieComposite } = await import('../src/lib/generation/reference-utils')
  const { executeV3Workflow } = await import('../src/queue/workers/generate-image/workflow-v3')
  const sharp = (await import('sharp')).default
  const fs = await import('fs/promises')

  // Target user ID
  const userId = 'cmiwy062a0001dqj7y0jyljtl'

  // Custom prompt - structured for the V3 workflow
  // The person's identity comes from the selfies, not the prompt
  // NOTE: wardrobe must be at root level (not inside subject) for evaluator to find accessories
  const customPrompt = {
    subject: {
      pose: {
        body_angle: "Mid-air jump, body angled diagonally",
        arms: "Arms spread wide for balance and expression of freedom",
        head_position: "Head tilted back slightly",
        legs: "Knees tucked up, capturing weightlessness"
      },
      expression: "Ecstatic joy, mouth wide open in a shout of joy, eyes squeezed shut in happiness"
    },
    // Wardrobe at root level so evaluator can find accessories
    wardrobe: {
      style: "streetwear",
      top_layer: "Mustard yellow corduroy jacket with visible ribbed texture, worn open, billowing slightly from movement",
      base_layer: "Black graphic t-shirt with a stylized circular 'eye' or 'lens' logo in white and green",
      bottom: "Light-wash blue denim jeans, slim fit, showing slight creasing at the knees",
      shoes: "Classic black canvas high-top sneakers with white laces and white rubber soles",
      // Accessories here are AUTHORIZED - evaluator checks wardrobe.accessories
      accessories: ["Black baseball cap worn forward", "Thick-framed yellow-tinted retro sunglasses"]
    },
    scene: {
      environment: {
        location_type: "Minimalist two-tone urban wall",
        left_section: "Bright lemon yellow painted wall with subtle stucco-like texture (vertical strip)",
        right_section: "Deep coral-red to crimson painted wall, rough matte masonry texture with visible scuffs"
      }
    },
    framing: {
      shot_type: "full-body",
      composition: "Low-angle shot looking up to enhance jump height, off-center composition",
      camera_angle: "Dynamic mid-air capture"
    },
    camera: {
      lens: "35mm wide-angle lens to capture the scale of the jump",
      aperture: "f/5.6 for deep depth of field",
      shutter_speed: "1/2000 sec to freeze fast motion without blur"
    },
    lighting: {
      source: "Bright direct natural daylight, high-sun position",
      shadows: "Soft but distinct shadows beneath subject onto the red wall, emphasizing distance from ground"
    },
    rendering: {
      style: "Technicolor-inspired high saturation, high contrast to make colors pop",
      tones: "Warm and vibrant with color-block pop-art influence",
      vibe: "Energetic, urban, optimistic, high-fashion streetwear aesthetic"
    }
  }

  console.log('Looking up person for user:', userId)

  // Find person for user
  const person = await prisma.person.findUnique({
    where: { userId },
    select: { id: true, firstName: true, userId: true, teamId: true }
  })

  if (!person) {
    console.error('Person not found for user:', userId)
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log('Found person:', person)

  // Find selfies for this person
  const selfies = await prisma.selfie.findMany({
    where: { personId: person.id },
    select: { id: true, key: true, selected: true, classification: true },
    orderBy: { createdAt: 'desc' }
  })

  console.log('Found selfies:', selfies.length)

  if (selfies.length === 0) {
    console.error('No selfies found for person')
    await prisma.$disconnect()
    process.exit(1)
  }

  // Get selected selfies, or all if none selected
  const selectedSelfies = selfies.filter(s => s.selected)
  const selfiesToUse = selectedSelfies.length > 0 ? selectedSelfies : selfies.slice(0, 4)
  const selfieKeys = selfiesToUse.map(s => s.key)

  console.log('\nSelfies to use:')
  for (const key of selfieKeys) {
    console.log(`  - ${key}`)
  }

  // Create generation record
  console.log('\nCreating generation record...')
  const generation = await prisma.generation.create({
    data: {
      personId: person.id,
      status: 'processing',
      provider: 'gemini',
      creditsUsed: 0,
      creditSource: 'individual',
      styleSettings: {
        packageId: 'freepackage',
        rawPrompt: true, // Flag to indicate raw prompt mode
      },
      maxRegenerations: 0,
      remainingRegenerations: 0,
    },
  })

  console.log('Created generation:', generation.id)

  // Prepare selfies
  console.log('\nPreparing selfies...')
  const s3Client = createS3Client({ forcePathStyle: false })
  const bucketName = getS3BucketName()

  const { selfieReferences, processedSelfies } = await prepareSelfies({
    bucketName,
    s3Client,
    selfieKeys
  })

  console.log(`Prepared ${selfieReferences.length} selfie references`)

  // Build selfie composite
  console.log('\nBuilding selfie composite...')
  const getSelfieBuffer = async (key: string): Promise<Buffer> => {
    const buffer = processedSelfies[key]
    if (!buffer) {
      throw new Error(`Selfie buffer not found for key: ${key}`)
    }
    return buffer
  }

  const selfieComposite = await buildSelfieComposite({
    keys: selfieKeys,
    getSelfieBuffer,
    generationId: generation.id,
    title: 'SELFIE REFERENCE',
    labelPrefix: 'SELFIE',
    description: 'Composite of selfie reference images showing the person to generate'
  })

  console.log('Built selfie composite')

  // Create mock job for the workflow
  const mockJob = {
    id: `manual-${Date.now()}`,
    data: {
      generationId: generation.id,
      personId: person.id,
      userId: person.userId,
      teamId: person.teamId,
      selfieS3Keys: selfieKeys,
      prompt: JSON.stringify(customPrompt),
      creditSource: 'individual' as const,
    },
    attemptsMade: 0,
    opts: { attempts: 1 },
    updateProgress: async (data: unknown) => {
      console.log('Progress:', data)
    }
  }

  // Create output directory
  const outputDir = path.join(process.cwd(), 'generated-images')
  await fs.mkdir(outputDir, { recursive: true })

  // Execute workflow
  console.log('\nExecuting V3 workflow...')
  console.log('Prompt JSON:')
  console.log(JSON.stringify(customPrompt, null, 2))

  try {
    const result = await executeV3Workflow({
      job: mockJob as any,
      generationId: generation.id,
      personId: person.id,
      userId: person.userId || undefined,
      teamId: person.teamId || undefined,
      selfieReferences: selfieReferences.map((ref, index) => ({
        label: ref.label || `SELFIE${index + 1}`,
        base64: ref.base64,
        mimeType: ref.mimeType
      })),
      selfieComposite,
      styleSettings: {} as any, // Empty - we're using raw prompt
      prompt: JSON.stringify(customPrompt), // Our custom prompt!
      mustFollowRules: [
        'Generate the person using the selfie references as identity source',
        'Preserve all facial features exactly as shown in selfies',
        'Follow the pose, expression, and clothing specifications from the prompt JSON',
        'Create the scene environment as specified in the prompt JSON'
      ],
      freedomRules: [
        'Optimize lighting and micro-details for realistic 3D volume and texture',
        'Adjust subtle color grading to enhance the aesthetic while maintaining specifications'
      ],
      aspectRatio: '3:4',
      downloadAsset: async (key: string) => {
        const { downloadAssetAsBase64 } = await import('../src/queue/workers/generate-image/s3-utils')
        return downloadAssetAsBase64({ bucketName, s3Client, key })
      },
      currentAttempt: 1,
      maxAttempts: 1,
      debugMode: true,
      persistWorkflowState: async () => {},
      intermediateStorage: {
        saveBuffer: async (buffer: Buffer, meta: { fileName: string; description?: string; mimeType?: string }) => {
          const filePath = path.join(outputDir, meta.fileName)
          await fs.writeFile(filePath, buffer)
          console.log(`Saved intermediate: ${filePath}`)
          return { key: filePath, mimeType: meta.mimeType || 'image/png', description: meta.description }
        },
        loadBuffer: async (reference: { key: string }) => {
          return fs.readFile(reference.key)
        }
      }
    })

    console.log('\n========================================')
    console.log('Generation completed!')
    console.log('========================================')
    console.log(`Generated ${result.approvedImageBuffers.length} images`)

    // Save final images
    for (let i = 0; i < result.approvedImageBuffers.length; i++) {
      const outputPath = path.join(outputDir, `custom-generation-${generation.id}-${i}.png`)
      await fs.writeFile(outputPath, result.approvedImageBuffers[i])
      console.log(`Saved: ${outputPath}`)
    }

    // Update generation status
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: 'completed',
        generatedPhotoKeys: result.approvedImageBuffers.map((_, i) =>
          `generated-images/custom-generation-${generation.id}-${i}.png`
        )
      }
    })

  } catch (error) {
    console.error('\nGeneration failed:', error)

    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    })
  }

  await prisma.$disconnect()
}

run().catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
