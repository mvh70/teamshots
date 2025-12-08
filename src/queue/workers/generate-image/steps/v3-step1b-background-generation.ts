import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGemini } from '../gemini'
import sharp from 'sharp'
import type { ReferenceImage } from '@/types/generation'
import { logPrompt, logStepResult } from '../utils/logging'
import { AI_CONFIG } from '../config'
import { StyleFingerprintService } from '@/domain/services/StyleFingerprintService'
import type { CostTrackingHandler } from '../workflow-v3'
import type { PhotoStyleSettings } from '@/types/photo-style'

export interface V3Step1bInput {
  prompt: string // JSON string with scene and branding info
  brandingLogoReference: ReferenceImage
  customBackgroundReference?: ReferenceImage
  aspectRatio: string
  generationId: string
  personId: string
  teamId?: string
  debugMode: boolean
  backgroundComposite?: ReferenceImage
  styleSettings?: PhotoStyleSettings
  backgroundAssetId?: string
  logoAssetId?: string
  onCostTracking?: CostTrackingHandler
}

export interface V3Step1bOutput {
  backgroundBuffer: Buffer
  backgroundBase64: string
  assetId?: string // Asset ID for background-with-branding intermediate
  backgroundLogoReference: ReferenceImage
  compositeReference?: ReferenceImage
  reused?: boolean // Whether this asset was reused from cache
}

/**
 * V3 Step 1b: Generate background with branding
 * ONLY executed if branding.position is 'background' or 'elements'
 * Generates raw background focusing on scene and branding placement
 * No camera/lighting/perspective - those are applied in Step 2
 * Now includes fingerprinting and reuse detection for cost optimization
 */
