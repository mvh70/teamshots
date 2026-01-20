import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGemini } from '../gemini'
import sharp from 'sharp'
import type { ReferenceImage } from '@/types/generation'
import { logPrompt, logStepResult } from '../utils/logging'
import { AI_CONFIG, STAGE_MODEL } from '../config'
import { StyleFingerprintService } from '@/domain/services/StyleFingerprintService'
import type { CostTrackingHandler } from '../workflow-v3'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { isFeatureEnabled } from '@/config/feature-flags'
import {
  compositionRegistry,
  type ElementContext,
} from '@/domain/style/elements/composition'

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
  preparedAssets?: Map<string, import('@/domain/style/elements/composition').PreparedAsset> // Assets from step 0 preparation
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
 * Compose element contributions for background generation phase
 *
 * Uses the element composition system to build prompt rules from independent elements.
 * For background-generation, primarily BrandingElement will contribute logo placement rules.
 */
async function composeElementContributions(
  styleSettings: PhotoStyleSettings,
  generationContext: {
    generationId?: string
    personId?: string
    teamId?: string
    preparedAssets?: Map<string, import('@/domain/style/elements/composition').PreparedAsset>
  }
): Promise<{
  instructions: string[]
  mustFollow: string[]
  freedom: string[]
}> {
  // Create element context for background-generation phase
  const elementContext: ElementContext = {
    phase: 'background-generation',
    settings: styleSettings,
    generationContext: {
      selfieS3Keys: [],
      personId: generationContext.personId, // Primary identifier - invited users don't have userId
      teamId: generationContext.teamId,
      generationId: generationContext.generationId,
      preparedAssets: generationContext.preparedAssets, // Pass prepared assets from step 0
    },
    existingContributions: [],
  }

  // Compose contributions from all relevant elements
  const contributions = await compositionRegistry.composeContributions(elementContext)

  Logger.debug('[ElementComposition] Step 1b contributions composed', {
    generationId: generationContext.generationId,
    instructionCount: contributions.instructions?.length || 0,
    mustFollowCount: contributions.mustFollow?.length || 0,
    freedomCount: contributions.freedom?.length || 0,
    preparedAssetsUsed: generationContext.preparedAssets?.size || 0,
  })

  return {
    instructions: contributions.instructions || [],
    mustFollow: contributions.mustFollow || [],
    freedom: contributions.freedom || [],
  }
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

  // Check if branding is present - but DON'T extract/delete fields
  // Keep branding info in the JSON where it belongs
  const sceneBranding = promptObj.scene?.branding as Record<string, unknown> | undefined
  let brandingRules: string[] = []

  if (sceneBranding && sceneBranding.enabled === true) {
    Logger.debug('V3 Step 1b: Scene branding detected', {
      generationId,
      position: sceneBranding.position,
      hasBrandingInfo: true
    })

    // No longer extracting and deleting branding info from JSON
    // It will stay in scene.branding where the AI can see it
  }

  // Compose element contributions if feature flag is enabled
  let elementContributions: {
    instructions: string[]
    mustFollow: string[]
    freedom: string[]
  } | null = null

  if (isFeatureEnabled('elementComposition') && styleSettings) {
    Logger.info('[ElementComposition] Feature flag enabled, composing element contributions for Step 1b')
    try {
      elementContributions = await composeElementContributions(styleSettings, {
        generationId,
        personId: input.personId,
        teamId: input.teamId,
        preparedAssets: input.preparedAssets, // Pass prepared assets from step 0
      })
      Logger.debug('[ElementComposition] Element contributions composed successfully', {
        generationId,
        hasInstructions: elementContributions.instructions.length > 0,
        hasMustFollow: elementContributions.mustFollow.length > 0,
        hasFreedom: elementContributions.freedom.length > 0,
        preparedAssets: input.preparedAssets?.size || 0,
      })
    } catch (error) {
      Logger.error('[ElementComposition] Failed to compose element contributions, falling back to extracted rules', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
      // Fall back to extracted rules on error
      elementContributions = null
    }
  }

  // Use element contributions if available (both instructions and rules)
  const effectiveBrandingInstructions = elementContributions?.instructions || []
  const effectiveBrandingRules = elementContributions?.mustFollow || []

  Logger.debug('[ElementComposition] Using branding instructions and rules', {
    generationId,
    source: elementContributions ? 'element-composition' : 'none',
    instructionCount: effectiveBrandingInstructions.length,
    ruleCount: effectiveBrandingRules.length,
  })

  // Extract scene (exclude subject, lighting, rendering)
  // We explicitly include camera settings if provided to respect user's depth of field choices
  const backgroundPrompt = {
    scene: promptObj.scene,
    lighting: promptObj.lighting, // Keep lighting for consistency with person
    camera: promptObj.camera // Include camera settings (aperture, etc.) if provided
  }

  // Compose prompt for background generation
  const jsonPrompt = JSON.stringify(backgroundPrompt, null, 2)
  
  // Check if this is a neutral or gradient background (plain wall requirements apply)
  const bgType = styleSettings?.background?.value?.type
  const isPlainBackground = bgType === 'neutral' || bgType === 'gradient'
  
  // Check if user provided specific camera/aperture settings
  const hasUserCameraSettings = !!promptObj.camera && Object.keys(promptObj.camera).length > 0
  
  const structuredPrompt = [
    'You are a professional photographer creating a background scene for a professional photo.',
    'Your task is to generate ONLY the background/scene as specified below, without any people or subjects.',
    '',
    'Scene Specifications:',
    jsonPrompt,
    '',
    'Key Requirements:',
    '- Generate ONLY the background/environment - NO people, NO subjects.',
    '- CRITICAL: The camera must be positioned DIRECTLY FACING the background (straight-on/frontal perspective).',
    '- The background must be photographed HEAD-ON, perpendicular to the wall/surface - NOT from an angle or side view.',
    '- The center of the frame should be directly aligned with the center of the background - perfectly centered and frontal.',
    '- Leave the center area clear and uncluttered where the portrait subject will stand.',
    ...(customBackgroundReference
      ? ['- Use the reference image labeled "CUSTOM BACKGROUND" as the primary background source.',
         '- If the custom background contains watermarks or logos, remove them seamlessly.']
      : []),
    ...(promptObj.lighting?.direction ? [
      `- Lighting must come from the specified direction: ${promptObj.lighting.direction}`,
      '- IMPORTANT: The lighting setup describes the LIGHT EFFECTS on the scene, NOT physical equipment to render.',
      '- Do NOT show any physical lights, softboxes, reflectors, stands, or lighting equipment in the background.',
      '- Only render the lighting EFFECTS (direction, quality, shadows, highlights) on the background surfaces.'
    ] : []),
    ...(hasUserCameraSettings
      ? ['- Respect the camera settings in the JSON (aperture, focal length, etc.)',
         '- Camera positioning (distance, height) describes the relationship to where the subject will stand, but the view must remain FRONTAL to the background.']
      : []),
    ...(isPlainBackground
      ? ['- Create a clean professional wall with subtle depth through smooth lighting gradients only.',
         '- NO plants, windows, furniture, or decorative elements.']
      : ['- Create appropriate depth and realism for the background type.']),
  ]

  structuredPrompt.push('')

  // Add element composition instructions and rules if available
  if (effectiveBrandingInstructions.length > 0 || effectiveBrandingRules.length > 0) {
    structuredPrompt.push('Branding & Elements:')

    // Add instructions first (logo source, placement description)
    for (const instruction of effectiveBrandingInstructions) {
      structuredPrompt.push(`- ${instruction}`)
    }

    // Then add rules (constraints and requirements)
    for (const rule of effectiveBrandingRules) {
      structuredPrompt.push(`- ${rule}`)
    }

    structuredPrompt.push('')
  }

  // Add reference image instructions (simplified - details are in the JSON)
  if (brandingLogoReference || customBackgroundReference) {
    structuredPrompt.push('Reference Images:')
    if (customBackgroundReference) {
      structuredPrompt.push('- Use the labeled "CUSTOM BACKGROUND" as your primary reference for scene style and atmosphere.')
    }
    if (brandingLogoReference) {
      structuredPrompt.push('- Use the labeled "BRANDING LOGO" to place branding elements as specified in Scene Specifications above.')
    }
    structuredPrompt.push('')
  }

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
    note: 'Aspect ratio constrained to match target output'
  })

  // Generate with Gemini (fixed at 1K resolution, with aspect ratio constraint)
  // Note: We constrain aspect ratio here to prevent Step 2 from having to "outpaint" or stretch
  let generationResult: Awaited<ReturnType<typeof generateWithGemini>>
  try {
    logPrompt('V3 Step 1b', composedPrompt, generationId)
    generationResult = await generateWithGemini(
      composedPrompt,
      referenceImages,
      aspectRatio, // Enforce aspect ratio constraint
      '1K', // Fixed resolution for raw asset
      {
        temperature: AI_CONFIG.BACKGROUND_GENERATION_TEMPERATURE,
        stage: 'STEP_1B_BACKGROUND',
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
          model: STAGE_MODEL.STEP_1B_BACKGROUND,
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
    model: STAGE_MODEL.STEP_1B_BACKGROUND,
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
        model: STAGE_MODEL.STEP_1B_BACKGROUND,
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

