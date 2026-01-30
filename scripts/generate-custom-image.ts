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
    scene: {
      environment: {
        description: "Chaotic and euphoric Holi Festival atmosphere. The air is thick with exploding clouds of vibrant colored powder (Gulal). The background is a swirling abstraction of neon pink, marigold orange, and cyan smoke, creating a dreamlike, hyper-saturated canvas.",
        location_type: "outdoor_festival_daylight"
      }
    },
    camera: {
      lens: {
        focal_length_mm: 85,
        character: "sharp portrait lens with creamy bokeh"
      },
      settings: {
        aperture: "f/1.8",
        iso: 200,
        shutter_speed: "1/1000s"
      },
      positioning: {
        distance_from_subject_ft: 4,
        subject_to_background_ft: 15,
        height: "slightly below eye level, tilting up"
      },
      color: {
        white_balance_kelvin: 5600,
        grading_notes: "Hyper-saturated, high contrast, 'Candy' color palette"
      }
    },
    lighting: {
      quality: "Bright, High-Key",
      direction: "Global illumination with strong backlighting",
      setup: [
        "Sunlight Key (High overhead)",
        "Strong Backlight/Rim Light (illuminating the airborne dust particles)",
        "Reflected Color Fill (The colored powder acts as a diffuser, casting colored light onto the skin)"
      ],
      color_temperature: "Daylight balanced",
      description: "Vibrant outdoor lighting. The sun backlights the hair and smoke clouds, creating a halo effect. Shadows are filled with cool ambient blue tones.",
      note: "Focus on the interaction between light and particulate matter (dust)."
    },
    rendering: {
      quality_tier: "standard_v1",
      safety_mode: "strict",
      style_mode: "vibrant_digital_art"
    },
    framing: {
      shot_type: "close-up",
      crop_points: "Framing cuts off at the mid-chest/shoulders. Top of the frame allows for wild, messy hair. The focus is tightly locked on the face and sunglasses.",
      composition: "Central composition. The subject looks directly at the camera, dominating the center third."
    },
    subject: {
      pose: {
        description: "Front-facing, ecstatic energy",
        body_angle: "Square to camera",
        head_position: "Facing forward, chin tilted slightly up",
        chin_technique: "Projected forward in laughter",
        shoulder_position: "Relaxed",
        weight_distribution: "Centered",
        arms: "Not visible (or barely implied at edges)"
      },
      expression: {
        type: "euphoric_joy",
        description: "Broad, open-mouthed smile showing teeth, radiating pure happiness. The subject is the person from the selfies."
      },
      wardrobe: {
        style: "festival_casual",
        details: "Wayfarer-style sunglasses with reflective orange/gold mirrored lenses. A simple grey t-shirt visible at the neckline.",
        accessories: "Classic dark-rimmed sunglasses reflecting a crowd of exuberant people celebrating Holi festival in a cloud of colored powder.",
        makeup_fx: "Heavy application of colored powder. Specifics: Cyan/Blue powder covers the forehead and nose bridge. Purple/Violet powder coats the thick beard. Neon pink dusts the hair tips.",
        notes: "The skin texture should show powder granules clinging to pores and hair."
      }
    },
    // Root level wardrobe for evaluator/worker compatibility
    wardrobe: {
      style: "festival_casual",
      top_layer: "simple grey t-shirt",
      accessories: ["Wayfarer-style sunglasses with reflective orange/gold mirrored lenses showing a crowd of people celebrating Holi"],
      makeup_fx: "Heavy application of colored powder (Cyan/Blue on forehead, Purple on beard, Neon pink on hair)"
    },
    prompt: "Vibrant, euphoric Holi Festival close-up of the subject from selfies. Bursting clouds of neon pink, cyan, and marigold Gulal powder swirl around. The subject radiates pure happiness with a broad open-mouthed laugh, wearing mirrored gold Wayfarer sunglasses that reflect a crowd of exuberant people celebrating Holi festival in a cloud of colored powder. Cyan and pink powder dusts their skin, beard, and hair with visible granules. High-key backlighting creates a halo effect through the dust particulate. Saturated 'Candy' color palette, vibrant and hyper-real digital art aesthetic, 85mm lens bokeh."
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
      persistWorkflowState: async () => { },
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
