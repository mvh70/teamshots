import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGemini } from '../gemini'
import sharp from 'sharp'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { DownloadAssetFn } from '@/types/generation'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import {
  type ReferenceImage
} from '../utils/reference-builder'
import { logDebugPrompt } from '../utils/debug-helpers'
import { logPrompt, logStepResult } from '../utils/logging'
import { AI_CONFIG } from '../config'
import { StyleFingerprintService } from '@/domain/services/StyleFingerprintService'
import type { CostTrackingHandler } from '../workflow-v3'

export interface V3Step1aInput {
  selfieReferences: ReferenceImage[]
  selfieComposite: ReferenceImage
  styleSettings: PhotoStyleSettings
  downloadAsset: DownloadAssetFn
  aspectRatio: string
  aspectRatioConfig: { id: string; width: number; height: number }
  expectedWidth: number
  expectedHeight: number
  prompt: string // JSON string - contains framing.shot_type, subject, etc
  mustFollowRules: string[]
  freedomRules: string[]
  generationId: string
  personId: string
  teamId?: string
  debugMode: boolean
  evaluationFeedback?: { suggestedAdjustments?: string }
  selfieAssetIds?: string[]
  onCostTracking?: CostTrackingHandler
  referenceImages?: BaseReferenceImage[] // Pre-built reference images (e.g., garment collage from outfit1)
}

export interface V3Step1aOutput {
  imageBuffer: Buffer
  imageBase64: string
  assetId?: string // Asset ID for the generated person-on-grey intermediate
  clothingLogoReference?: BaseReferenceImage // Logo used in generation (for Step 2 evaluation)
  backgroundLogoReference?: BaseReferenceImage // Logo for background/elements (for Step 3 composition)
  backgroundBuffer?: Buffer
  selfieComposite: BaseReferenceImage
  reused?: boolean // Whether this asset was reused from cache
}

/**
 * Prepare all reference images for V3 Step 1a person generation (grey background only)
 */
async function prepareAllReferences({
  selfieReferences,
  selfieComposite,
  styleSettings,
  downloadAsset,
  generationId
}: {
  selfieReferences: ReferenceImage[]
  selfieComposite: ReferenceImage
  styleSettings: PhotoStyleSettings
  downloadAsset: DownloadAssetFn
  generationId?: string
}): Promise<{
  referenceImages: BaseReferenceImage[]
  logoReference?: BaseReferenceImage
  selfieComposite: BaseReferenceImage
}> {
  // 1. Log info about provided selfie composite
  Logger.debug('V3 Step 1a: Using provided selfie composite reference', {
    generationId,
    selfieCount: selfieReferences.length,
    selfieLabels: selfieReferences.map(ref => ref.label || 'NO_LABEL'),
    compositeMimeType: selfieComposite.mimeType,
    compositeBase64Length: selfieComposite.base64.length
  })

  // 2. Load logo ONLY if branding is on clothing (for Step 1 person generation)
  let logoReference: BaseReferenceImage | undefined
  if (
    styleSettings.branding?.type === 'include' &&
    styleSettings.branding.logoKey &&
    styleSettings.branding.position === 'clothing'
  ) {
    try {
      const logoAsset = await downloadAsset(styleSettings.branding.logoKey)
      if (logoAsset) {
        logoReference = {
          description: 'Company logo for clothing branding - apply according to branding rules',
          base64: logoAsset.base64,
          mimeType: logoAsset.mimeType
        }
      }
    } catch (error) {
      Logger.warn('Failed to load logo for V3 Step 1 clothing branding', { error })
    }
  }

  // 3. REMOVED: Outfit reference loading (now handled by outfit1/server.ts)
  // Custom clothing (outfit transfer) is package-specific (outfit1 only).
  // The outfit1 package creates a garment collage during buildGenerationPayload()
  // and passes it via input.referenceImages to avoid duplicate loading.
  // This keeps prepareAllReferences() generic for all packages.

  // 4. Assemble reference array - selfies and optional logo
  // Format frame removed from Step 1a to avoid AI reproducing borders
  // Step 2 will handle final framing
  const referenceImages: BaseReferenceImage[] = [selfieComposite]

  if (logoReference) {
    referenceImages.push(logoReference)
  }

  Logger.debug('V3 Step 1a: Prepared references for person generation (no format frame)', {
    generationId,
    totalReferences: referenceImages.length,
    hasLogo: !!logoReference
  })

  return { referenceImages, logoReference, selfieComposite }
}

/**
 * V3 Step 1a: Generate person on grey background
 * Creates ONLY the person without any background complexity to let the model focus on the face
 * Now includes fingerprinting and reuse detection for cost optimization
 */
