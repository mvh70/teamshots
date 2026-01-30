/**
 * Generate preset example images using the Standard Shots presets
 * 
 * Usage: npx tsx scripts/generate-preset-examples.ts [preset_id]
 * 
 * If no preset_id is provided, generates for SPEAKER_CONFERENCE_STAGE (test run)
 */

import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
config({ path: path.resolve(__dirname, '../.env') })

// Get preset prompts from the StandardShotPresetElement
const PRESET_PROMPTS = {
    LINKEDIN_NEUTRAL_STUDIO: {
        subject: {
            description: "Professional headshot of a confident individual looking directly at the camera.",
            pose: "Upright posture, shoulders angled 45 degrees, head straight.",
            expression: "Warm, approachable smile showing teeth, eyes slightly narrowed (squinch) to convey competence."
        },
        wardrobe: {
            description: "Tailored navy blue blazer over a crisp white dress shirt.",
            style: "corporate_clean"
        },
        scene: {
            environment: {
                description: "Solid, soft light gray background (#D3D3D3) with a subtle vignette. No distracting elements, pure seamless paper texture.",
                type: "studio_seamless"
            }
        },
        lighting: {
            description: "Soft, diffuse studio lighting. Key light 45 degrees. Minimal shadows. 'Beauty light' fill.",
            setup: "commercial_studio"
        },
        framing: {
            shot_type: "headshot",
            composition: "Centered composition, chest-up framing. Eyes at the upper third line."
        },
        camera: {
            description: "85mm portrait lens, f/8 aperture for deep depth of field. Eye-level angle.",
            lens: "85mm",
            aperture: "f/8",
            angle: "Eye-level"
        },
        rendering: {
            description: "Corporate Clean Aesthetic. True-to-life skin tones. Neutral white balance (5600K). Natural saturation.",
            style: "corporate_neutral",
            film_type: "clinical-modern (Phase One IQ4)"
        }
    },
    SPEAKER_CONFERENCE_STAGE: {
        subject: {
            description: "Confident speaker on stage, three-quarter body visible.",
            pose: "Standing confidently, natural gesture with hands. Body slightly angled toward audience.",
            expression: "Engaged, passionate, mid-speech moment. Authentic connection."
        },
        wardrobe: {
            description: "Sharp tailored blazer over a high-quality base layer. Polished, stage-ready attire.",
            style: "speaker_professional",
            inherent_accessories: ["head microphone", "watch"]
        },
        scene: {
            environment: {
                description: "Real conference stage with subtle LED screen or banner backdrop. Soft stage lighting visible. Professional event atmosphere, not overly dramatic.",
                type: "conference_stage"
            }
        },
        lighting: {
            description: "Professional stage lighting. Soft key light from front, gentle fill. Natural stage ambience without harsh shadows.",
            setup: "stage_natural"
        },
        framing: {
            shot_type: "three-quarter",
            composition: "Off-center, showing stage context. Speaker prominent but environment visible."
        },
        camera: {
            description: "70mm lens, f/4 for balanced depth. Slight low-angle for presence.",
            lens: "70mm",
            aperture: "f/4",
            angle: "Slightly low-angle"
        },
        rendering: {
            description: "Natural stage aesthetic. Warm, professional colors. Not overly processed.",
            style: "stage_natural",
            film_type: "cinematic-natural (Sony Venice)"
        }
    },
    EXECUTIVE_DARK_STUDIO: {
        subject: {
            description: "Executive power portrait, shoulders-up.",
            pose: "Arms crossed or hands clasped, strong posture, slight lean forward.",
            expression: "Serious, confident, decisive. Minimal smile, strong gaze."
        },
        wardrobe: {
            description: "Premium dark suit with power tie, or silk blouse. Refined, authoritative attire.",
            style: "executive_formal",
            inherent_accessories: ["cufflinks", "watch", "belt"]
        },
        scene: {
            environment: {
                description: "Rich charcoal/navy gradient background. Hints of mahogany, leather, or dark wood texture.",
                type: "executive_dark_studio"
            }
        },
        lighting: {
            description: "Low-key Rembrandt lighting. Strong shadows, dramatic mood. Single key light.",
            setup: "rembrandt_lowkey"
        },
        framing: {
            shot_type: "headshot",
            composition: "Classic centered power composition. Eyes at upper third."
        },
        camera: {
            description: "85mm lens, f/5.6 for sharpness with subtle separation.",
            lens: "85mm",
            aperture: "f/5.6",
            angle: "Slightly below eye-level for power"
        },
        rendering: {
            description: "Rich, moody executive style. Deep blacks, warm highlights. Editorial quality.",
            style: "executive_editorial",
            film_type: "hasselblad-editorial (Hasselblad X2D)"
        }
    },
    TEAM_PAGE_CORPORATE: {
        subject: {
            description: "Standardized corporate headshot for team uniformity.",
            pose: "Straight-on or slight 3/4 angle. Consistent across team.",
            expression: "Friendly, approachable smile. Welcoming and professional."
        },
        wardrobe: {
            description: "Business casual: blazer or cardigan over solid-color top. Brand colors if applicable.",
            style: "corporate_team"
        },
        scene: {
            environment: {
                description: "Clean, bright off-white or light brand-color background. Subtle gradient for depth.",
                type: "team_bright_studio"
            }
        },
        lighting: {
            description: "Bright, even studio lighting. Soft shadows, high-key feel. Consistent exposure.",
            setup: "highkey_studio"
        },
        framing: {
            shot_type: "headshot",
            composition: "Centered, standardized framing for grid layouts. Same crop for all team members."
        },
        camera: {
            description: "85mm lens, f/8 for consistent sharpness across team.",
            lens: "85mm",
            aperture: "f/8",
            angle: "Eye-level"
        },
        rendering: {
            description: "Bright, clean corporate. Neutral colors, true skin tones. Print-ready.",
            style: "corporate_clean",
            film_type: "clinical-modern (Canon R5)"
        }
    },
    SOCIAL_MEDIA_LIFESTYLE: {
        subject: {
            description: "Lifestyle portrait, relaxed and authentic feel.",
            pose: "Natural, relaxed posture. Hand on chin or hair, candid gesture.",
            expression: "Genuine warm smile, eyes crinkling. Authentic happiness."
        },
        wardrobe: {
            description: "Trendy casual: denim jacket, cozy sweater, or statement accessory. Approachable fashion.",
            style: "lifestyle_casual"
        },
        scene: {
            environment: {
                description: "Soft natural environment: sunny window, cozy interior, or blurred greenery. Warm tones.",
                type: "lifestyle_natural"
            }
        },
        lighting: {
            description: "Soft natural window light. Golden hour warmth. Gentle, flattering shadows.",
            setup: "natural_soft_warm"
        },
        framing: {
            shot_type: "medium-shot",
            composition: "Instagram-friendly 4:5 or square crop. Off-center, natural feel."
        },
        camera: {
            description: "50mm lens, f/1.8 for dreamy bokeh and intimacy.",
            lens: "50mm",
            aperture: "f/1.8",
            angle: "Eye-level or slightly above"
        },
        rendering: {
            description: "Warm, inviting Instagram aesthetic. Lifted shadows, peachy skin tones. Soft matte finish.",
            style: "instagram_warm",
            film_type: "portra-soft (Kodak Portra 400)"
        }
    }
}

