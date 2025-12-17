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
      userId: generationContext.personId,
      teamId: generationContext.teamId,
      generationId: generationContext.generationId,
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

  // Extract branding rules from scene.branding if present (before modifying)
  const sceneBranding = promptObj.scene?.branding as Record<string, unknown> | undefined
  let brandingRules: string[] = []

  if (sceneBranding && sceneBranding.enabled === true) {
    // Extract rules array if present
    if (Array.isArray(sceneBranding.rules)) {
      brandingRules = sceneBranding.rules as string[]
    }

    // Extract placement text if present (this often contains the main branding instructions)
    if (typeof sceneBranding.placement === 'string' && sceneBranding.placement.trim()) {
      brandingRules.unshift(sceneBranding.placement as string)
    }

    Logger.debug('V3 Step 1b: Scene branding detected', {
      generationId,
      position: sceneBranding.position,
      ruleCount: brandingRules.length
    })

    // Remove rules and placement from branding object to avoid duplication in JSON
    // These will be added as clear text instructions in "Branding Requirements" section
    delete sceneBranding.rules
    delete sceneBranding.placement
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
      })
      Logger.debug('[ElementComposition] Element contributions composed successfully', {
        generationId,
        hasInstructions: elementContributions.instructions.length > 0,
        hasMustFollow: elementContributions.mustFollow.length > 0,
        hasFreedom: elementContributions.freedom.length > 0,
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

  // Use element contributions if available, otherwise use extracted branding rules
  const effectiveBrandingRules = elementContributions?.mustFollow || brandingRules

  Logger.debug('[ElementComposition] Using branding rules', {
    generationId,
    source: elementContributions ? 'element-composition' : 'extracted-from-prompt',
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
  const isPlainBackground = styleSettings?.background?.type === 'neutral' || styleSettings?.background?.type === 'gradient'
  
  // Check if user provided specific camera/aperture settings
  const hasUserCameraSettings = !!promptObj.camera && Object.keys(promptObj.camera).length > 0
  
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
    '- If a custom background image is provided and contains watermarks, logos, or text overlays, remove them seamlessly while maintaining the background quality and integrity.',
    ...(isPlainBackground 
      ? ['- Create subtle depth and realism through smooth lighting gradients ONLY - never through architectural features, lines, or interruptions.']
      : ['- Create depth and realism in the scene appropriate to the background type.']),
    
    // Dynamic Aperture / Depth Instructions
    ...(hasUserCameraSettings 
      ? ['- **Camera Settings:** Respect the specific camera settings provided in the JSON (e.g., aperture, depth of field).'] 
      : ['- **Depth of Field:** Generate the background with a wide aperture look (f/2.8) to create soft bokeh and separation, ensuring the subject will pop when composited later.']),

    '- **Composition:** Compose the scene with a clear, uncluttered central area where the portrait subject will stand. Any complex elements or logos should be placed off-center.',
    '- CRITICAL: Do NOT add any cables, wires, cords, or electrical connections to the logo or any scene elements. The logo should appear clean and standalone without any attached cables or wires.',
    ...(promptObj.lighting?.direction ? [
      `- **Lighting Consistency:** The lighting MUST come from the direction specified in the JSON (${promptObj.lighting.direction}). Do NOT include light sources (windows, lamps) that contradict this direction.`
    ] : []),
  ]

  // Add strict plain wall requirements ONLY for neutral and gradient backgrounds
  if (isPlainBackground) {
    structuredPrompt.push(
      '',
      'CRITICAL Background Wall Requirements (Neutral/Gradient Backgrounds Only):',
      '- The background should be a clean, professional studio wall WITHOUT busy decorative elements.',
      '- ABSOLUTELY NO plants, potted plants, foliage, or any vegetation in the background.',
      '- ABSOLUTELY NO windows, furniture, or distracting objects.',
      '- ABSOLUTELY NO visible wall-floor transitions, harsh corners, or seams that draw the eye.',
      '',
      '**Creating Depth in Studio Backgrounds:**',
      '- The wall should have SUBTLE THREE-DIMENSIONAL QUALITY through natural lighting gradients and gentle shadows.',
      '- Use SMOOTH LIGHTING FALLOFF from the light source (typically 45° from camera left) - the wall should be brighter near the light and gradually darker away from it.',
      '- Add VERY SUBTLE texture variation in the wall surface (minimal paint texture, barely visible imperfections) - not completely uniform like a digital gradient.',
      '- The wall should be positioned 6-8 feet behind where the subject will stand, creating NATURAL ATMOSPHERIC DEPTH through slight color desaturation and softness.',
      '- Apply appropriate BACKGROUND SHADOWING - if there\'s a rim light or backlight on the subject, the wall should show very subtle, soft shadows that suggest the light setup.',
      '- The gradient should feel ORGANIC and NATURAL, as if lit by studio lights, not artificial or digitally created.',
      '- Think: "professional studio photography" where the background has dimension but doesn\'t compete with the subject.',
    )
  }
  
  structuredPrompt.push('')

  // Add branding rules (using effective rules from element composition or fallback)
  if (effectiveBrandingRules.length > 0) {
    structuredPrompt.push('', 'Branding Requirements:')
    for (const rule of effectiveBrandingRules) {
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

  // Add branding logo instructions ONLY if logo is present
  if (brandingLogoReference) {
    referenceInstructions.push(
      '- **Branding Logo:** Use the labeled "BRANDING LOGO" in the composite image to place branding elements exactly as specified in the Branding Requirements.'
    )

    // Add strict logo placement requirements ONLY for neutral and gradient backgrounds
    if (isPlainBackground) {
      referenceInstructions.push(
        '- **CRITICAL Logo Placement (Neutral/Gradient Backgrounds Only):** The logo should be mounted FLAT ON THE WALL SURFACE as physical signage (like vinyl lettering or printed acrylic). It should follow the natural contours and lighting of the wall behind it.',
        '- **Wall Placement Only:** Place the logo ONLY on solid walls or wall surfaces - NEVER on windows, glass, doors, or transparent surfaces.',
        '- **Follow Wall Design:** The logo must conform to and follow the wall\'s surface design, flow, texture, and any architectural features (curved walls, textured surfaces, etc.).',
        '- The logo should receive the SAME LIGHTING as the wall - if the wall has gradient lighting (brighter on one side), the logo should reflect that same lighting pattern.',
        '- Add VERY SUBTLE soft shadows around/beneath the logo to suggest it\'s a physical object on the wall, not painted or floating.',
        '- The logo should appear SLIGHTLY OUT OF FOCUS compared to a sharp subject in the foreground (respecting the depth of field from a 70mm f/2.0 lens).',
        '- The logo should be integrated naturally as professional wall-mounted branding, maintaining depth while staying flush with the wall surface.'
      )
    } else {
      referenceInstructions.push(
        '- **Wall Placement Only:** Place the logo ONLY on solid walls or wall surfaces - NEVER on windows, glass, doors, or transparent surfaces.',
        '- **Follow Wall Design:** The logo must conform to and follow the wall\'s surface design, flow, texture, and any architectural features.',
        '- Ensure the logo is integrated naturally into the scene with appropriate depth and lighting.'
      )
    }
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
    note: 'Aspect ratio constrained to match target output'
  })

  // Generate with Gemini (fixed at 1K resolution, with aspect ratio constraint)
  // Note: We constrain aspect ratio here to prevent Step 2 from having to "outpaint" or stretch
  let generationResult: Awaited<ReturnType<typeof generateWithGemini>>
  try {
    logPrompt('V3 Step 1b', composedPrompt)
    generationResult = await generateWithGemini(
      composedPrompt,
      referenceImages,
      aspectRatio, // Enforce aspect ratio constraint
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

