import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGemini } from '../gemini'
import sharp from 'sharp'
import type { Step7Output, ReferenceImage } from '@/types/generation'
import { logPrompt, logStepResult } from '../utils/logging'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import { buildAspectRatioFormatReference } from '../utils/reference-builder'
import { resolveAspectRatioConfig } from '@/domain/style/elements/aspect-ratio/config'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import type { CostTrackingHandler } from '../workflow-v3'
import { isFeatureEnabled } from '@/config/feature-flags'
import {
  compositionRegistry,
  type ElementContext,
} from '@/domain/style/elements/composition'
import type { PhotoStyleSettings } from '@/types/photo-style'

export interface V3Step2FinalInput {
  personBuffer: Buffer // Person on grey background from Step 1 (with clothing logo already applied if applicable)
  backgroundBuffer?: Buffer // Custom background if provided (from Step 1b OR user's custom background)
  styleSettings?: PhotoStyleSettings // For element composition and user's background choice
  logoReference?: BaseReferenceImage // Logo for background/environmental branding (not clothing)
  faceCompositeReference?: BaseReferenceImage // Selfie composite from Step 1a for face refinement
  evaluatorComments?: string[] // Comments from Step 1a and Step 1b evaluations
  aspectRatio: string
  resolution?: '1K' | '2K' | '4K'
  originalPrompt: string // Original prompt with background/scene info
  generationId?: string // For cost tracking
  personId?: string // For cost tracking
  teamId?: string // For cost tracking
  onCostTracking?: CostTrackingHandler // For cost tracking
  preparedAssets?: Map<string, import('@/domain/style/elements/composition').PreparedAsset> // Assets from step 0 preparation
}

/**
 * Compose contributions from all registered elements for the composition phase
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
  referenceImages: Array<{ url: string; description: string; type: string }>
  payload?: Record<string, unknown>
}> {
  const elementContext: ElementContext = {
    phase: 'composition',
    settings: styleSettings,
    generationContext: {
      selfieS3Keys: [], // Not directly available in Step 2, but required by interface
      ...generationContext
    },
    existingContributions: []
  }

  const contributions = await compositionRegistry.composeContributions(elementContext)

  return {
    instructions: contributions.instructions || [],
    mustFollow: contributions.mustFollow || [],
    freedom: contributions.freedom || [],
    referenceImages: (contributions.referenceImages || []) as Array<{ url: string; description: string; type: string }>,
    payload: contributions.payload
  }
}

/**
 * V3 Step 2: Background composition + refinement
 * Takes the person from Step 1 (on grey background) and composites with final background
 * Applies camera/lighting settings and refines face using selfie references
 */