async function run() {
    const { prisma } = await import('../src/lib/prisma')
    const { createS3Client, getS3BucketName } = await import('../src/lib/s3-client')
    const { prepareSelfies } = await import('../src/queue/workers/generate-image/s3-utils')
    const { buildSelfieComposite } = await import('../src/lib/generation/reference-utils')
    const { executeV3Workflow } = await import('../src/queue/workers/generate-image/workflow-v3')
    const fs = await import('fs/promises')

    // Get preset from command line or default to test
    const presetId = process.argv[2] || 'SPEAKER_CONFERENCE_STAGE'

    if (!PRESET_PROMPTS[presetId as keyof typeof PRESET_PROMPTS]) {
        console.error(`Unknown preset: ${presetId}`)
        console.log('Available presets:', Object.keys(PRESET_PROMPTS).join(', '))
        process.exit(1)
    }

    const customPrompt = PRESET_PROMPTS[presetId as keyof typeof PRESET_PROMPTS]

    console.log(`\n========================================`)
    console.log(`Generating: ${presetId}`)
    console.log(`========================================\n`)

    // Target user ID (same as in generate-custom-image.ts)
    const userId = 'cmiwy062a0001dqj7y0jyljtl'

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
                packageId: 'standard-shots',
                presetId: presetId,
                rawPrompt: true,
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
        id: `preset-${presetId}-${Date.now()}`,
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
    const outputDir = path.join(process.cwd(), 'generated-images', 'presets')
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
            styleSettings: {} as any,
            prompt: JSON.stringify(customPrompt),
            mustFollowRules: [
                'Generate the person using the selfie references as identity source',
                'Preserve all facial features exactly as shown in selfies',
                `Apply the ${presetId} preset style exactly as specified`,
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
        console.log(`Generation completed for ${presetId}!`)
        console.log('========================================')
        console.log(`Generated ${result.approvedImageBuffers.length} images`)

        // Save final images with preset name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        for (let i = 0; i < result.approvedImageBuffers.length; i++) {
            const outputPath = path.join(outputDir, `${presetId}-${timestamp}-${i}.png`)
            await fs.writeFile(outputPath, result.approvedImageBuffers[i])
            console.log(`Saved: ${outputPath}`)
        }

        // Update generation status
        await prisma.generation.update({
            where: { id: generation.id },
            data: {
                status: 'completed',
                generatedPhotoKeys: result.approvedImageBuffers.map((_, i) =>
                    `generated-images/presets/${presetId}-${timestamp}-${i}.png`
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