export async function executeV3Step1b(
  input: V3Step1bInput
): Promise<V3Step1bOutput> {
  const {
    prompt,
    brandingLogoReference,
    customBackgroundReference,
    aspectRatio,
    generationId,
    debugMode,
    backgroundComposite: cachedBackgroundComposite,
    styleSettings,
    backgroundAssetId,
    logoAssetId,
    onCostTracking
  } = input

  Logger.debug('V3 Step 1b: Generating background with branding', {
    generationId,
    aspectRatio
  })

  // PHASE 1: Check for reusable asset via fingerprinting
  if (backgroundAssetId || logoAssetId) {
    try {
      // Extract style parameters for fingerprinting
      const styleParams = styleSettings
        ? StyleFingerprintService.extractFromStyleSettings(styleSettings as Record<string, unknown>)
        : {}

      // Collect asset IDs for fingerprinting
      const assetIds: string[] = []
      if (backgroundAssetId) assetIds.push(backgroundAssetId)
      if (logoAssetId) assetIds.push(logoAssetId)

      // Create fingerprint for background-with-branding step
      const fingerprint = StyleFingerprintService.createBackgroundFingerprint(
        backgroundAssetId || null,
        logoAssetId || null,
        {
          backgroundType: styleParams.backgroundType,
          backgroundColor: styleParams.backgroundColor,
          backgroundGradient: styleParams.backgroundGradient,
          brandingPosition: styleParams.brandingPosition,
          aspectRatio: aspectRatio,
        }
      )

      Logger.debug('V3 Step 1b: Created fingerprint for background-with-branding', {
        fingerprint,
        backgroundAssetId,
        logoAssetId,
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
      // if (reusedAsset && downloadAsset) {
      //   Logger.info('V3 Step 1b: Reusing existing background-with-branding asset', {
      //     assetId: reusedAsset.id,
      //     fingerprint,
      //     generationId,
      //   })
      //   // ... reuse logic ...
      //   return { ... }
      // }

      Logger.debug('V3 Step 1b: Skipping asset reuse (disabled), will generate new', {
        fingerprint,
        generationId,
      })
    } catch (error) {
      Logger.warn('V3 Step 1b: Fingerprinting/reuse check failed, continuing with generation', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  // PHASE 2: Generate new asset (original logic)

  // Parse prompt to extract scene and branding info
  const promptObj = JSON.parse(prompt)
  
  // Extract branding rules from scene.branding if present (before modifying)
  const sceneBranding = promptObj.scene?.branding as Record<string, unknown> | undefined
  let brandingRules: string[] = []
  
  if (sceneBranding && sceneBranding.enabled === true) {
    if (Array.isArray(sceneBranding.rules)) {
      brandingRules = sceneBranding.rules as string[]
      Logger.debug('V3 Step 1b: Scene branding detected', {
        generationId,
        position: sceneBranding.position,
        placement: sceneBranding.placement,
        ruleCount: brandingRules.length
      })
    }
    
    // Remove rules from branding object to avoid duplication in prompt
    // Rules will be added as clear text instructions in "Branding Requirements" section
    delete sceneBranding.rules
  }

  // Extract scene (exclude subject, camera, lighting, rendering)
  const backgroundPrompt = {
    scene: promptObj.scene,
    lighting: promptObj.lighting // Keep lighting for consistency with person
  }

  // Compose prompt for background generation
  const jsonPrompt = JSON.stringify(backgroundPrompt, null, 2)
  
  // Check if this is a neutral or gradient background (plain wall requirements apply)
  const isPlainBackground = styleSettings?.background?.type === 'neutral' || styleSettings?.background?.type === 'gradient'
  
  const structuredPrompt = [
    'You are a professional photographer creating a background scene for a professional photo.',
    'Your task is to generate ONLY the background/scene as specified below, without any people or subjects.',
    '',
    'Scene Specifications:',
    jsonPrompt,
    '',
    'Background Generation Rules:',
    '- Generate ONLY the background/environment/scene - NO people, NO subjects, NO persons.',
    '- Do not add any format frames or aspect ratio constraints - preserve the natural format of the background, preferably in wider format, to make it easier to compose the person in the center later.',
    '- If no background image is provided, create a high-quality, professional background that matches the scene description.',
    ...(isPlainBackground 
      ? ['- Create subtle depth and realism through smooth lighting gradients ONLY - never through architectural features, lines, or interruptions.']
      : ['- Create depth and realism in the scene appropriate to the background type.']),
    '- Ensure the background is suitable for compositing a person into it later. The logo element should be placed off center, so that we can compose the person in the center later. It is ok if the person overlaps the logo element.',
    '- Leave space in the composition for a person to be added (center or appropriate position).',
    '- CRITICAL: Do NOT add any cables, wires, cords, or electrical connections to the logo or any scene elements. The logo should appear clean and standalone without any attached cables or wires.',
  ]

  // Add strict plain wall requirements ONLY for neutral and gradient backgrounds
  if (isPlainBackground) {
    structuredPrompt.push(
      '',
      'CRITICAL Background Wall Requirements (Neutral/Gradient Backgrounds Only):',
      '- The background wall must be COMPLETELY PLAIN and UNINTERRUPTED - a single, flat, uniform surface with no decorative elements.',
      '- ABSOLUTELY NO plants, potted plants, foliage, or any vegetation in the background.',
      '- ABSOLUTELY NO architectural lines, corners, folds, seams, or visible wall-floor transitions.',
      '- ABSOLUTELY NO patterns, textures, windows, furniture, objects, or any other interruptions.',
      '- ABSOLUTELY NO shadows, gradients, or depth variations that create visible lines or divisions.',
      '- The wall should appear as a perfectly flat, uniform, uninterrupted plane - like a seamless studio backdrop.',
      '- Any subtle depth or lighting should be achieved through smooth gradients ONLY, never through visible lines, edges, or architectural features.',
    )
  }
  
  structuredPrompt.push('')

  // Add branding rules
  if (brandingRules.length > 0) {
    structuredPrompt.push('', 'Branding Requirements:')
    for (const rule of brandingRules) {
      structuredPrompt.push(`- ${rule}`)
    }
  }

  // Add reference image instructions
  const referenceInstructions: string[] = [
    '',
    'Reference Images Instructions:'
  ]

  // Add custom background instruction if provided
  if (customBackgroundReference) {
    referenceInstructions.push(
      '- **Background Composite:** Use the labeled "CUSTOM BACKGROUND" in the composite image as your primary reference. Adapt the scene description to match the style, colors, and atmosphere of this background image while incorporating the branding requirements. The custom background should heavily influence the final scene composition.'
    )
  }

  // Add branding logo instruction
  referenceInstructions.push(
    '- **Branding Logo:** Use the labeled "BRANDING LOGO" in the composite image to place branding elements exactly as specified in the Branding Requirements.'
  )

  // Add strict logo placement requirements ONLY for neutral and gradient backgrounds
  if (isPlainBackground) {
    referenceInstructions.push(
      '- **CRITICAL Logo Placement (Neutral/Gradient Backgrounds Only):** The logo must appear FLUSH and FLAT against the plain background wall, as if it is directly affixed or stuck to the wall surface. The logo should have NO depth, NO shadows that create separation from the wall, and NO 3D effects that make it appear raised or floating. It must look like it is painted directly onto or seamlessly integrated into the flat, uninterrupted wall surface.',
      '- The logo should be integrated naturally into the scene while maintaining the appearance of being directly attached to the plain wall.'
    )
  } else {
    referenceInstructions.push(
      '- Ensure the logo is integrated naturally into the scene.'
    )
  }

  structuredPrompt.push(...referenceInstructions)

  const composedPrompt = structuredPrompt.join('\n')

  if (debugMode) {
    Logger.info('V3 DEBUG - Step 1b Background Generation Prompt:', {
      step: '1b',
      prompt: composedPrompt.substring(0, 10000) + (composedPrompt.length > 10000 ? '...(truncated)' : ''),
      promptLength: composedPrompt.length,
      generationId
    })
  }

  // Build background composite (reuse cached version when provided)
  let backgroundComposite = cachedBackgroundComposite

  if (!backgroundComposite) {
    const { buildBackgroundComposite } = await import('@/lib/generation/reference-utils')

    backgroundComposite = await buildBackgroundComposite({
      customBackgroundReference,
      logoReference: brandingLogoReference,
      generationId
    })
  }

  // Build reference images array - use only the composite
  const referenceImages: ReferenceImage[] = [backgroundComposite]

  Logger.debug('V3 Step 1b: Sending to Gemini', {
    generationId,
    promptLength: composedPrompt.length,
    referenceCount: referenceImages.length,
    note: 'No aspect ratio constraint - background format will be preserved'
  })

  // Generate with Gemini (fixed at 1K resolution, no aspect ratio constraint, no camera/lighting settings)
  // Note: We don't constrain aspect ratio here - custom backgrounds preserve their format,
  // and generated backgrounds will be composited in Step 2 which handles format constraints
  let generationResult: Awaited<ReturnType<typeof generateWithGemini>>
  try {
    logPrompt('V3 Step 1b', composedPrompt)
    generationResult = await generateWithGemini(
      composedPrompt,
      referenceImages,
      undefined, // No aspect ratio constraint - preserve original format or let model decide
      '1K', // Fixed resolution for raw asset
      {
        temperature: AI_CONFIG.GENERATION_TEMPERATURE,
        preferredProvider: 'openrouter' // Load balancing: Step 1b uses OpenRouter, Step 1a uses Vertex
      }
    )
  } catch (error) {
    const providerUsed = (error as { providerUsed?: 'vertex' | 'gemini-rest' | 'replicate' }).providerUsed
    if (onCostTracking) {
      try {
        await onCostTracking({
          stepName: 'step1b-background',
          reason: 'generation',
          result: 'failure',
          model: 'gemini-2.5-flash-image',
          provider: providerUsed,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      } catch (costError) {
        Logger.error('V3 Step 1b: Failed to track generation cost (failure case)', {
          error: costError instanceof Error ? costError.message : String(costError),
          generationId,
        })
      }
    }
    throw error
  }

  if (!generationResult.images.length) {
    throw new Error('V3 Step 1b: Gemini returned no images')
  }

  const pngBuffer = await sharp(generationResult.images[0]).png().toBuffer()
  
  logStepResult('V3 Step 1b', {
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
        stepName: 'step1b-background',
        reason: 'generation',
        result: 'success',
        model: 'gemini-2.5-flash-image',
        provider: generationResult.providerUsed,  // Pass actual provider used
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
        durationMs: generationResult.usage.durationMs,
      })
      Logger.debug('V3 Step 1b: Cost tracking recorded', {
        generationId,
        provider: generationResult.providerUsed,
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
      })
    } catch (error) {
      Logger.error('V3 Step 1b: Failed to track generation cost', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  return {
    backgroundBuffer: pngBuffer,
    backgroundBase64: pngBuffer.toString('base64'),
    assetId: undefined, // Will be set by workflow layer after S3 upload
    backgroundLogoReference: brandingLogoReference,
    compositeReference: backgroundComposite,
    reused: false,
  }
}