export async function executeV3Step2(
  input: V3Step2FinalInput,
  debugMode = false
): Promise<Step7Output> {
  const {
    personBuffer,
    backgroundBuffer,
    styleSettings,
    evaluatorComments,
    aspectRatio,
    resolution,
    originalPrompt
  } = input
  
  Logger.debug('V3 Step 2: Compositing background and refining', {
    hasBackgroundFromStep1b: !!backgroundBuffer,
    hasStyleSettings: !!styleSettings,
    hasEvaluatorComments: !!evaluatorComments && evaluatorComments.length > 0
  })
  
  // Get expected dimensions from aspect ratio
  const aspectRatioConfig = resolveAspectRatioConfig(aspectRatio)
  const expectedWidth = aspectRatioConfig.width
  const expectedHeight = aspectRatioConfig.height
  
  // Parse original prompt and extract scene/camera/lighting/rendering (exclude subject)
  const promptObj = JSON.parse(originalPrompt)

  // Extract shot type information for proper framing instructions
  const framing = promptObj.framing as { shot_type?: string; crop_points?: string } | undefined
  const shotTypeId = framing?.shot_type || 'medium-shot'
  const shotTypeConfig = resolveShotType(shotTypeId)
  const shotType = shotTypeConfig.label
  const shotDescription = framing?.crop_points || shotTypeConfig.framingDescription

  // Create background composition prompt WITHOUT subject (person is already generated)
  let backgroundPrompt: Record<string, unknown> = {
    scene: promptObj.scene,
    camera: promptObj.camera,
    lighting: promptObj.lighting,
    rendering: promptObj.rendering,
    framing: promptObj.framing // Keep framing for context
    // Explicitly exclude: subject (person already generated in Step 1)
  }

  // Extract branding context from scene.branding (for understanding design intent only)
  // Clothing branding rules were already applied in Step 1
  const sceneBranding = promptObj.scene?.branding as Record<string, unknown> | undefined

  // Try to compose contributions from elements if feature flag is enabled
  let elementContributions: {
    instructions: string[]
    mustFollow: string[]
    freedom: string[]
    referenceImages: Array<{ url: string; description: string; type: string }>
    payload?: Record<string, unknown>
  } | null = null
  if (isFeatureEnabled('elementComposition') && styleSettings) {
    try {
      elementContributions = await composeElementContributions(styleSettings, {
        generationId: input.generationId,
        personId: input.personId,
        teamId: input.teamId,
        preparedAssets: input.preparedAssets
      })
      Logger.debug('V3 Step 2: Element composition succeeded', {
        hasInstructions: elementContributions.instructions.length > 0,
        hasMustFollow: elementContributions.mustFollow.length > 0,
        hasFreedom: elementContributions.freedom.length > 0,
        hasReferenceImages: elementContributions.referenceImages.length > 0,
        hasPayload: !!elementContributions.payload,
        rulesSource: 'element-composition'
      })

      // Merge element contributions payload into backgroundPrompt
      if (elementContributions.payload) {
        Logger.debug('V3 Step 2: Merging element payload into backgroundPrompt', {
          payloadKeys: Object.keys(elementContributions.payload),
          generationId: input.generationId
        })

        // Merge payload - element payloads take precedence
        // Handle nested merging for 'scene' object
        for (const [key, value] of Object.entries(elementContributions.payload)) {
          if (key === 'scene' && typeof value === 'object' && value !== null) {
            // Merge scene objects
            backgroundPrompt.scene = {
              ...(backgroundPrompt.scene as Record<string, unknown> || {}),
              ...(value as Record<string, unknown>)
            }
          } else {
            // Direct assignment for other keys
            backgroundPrompt[key] = value
          }
        }

        Logger.info('V3 Step 2: Merged element payload into scene', {
          sceneKeys: Object.keys(backgroundPrompt.scene as Record<string, unknown>),
          generationId: input.generationId
        })
      }
    } catch (error) {
      Logger.error('V3 Step 2: Element composition failed, falling back to extracted rules', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // CRITICAL: If background was generated in Step 1b, it ALREADY contains the logo
  // If user provided custom background, it may or may not have branding
  // In BOTH cases, we must preserve the background exactly as provided
  const backgroundPreservationRules: string[] = []

  if (sceneBranding && sceneBranding.enabled === true) {
    Logger.debug('V3 Step 2: Scene branding context detected', {
      position: sceneBranding.position,
      placement: sceneBranding.placement
    })

    backgroundPreservationRules.push(
      'CRITICAL BACKGROUND PRESERVATION: The background image already contains all necessary branding elements (if any).',
      'You MUST preserve the background exactly as provided, including all logos, text, signs, banners, and flags.',
      'Do NOT add, remove, modify, regenerate, or adjust any branding elements.',
      'Do NOT create new logos based on the scene description.',
      'Your ONLY task is to composite the person naturally into this existing background.'
    )

    // Remove branding rules to prevent AI from trying to apply them
    delete sceneBranding.rules
  }

  // Use element contributions if available, otherwise fall back to extracted rules
  const effectiveBackgroundPreservationRules = elementContributions?.mustFollow ?? backgroundPreservationRules

  if (!elementContributions) {
    Logger.debug('V3 Step 2: Using extracted background preservation rules', {
      rulesCount: effectiveBackgroundPreservationRules.length,
      rulesSource: 'extracted-from-prompt'
    })
  }

  // Compose background composition prompt with branding rules, evaluator comments, and face refinement
  const jsonPrompt = JSON.stringify(backgroundPrompt, null, 2)

  // Extract subject for reference (helps AI understand intended framing/scale)
  // CRITICAL: Exclude branding if it's on clothing (already applied in Step 1a)
  let subjectReference = null
  if (promptObj.subject) {
    const subjectCopy = { ...promptObj.subject }

    // Remove branding from subject reference if position is 'clothing'
    // The person already has the logo on their clothing from Step 1a
    if (subjectCopy.branding?.position === 'clothing') {
      delete subjectCopy.branding
      Logger.debug('V3 Step 2: Removed clothing branding from subject reference', {
        generationId: input.generationId
      })
    }

    subjectReference = JSON.stringify(subjectCopy, null, 2)
  }
    
  // Build the structured prompt for background composition
  const structuredPrompt = [
    // Section 1: Intro & Task
    'You are a world-class graphics professional specializing in photo realistic composition and integration. Your task is to take the person from the base image (currently on a grey background) and composite them naturally into the scene specified below, applying the camera, lighting, and rendering specifications.',
    'The person is the primary subject and the background is the secondary subject.',
    'The background can not be changed, it must be the same as the background specified in the scene specifications without alterations.',
    'The person can not be changed - pose, expression, clothes, body framing, and crop points must remain EXACTLY the same.',
    `CRITICAL: The person is already framed as ${shotType}. DO NOT reframe or change where the body is cropped. Maintain the exact crop point from the base image.`,
    
    // Professional Compositing Instructions
    '**Advanced Compositing & Refinement:**',
    '- **Light Wrap:** Simulate realistic light wrap by allowing the brightest parts of the background to slightly bleed over the edges of the subject, integrating them into the environment.',
    '- **Color Matching:** Match the black levels, white balance, and color grading of the subject to the background environment for a cohesive look.',
    '- **Shadows:** Cast a realistic soft shadow from the subject onto the background based on the specified lighting direction.',
    '- **Global Grading:** Apply a final global color grade to "glue" the layers together, ensuring cohesive tone and atmosphere.',

    // Section 2: Scene Specifications (NO subject - person already generated)
    '',
    'Scene, Camera, Lighting & Rendering Specifications:',
    jsonPrompt,
    
    // Section 2b: Subject Reference (for context only)
    ...(subjectReference ? [
      '',
      'Subject Reference (FOR CONTEXT ONLY - DO NOT MODIFY THE PERSON):',
      'The following subject description is provided ONLY as a reference for understanding the intended framing, scale, and positioning.',
      'The person in the base image is ALREADY GENERATED and must NOT be changed based on this description.',
      subjectReference
    ] : []),

    // Section 3: Composition Rules
    '',
    'Composition Rules:',
    `- The final image must respect the **${shotType}** framing (${shotDescription}). Ensure the person is scaled correctly for this shot type, satisfying the framing constraints mentioned in the json.`,
    '- Do NOT shrink the person to make space for background elements or logos. The person is the primary subject and they must blend naturally with the background.',
    '- Match lighting, shadows, perspective, and scale.',
    `- **Output Dimensions (${aspectRatioConfig.id})**: Generate the image at exactly ${aspectRatioConfig.width}x${aspectRatioConfig.height} pixels. Fill the entire canvas edge-to-edge with the composition. Do NOT add any borders, frames, letterboxing, or black bars. The image content should extend to all edges.`,
    '',
    '**CRITICAL Depth and Spatial Composition:**',
    '- Create CLEAR SPATIAL SEPARATION using optical depth cues rather than moving the camera.',
    '- Apply DEPTH OF FIELD based on the camera aperture (f/2.0) - the person should be TACK SHARP while the background is SLIGHTLY SOFTER (not blurred, just gentler focus).',
    '- Add NATURAL SHADOWS: The person should cast a very subtle, soft shadow on the background wall behind them - positioned appropriately based on the lighting direction.',
    '- Create ATMOSPHERIC PERSPECTIVE: The background should be slightly less saturated and have lower contrast than the sharp, vibrant subject in the foreground.',
    '- Ensure LIGHTING WRAP: The key light (45° from camera left) should illuminate the person brightly while creating natural falloff on the background.',
    '- Ensure VISIBLE AIR/SPACE between the subject and background through lighting falloff and bokeh.',
    '- If there\'s a logo on the background, the person can naturally OCCLUDE parts of it, reinforcing that they\'re in front of the background plane.',
    '- Apply subtle EDGE LIGHTING or rim light on the person\'s shoulders/hair to separate them from the background and enhance three-dimensionality.',
    '- Think: "subject standing naturally in a studio" not "subject pasted onto a backdrop".',
    ''
  ]

  // Add branding-specific instructions ONLY if branding is present on background/elements
  const hasBrandingOnBackground = styleSettings?.branding?.type === 'include' &&
    (styleSettings.branding.position === 'background' || styleSettings.branding.position === 'elements')

  if (hasBrandingOnBackground && styleSettings.branding) {
    structuredPrompt.push(
      '**CRITICAL Background Logo Positioning (logo present on background):**',
      '- The logo or branding element is present on the background wall, position the subject such that the logo appears BEHIND THE HEAD OR SHOULDERS.',
      '- The logo should be visible in the UPPER portion of the frame, at head/shoulder level, NOT behind the torso, waist, or lower body.',
      '- This ensures the logo is clearly visible and professionally positioned relative to the subject\'s face.',
      '- Adjust the subject\'s vertical position in the frame as needed to achieve this head/shoulder-level logo placement.',
      '- The person can partially occlude the logo (for depth), but the logo should remain at upper-body height.',
      ''
    )

    if (styleSettings.branding.position === 'elements') {
      structuredPrompt.push(
        '**CRITICAL Element Branding (flags/banners):**',
        '- Position the flag/banner 6-8 feet BEHIND the subject with proper depth of field.',
        '- The flag should be slightly softer in focus, have natural three-dimensional curvature (not flat), and show fabric physics with folds and shadows.',
        '- The flag must be grounded on the floor, not floating.',
        '- Avoid placing the person directly adjacent to banner-like structures that could compete as a second subject. Maintain clear spatial separation and depth hierarchy.',
        ''
      )
    }
  }

  structuredPrompt.push(
    '**CRITICAL Person Prominence Rules:**',
    '- The person must be the DOMINANT element in the frame - they should occupy 40-60% of the image height at minimum.',
    '- The person should be LARGER and more visually prominent than any background elements.',
    '- The viewer\'s eye should immediately go to the person, not the background.',
    ''
  )

  // Add background preservation rules for branding (if applicable)
  // Uses element composition rules when available, otherwise falls back to extracted rules
  if (effectiveBackgroundPreservationRules && effectiveBackgroundPreservationRules.length > 0) {
    structuredPrompt.push('')
    for (const rule of effectiveBackgroundPreservationRules) {
      structuredPrompt.push(`- ${rule}`)
    }
  }
  
  // Add evaluator feedback/comments if provided
  if (evaluatorComments && evaluatorComments.length > 0) {
    structuredPrompt.push('', 'Refinement Instructions (from previous evaluations):')
    for (const comment of evaluatorComments) {
      structuredPrompt.push(`- ${comment}`)
    }
  }
  
  structuredPrompt.push(
    '',
    // Section 4: Quality Guidelines
    'Quality Guidelines:',
    '- Maintain the photorealistic quality of the original person.',
    '- Ensure the final image looks like a single, naturally-taken photograph.',
    '- Pay special attention to edges and transitions between the person and background.',
    '- Match color temperature and tone between foreground and background.'
  )

  const compositionPrompt = structuredPrompt.join('\n')
  
  if (debugMode) {
    Logger.info('V3 DEBUG - Step 2 Background Composition Prompt:', {
      step: 2,
      prompt: compositionPrompt.substring(0, 10000) + (compositionPrompt.length > 10000 ? '...(truncated)' : ''),
      promptLength: compositionPrompt.length
    })
  }

  // Build format frame reference
  const formatFrame = await buildAspectRatioFormatReference({
    width: expectedWidth,
    height: expectedHeight,
    aspectRatioDescription: aspectRatio
  })
  
  // Build reference images array
  const referenceImages: ReferenceImage[] = [
    {
      description: 'BASE IMAGE - Person on grey background from previous step (with clothing branding already applied if enabled). Keep the person EXACTLY as is, including any logo on clothing. Only change the background.',
      base64: personBuffer.toString('base64'),
      mimeType: 'image/png'
    }
  ]
  
  // Add background - either from Step 1b or user's custom background
  if (backgroundBuffer) {
    referenceImages.push({
      description: 'BACKGROUND REFERENCE - Use this image as the background, compositing the person naturally into it.',
      base64: backgroundBuffer.toString('base64'),
      mimeType: 'image/png'
    })
  }
  
  // Add format frame reference
  referenceImages.push(formatFrame)

  // Add reference images from element contributions (e.g., logos for background branding)
  if (elementContributions?.referenceImages && elementContributions.referenceImages.length > 0) {
    for (const elementRef of elementContributions.referenceImages) {
      // Convert data URL to base64 and mimeType
      if (elementRef.url.startsWith('data:')) {
        const matches = elementRef.url.match(/^data:([^;]+);base64,(.+)$/)
        if (matches) {
          const mimeType = matches[1]
          const base64Data = matches[2].trim() // Remove any whitespace

          // Validate base64 data isn't empty
          if (!base64Data) {
            Logger.warn('V3 Step 2: Skipping element reference - empty base64 data', {
              description: elementRef.description.substring(0, 50),
              type: elementRef.type,
              generationId: input.generationId
            })
            continue
          }

          referenceImages.push({
            description: elementRef.description,
            base64: base64Data,
            mimeType: mimeType
          })

          Logger.info('V3 Step 2: Added element reference image', {
            description: elementRef.description.substring(0, 50),
            type: elementRef.type,
            mimeType: mimeType,
            base64Length: base64Data.length,
            generationId: input.generationId
          })
        } else {
          Logger.warn('V3 Step 2: Failed to parse element reference data URL', {
            urlPrefix: elementRef.url.substring(0, 50),
            description: elementRef.description.substring(0, 50),
            type: elementRef.type,
            generationId: input.generationId
          })
        }
      }
    }
  }

  // Add logo for background/environmental branding ONLY (clothing was done in Step 1)
  /* LEGACY CODE - Now handled by element contributions above
  if (logoReference) {
    referenceImages.push({
      ...logoReference,
      description: logoReference.description || 'LOGO - Place this logo in the background/environment according to branding specifications. Do NOT place on clothing.'
    })
  }
  */
  
  Logger.debug('V3 Step 2: Sending to Gemini', {
    promptLength: compositionPrompt.length,
    referenceCount: referenceImages.length,
    hasBackgroundFromStep1b: !!backgroundBuffer,
    hasEvaluatorComments: !!evaluatorComments && evaluatorComments.length > 0
  })
  
  // Generate with Gemini (track both success and failure for cost accounting)
  // Use low denoising strength (approx 0.25 to 0.35) to fix lighting spill and shadows
  let generationResult: Awaited<ReturnType<typeof generateWithGemini>>
  try {
    logPrompt('V3 Step 2', compositionPrompt)
    generationResult = await generateWithGemini(
      compositionPrompt,
      referenceImages,
      aspectRatio,
      resolution,
      {
        temperature: 0.3, // Lower temperature for more consistent refinement
        preferredProvider: 'openrouter' // Load balancing: Step 2 uses OpenRouter with fallback to Vertex
      }
    )
  } catch (error) {
    const providerUsed = (error as { providerUsed?: 'vertex' | 'gemini-rest' | 'replicate' }).providerUsed
    if (input.onCostTracking) {
      try {
        await input.onCostTracking({
          stepName: 'step2-composition',
          reason: 'generation',
          result: 'failure',
          model: 'gemini-2.5-flash-image',
          provider: providerUsed,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      } catch (costError) {
        Logger.error('V3 Step 2: Failed to track generation cost (failure case)', {
          error: costError instanceof Error ? costError.message : String(costError),
          generationId: input.generationId,
        })
      }
    }
    throw error
  }
  
  if (!generationResult.images.length) {
    throw new Error('V3 Step 2: Gemini returned no images')
  }
  
  // Convert to PNG
  const pngBuffer = await sharp(generationResult.images[0]).png().toBuffer()
  const base64 = pngBuffer.toString('base64')
  
  logStepResult('V3 Step 2', {
    success: true,
    provider: generationResult.providerUsed,
    model: Env.string('GEMINI_IMAGE_MODEL'),
    imageSize: pngBuffer.length,
    durationMs: generationResult.usage.durationMs
  })

  // Track generation cost
  if (input.onCostTracking) {
    try {
      await input.onCostTracking({
        stepName: 'step2-composition',
        reason: 'generation',
        result: 'success',
        model: 'gemini-2.5-flash-image',
        provider: generationResult.providerUsed,  // Pass actual provider used
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
        durationMs: generationResult.usage.durationMs,
      })
      Logger.debug('V3 Step 2: Cost tracking recorded', {
        generationId: input.generationId,
        provider: generationResult.providerUsed,
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
      })
    } catch (error) {
      Logger.error('V3 Step 2: Failed to track generation cost', {
        error: error instanceof Error ? error.message : String(error),
        generationId: input.generationId,
      })
    }
  }
  
  return {
    refinedBuffer: pngBuffer,
    refinedBase64: base64
  }
}