export async function executeV3Step1a(
  input: V3Step1aInput
): Promise<V3Step1aOutput> {
  const {
    selfieReferences,
    selfieComposite,
    styleSettings,
    downloadAsset,
    aspectRatio,
    aspectRatioConfig,
    prompt,
    mustFollowRules,
    freedomRules,
    debugMode,
    evaluationFeedback,
    selfieAssetIds,
    personId,
    generationId,
    onCostTracking
  } = input

  Logger.debug('V3 Step 1a: Generating person on grey background')

  // PHASE 1: Check for reusable asset via fingerprinting
  // Note: This phase is optional and failures here should not prevent generation
  if (selfieAssetIds && selfieAssetIds.length > 0) {
    try {
      // Extract style parameters for fingerprinting
      const styleParams = StyleFingerprintService.extractFromStyleSettings(styleSettings as Record<string, unknown>)

      // Only proceed with fingerprinting if prompt parsing succeeded
      // Create fingerprint for person-on-grey step
      const fingerprint = StyleFingerprintService.createPersonFingerprint(
        selfieAssetIds,
        {
          aspectRatio: aspectRatio,
          expression: styleParams.expression,
          pose: styleParams.pose,
          shotType: styleParams.shotType,
          clothingType: styleParams.clothingType,
          clothingColor: styleParams.clothingColor,
          lighting: styleParams.lighting,
        }
      )

      Logger.debug('V3 Step 1a: Created fingerprint for person-on-grey', {
        fingerprint,
        selfieAssetIds,
        generationId,
      })

      // DISABLED: Asset reuse is temporarily disabled
      // We still create fingerprints for tracking/analytics, but don't reuse assets during generation
      // TODO: Re-enable reuse when ready
      //
      // Check for reusable asset (commented out)
      // const reusedAsset = await AssetService.findReusableAsset(fingerprint, {
      //   teamId: teamId,
      //   personId: personId,
      // })
      //
      // if (reusedAsset) {
      //   Logger.info('V3 Step 1a: Reusing existing person-on-grey asset', {
      //     assetId: reusedAsset.id,
      //     fingerprint,
      //     generationId,
      //   })
      //   // ... reuse logic ...
      //   return { ... }
      // }

      Logger.debug('V3 Step 1a: Skipping asset reuse (disabled), will generate new', {
        fingerprint,
        generationId,
      })
    } catch (error) {
      Logger.warn('V3 Step 1a: Fingerprinting/reuse check failed, continuing with generation', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  // PHASE 2: Generate new asset (original logic)

  // Parse prompt to extract shot type (no longer passed as separate arg)
  // This parse is required for generation, so if it fails, we should throw
  let promptObj: Record<string, unknown>
  try {
    promptObj = JSON.parse(prompt)
  } catch (parseError) {
    Logger.error('V3 Step 1a: Failed to parse prompt JSON - this is required for generation', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      generationId,
      promptPreview: prompt.substring(0, 200),
    })
    throw new Error(`V3 Step 1a: Invalid prompt JSON format: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
  }
  const shotDescription = (promptObj.framing as { shot_type?: string } | undefined)?.shot_type || 'medium-shot'

  // Prepare references (selfies, optional logo for clothing branding, and format - no background yet)
  const { referenceImages: preparedReferences, logoReference } = await prepareAllReferences({
    selfieReferences,
    selfieComposite,
    styleSettings,
    downloadAsset,
    generationId: `v3-step1-${Date.now()}`
  })

  // Merge pre-built references (e.g., garment collage from outfit1) with prepared references
  // Pre-built references come first as they are primary (e.g., outfit collage before logo)
  const referenceImages = [
    ...(input.referenceImages || []), // Pre-built references from package (outfit1 garment collage)
    ...preparedReferences  // Prepared references (selfie composite, logo for clothing branding)
  ]

  // Create a simplified prompt object with ONLY subject and framing (no scene, camera, lighting, rendering)
  const personOnlyPrompt = {
    subject: promptObj.subject as Record<string, unknown> | undefined, // Keep subject details (clothing, pose, expression)
    framing: promptObj.framing as { shot_type?: string } | undefined, // Keep framing (shot type)
    lighting: promptObj.lighting as Record<string, unknown> | undefined, // Keep lighting for consistency with background
    scene: {
      background: {
        type: 'solid',
        color: '#808080',
        description: 'Solid flat neutral grey background (#808080)'
      }
    }
    // Explicitly omit: camera, rendering - these are for Step 2
  }

  // Compose prompt with simplified specifications
  const jsonPrompt = JSON.stringify(personOnlyPrompt, null, 2)
  
  const structuredPrompt = [
    // Section 1: Intro & Task
    "You are a world-class professional photographer with an IQ of 145, specializing in corporate and professional portraits. Your task is to create a photorealistic portrait composition from the attached selfies and scene specifications. Below first you'll find a JSON describing the complete scene, subject, framing, camera, lighting, and rendering. Below that there are rules you must absolutely follow.",

    // Section 2: Composition JSON
    '',
    'Composition JSON',
    jsonPrompt,

    // Section 3: Must Follow Rules
    '',
    'Must Follow Rules:',
    '- Quality: Make the image as realistic as possible, with all the natural imperfections. Add realistic effects, taken from the selfies, like some hairs sticking out',
    
    `- Output Dimensions: Generate the image at ${aspectRatioConfig.width}x${aspectRatioConfig.height} pixels (${aspectRatioConfig.id || aspectRatio}). Fill the entire canvas edge-to-edge with no borders, frames, letterboxing, or black bars.`,
    shotDescription
      ? `- Shot Type: Respect the requested shot type (${shotDescription}) and ensure proper framing.`
      : '- Shot Type: Follow the shot type specifications in the JSON.'
  ]
  
  // Add element-specific must follow rules
  if (mustFollowRules && mustFollowRules.length > 0) {
    for (const rule of mustFollowRules) {
      structuredPrompt.push(`- ${rule}`)
    }
  }
  
  // Section 4: Freedom Rules
  structuredPrompt.push('')
  structuredPrompt.push('Freedom Rules:')
  structuredPrompt.push('- You are free to optimize lighting, shadows, and micro-details to ensure realistic 3D volume, texture, and natural scene integration.')
  structuredPrompt.push('- You may adjust subtle color grading and contrast to enhance the professional appearance, provided all specifications from the JSON are maintained.')
  
  // Add element-specific freedom rules
  if (freedomRules && freedomRules.length > 0) {
    for (const rule of freedomRules) {
      structuredPrompt.push(`- ${rule}`)
    }
  }

  // Add explicit reference instructions focused on person/face only
  const instructionLines: string[] = [
    '\n\nReference images are supplied with clear labels. Follow each resource precisely:',
    '- **Subject Selfies:** Inside the stacked selfie reference, choose the face that best matches the requested pose as the primary likeness. Use the remaining selfies to reinforce 3D facial structure, hair, glasses, and fine details. Stay as close as possible to the original selfies. Do not invent details, unless indicated specifically. Eg if the selfies do not show glasses, do not add glasses. Keep the hairstyle as much as possible as in the selfies. Do not show the original selfies in the final image.',
    '- **Neutral Background:** Isolated on a solid flat neutral grey background (#808080). No shadows, gradients, or other background elements. Use neutral, even lighting. Camera and lighting specifications will be applied in the next step.',
    '- **Focus on Person:** Your primary goal is to accurately recreate the person from the selfies - face, body, pose, and clothing. The background, lighting, and camera effects will be added later.'
  ]
  
  if (logoReference) {
    instructionLines.push(
      '- **Branding:** Place the logo exactly once on the clothing following the BRANDING guidance from the reference assets. The logo should be part of the person\'s appearance.'
    )
  }

  structuredPrompt.push(...instructionLines)

  if (evaluationFeedback?.suggestedAdjustments) {
    structuredPrompt.push(`\n\nADJUSTMENTS FROM PREVIOUS ATTEMPT:\n${evaluationFeedback.suggestedAdjustments}`)
  }

  const compositionPrompt = structuredPrompt.join('\n')

  if (debugMode) {
    logDebugPrompt('V3 Step 1a Person Generation (Grey BG)', 1, compositionPrompt)
  }



  // Log prompt and reference details before generation for debugging IMAGE_OTHER errors
  Logger.debug('V3 Step 1a: Starting Gemini generation', {
    generationId,
    promptLength: compositionPrompt.length,
    referenceCount: referenceImages.length,
    referenceDetails: referenceImages.map((img, idx) => ({
      index: idx,
      hasDescription: !!img.description,
      descriptionLength: img.description?.length || 0,
      descriptionPreview: img.description?.substring(0, 100) || 'NO_DESCRIPTION',
      mimeType: img.mimeType,
      base64Length: img.base64?.length || 0,
    })),
    aspectRatio,
    hasEvaluationFeedback: !!evaluationFeedback?.suggestedAdjustments,
  })

  // Generate with Gemini (fixed at 1K resolution for raw asset) and track failures
  let generationResult: Awaited<ReturnType<typeof generateWithGemini>>
  try {
    logPrompt('V3 Step 1a', compositionPrompt)
    generationResult = await generateWithGemini(
      compositionPrompt,
      referenceImages,
      aspectRatio,
      '1K', // Fixed resolution - model max
      {
        temperature: AI_CONFIG.GENERATION_TEMPERATURE,
        preferredProvider: 'vertex' // Load balancing: Step 1a uses Vertex, Step 1b uses OpenRouter
      }
    )
  } catch (error) {
    const providerUsed = (error as { providerUsed?: 'vertex' | 'gemini-rest' | 'replicate' }).providerUsed
    if (onCostTracking) {
      try {
        await onCostTracking({
          stepName: 'step1a-person',
          reason: 'generation',
          result: 'failure',
          model: 'gemini-2.5-flash-image',
          provider: providerUsed,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      } catch (costError) {
        Logger.error('V3 Step 1a: Failed to track generation cost (failure case)', {
          error: costError instanceof Error ? costError.message : String(costError),
          generationId,
        })
      }
    }
    throw error
  }

  if (!generationResult.images.length) {
    Logger.error('V3 Step 1a: Gemini returned no images', {
      generationId,
      provider: generationResult.providerUsed,
      promptLength: compositionPrompt.length,
      referenceCount: referenceImages.length,
      aspectRatio,
    })
    throw new Error('V3 Step 1a: Gemini returned no images')
  }

  const pngBuffer = await sharp(generationResult.images[0]).png().toBuffer()

  logStepResult('V3 Step 1a', {
    success: true,
    provider: generationResult.providerUsed,
    model: Env.string('GEMINI_IMAGE_MODEL'),
    imageSize: pngBuffer.length,
    durationMs: generationResult.usage.durationMs
  })

  // Track generation cost
  if (onCostTracking) {
    try {
      await onCostTracking({
        stepName: 'step1a-person',
        reason: 'generation',
        result: 'success',
        model: 'gemini-2.5-flash-image',
        provider: generationResult.providerUsed,  // Pass actual provider used
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
        durationMs: generationResult.usage.durationMs,
      })
      Logger.debug('V3 Step 1a: Cost tracking recorded', {
        generationId,
        provider: generationResult.providerUsed,
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
      })
    } catch (error) {
      Logger.error('V3 Step 1a: Failed to track generation cost', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  // PHASE 3: Create Asset and set fingerprint for future reuse
  let createdAssetId: string | undefined
  if (selfieAssetIds && selfieAssetIds.length > 0) {
    try {
      // First upload to S3 to get the key
      const intermediateS3Key = `generations/${personId}/${generationId}/intermediate/person-on-grey-${Date.now()}.png`

      // Note: The actual S3 upload will happen in the workflow layer
      // For now, we'll create the asset record assuming the upload will happen
      // In a real implementation, this should be coordinated with the upload

      Logger.debug('V3 Step 1a: Asset will be created after S3 upload in workflow layer', {
        generationId,
        intermediateS3Key,
      })

      // The asset creation will be handled by the workflow layer after upload
      // We'll return the necessary info for that

    } catch (error) {
      Logger.warn('V3 Step 1a: Asset tracking preparation failed', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  // Prepare assets for Step 2 and Step 3
  
  // 1. Keep clothing logo reference for Step 2 evaluation
  const clothingLogoRef = logoReference // This was loaded in prepareAllReferences if branding.position === 'clothing'
  
  // 2. Load custom background if specified (for Step 3)
  let backgroundBuffer: Buffer | undefined
  if (styleSettings.background?.type === 'custom' && styleSettings.background.key) {
    try {
      const bgAsset = await downloadAsset(styleSettings.background.key)
      if (bgAsset) {
        backgroundBuffer = Buffer.from(bgAsset.base64, 'base64')
      }
    } catch (error) {
      Logger.warn('Failed to load background for Step 3', { error })
    }
  }

  // 3. Load logo ONLY if branding is for background/elements (NOT clothing) - for Step 3
  let backgroundLogoRef: BaseReferenceImage | undefined
  if (
    styleSettings.branding?.type === 'include' && 
    styleSettings.branding.logoKey &&
    (styleSettings.branding.position === 'background' || styleSettings.branding.position === 'elements')
  ) {
    try {
      const logoAsset = await downloadAsset(styleSettings.branding.logoKey)
      if (logoAsset) {
        backgroundLogoRef = {
          description: `Company logo for ${styleSettings.branding.position} placement`,
          base64: logoAsset.base64,
          mimeType: logoAsset.mimeType
        }
      }
    } catch (error) {
      Logger.warn(`Failed to load logo for Step 3 ${styleSettings.branding.position} branding`, { error })
    }
  }

  return {
    imageBuffer: pngBuffer,
    imageBase64: pngBuffer.toString('base64'),
    assetId: createdAssetId,
    clothingLogoReference: clothingLogoRef, // For Step 2 evaluation
    backgroundLogoReference: backgroundLogoRef, // For Step 3 composition
    backgroundBuffer,
    selfieComposite,
    reused: false,
  }
}

