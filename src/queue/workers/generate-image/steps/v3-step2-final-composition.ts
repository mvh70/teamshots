import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGemini } from '../gemini'
import { AI_CONFIG, STAGE_MODEL } from '../config'
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
  
  // Logging handled by logPrompt
  
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
  const shotType = shotTypeConfig.id.replace(/-/g, ' ')
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
      Logger.debug('V3 Step 2: Element composition OK')

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

  // Extract minimal subject reference (only framing-relevant info for scale understanding)
  // The person is already generated - we don't need full wardrobe/color details here
  let subjectReference = null
  if (promptObj.subject) {
    const subject = promptObj.subject as Record<string, unknown>
    
    // Only include pose, expression, and minimal wardrobe context (style only, not colors)
    // This helps the model understand framing/scale without duplicating Step 1a details
    const minimalSubject: Record<string, unknown> = {}
    
    if (subject.pose) {
      minimalSubject.pose = subject.pose
    }
    if (subject.expression) {
      minimalSubject.expression = subject.expression
    }
    if (subject.wardrobe) {
      const wardrobe = subject.wardrobe as Record<string, unknown>
      // Only include style info, not colors (person already generated with correct colors)
      minimalSubject.wardrobe = {
        style: wardrobe.style,
        details: wardrobe.details,
        top_layer: wardrobe.top_layer,
        base_layer: wardrobe.base_layer,
        notes: wardrobe.notes,
        // Explicitly exclude: color_palette, style_key, detail_key, inherent_accessories
      }
    }

    subjectReference = JSON.stringify(minimalSubject, null, 2)
  }
    
  // Build the structured prompt for background composition
  const structuredPrompt = [
    // Section 1: Intro & Task
    'You are a world-class graphics professional specializing in photo realistic composition and integration.',
    'Your task is to take the person from the attached image labeled "BASE IMAGE" (currently on a grey background) and composite them naturally into the scene specified below.',
    '',
    'The person is the primary subject and the background is the secondary subject.',
    'The background can not be changed - it must be exactly as provided in the attached image labeled "BACKGROUND REFERENCE".',
    'The person can not be changed - pose, expression, clothes, body framing, and crop points must remain EXACTLY the same as shown in the "BASE IMAGE".',
    `CRITICAL: The person is already framed as ${shotType} (${shotDescription}). DO NOT reframe or change where the body is cropped. Maintain the exact crop point from the "BASE IMAGE".`,
    '',
    
    // HARD CONSTRAINTS (consolidated)
    '**HARD CONSTRAINTS (Non-Negotiable):**',
    '1. **Use the EXACT person from "BASE IMAGE":** Copy the person pixel-perfectly. Do NOT regenerate, reinterpret, or modify the person in any way.',
    `2. **Person Preservation:** The person's identity, pose, expression, clothing, body position, and crop point must remain EXACTLY as shown in the "BASE IMAGE". The person is already framed as ${shotType} - maintain this exact framing.`,
    '3. **Background Content:** Do NOT change background content (objects, text, layout, logos). Preserve everything exactly as provided in "BACKGROUND REFERENCE".',
    '4. **Allowed Adjustments:** You MAY apply color grading, lighting, shadows, and depth-of-field effects to unify the composite cohesively.',
    '',

    // Section 2: Scene Specifications
    'Scene, Camera, Lighting & Rendering Specifications:',
    jsonPrompt,
    
    // Section 2b: Subject Reference (for context only)
    ...(subjectReference ? [
      '',
      'Subject Reference (FOR CONTEXT ONLY - DO NOT MODIFY THE PERSON):',
      'The following subject description is provided ONLY as a reference for understanding the intended framing, scale, and positioning.',
      'The person in the "BASE IMAGE" is ALREADY GENERATED and must NOT be changed based on this description.',
      subjectReference
    ] : []),

    // Section 3: Compositing Instructions
    '',
    '**Compositing Instructions:**',
    '- **Edge Integration:** Clean, natural edges where subject meets background. No glow, halo, or aura effects.',
    '- **Color Matching:** Match black levels, white balance, and color grading between subject and background.',
    '- **Shadows:** Cast realistic soft shadow from subject onto background based on lighting direction.',
    '- **Global Grading:** Apply final color grade to unify the composite.',
    '',

    // Section 4: Depth & Spatial Composition (consolidated - improvement #5)
    '**Depth & Spatial Composition:**',
    '- Create spatial separation using depth cues: atmospheric perspective (background slightly less saturated/lower contrast), lighting falloff, and shallow depth-of-field.',
    `- Subject should appear ~${backgroundPrompt.camera && (backgroundPrompt.camera as Record<string, unknown>).positioning ? ((backgroundPrompt.camera as Record<string, unknown>).positioning as Record<string, unknown>).subject_to_background_ft || 8 : 8} feet from the background surface.`,
    '- Apply depth-of-field based on camera aperture - subject tack sharp, background slightly softer.',
    '',

    // Section 5: Person Prominence
    '**Person Prominence:**',
    '- Person must be DOMINANT in frame (40-60% of image height minimum).',
    '- Person should be visually larger than background elements.',
    ''
  ]

  // Add background preservation rules for branding (if applicable)
  // Uses element composition rules when available, otherwise falls back to extracted rules
  if (effectiveBackgroundPreservationRules && effectiveBackgroundPreservationRules.length > 0) {
    structuredPrompt.push('')
    for (const rule of effectiveBackgroundPreservationRules) {
      structuredPrompt.push(`- ${rule}`)
    }
  }

  // Add element-specific composition instructions (e.g., logo positioning, flag placement)
  if (elementContributions?.instructions && elementContributions.instructions.length > 0) {
    structuredPrompt.push('')
    for (const instruction of elementContributions.instructions) {
      structuredPrompt.push(`- ${instruction}`)
    }
  }

  // Add mustFollow rules from elements (technical/quality requirements)
  // Note: Background preservation mustFollow rules are handled separately above
  if (elementContributions?.mustFollow && elementContributions.mustFollow.length > 0) {
    const nonBackgroundMustFollow = elementContributions.mustFollow.filter(
      rule => !effectiveBackgroundPreservationRules?.includes(rule)
    )
    if (nonBackgroundMustFollow.length > 0) {
      structuredPrompt.push('')
      structuredPrompt.push('**Technical Requirements (from elements):**')
      for (const rule of nonBackgroundMustFollow) {
        structuredPrompt.push(`- ${rule}`)
      }
    }
  }

  // Add freedom rules (creative latitude) - but filter out conflicting background modification rules
  if (elementContributions?.freedom && elementContributions.freedom.length > 0) {
    // Filter out rules that conflict with our hard constraints
    const safetyFilters = ['background scale', 'background positioning', 'adjust background', 'modify background']
    const filteredFreedom = elementContributions.freedom.filter(rule => 
      !safetyFilters.some(filter => rule.toLowerCase().includes(filter))
    )
    if (filteredFreedom.length > 0) {
      structuredPrompt.push('')
      structuredPrompt.push('**Creative Latitude:**')
      for (const freedom of filteredFreedom) {
        structuredPrompt.push(`- ${freedom}`)
      }
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
  
  // Debug prompt logging handled by logPrompt() below

  // Build format frame reference
  const formatFrame = await buildAspectRatioFormatReference({
    width: expectedWidth,
    height: expectedHeight,
    aspectRatioDescription: aspectRatio
  })
  
  // Build reference images array
  const referenceImages: ReferenceImage[] = [
    {
      description: 'BASE IMAGE - This is the person you MUST use. Take this person EXACTLY as shown - same pose, same expression, same clothing, same body position, same framing. Do NOT regenerate or modify the person. Only remove the grey background and composite onto the new background.',
      base64: personBuffer.toString('base64'),
      mimeType: 'image/png'
    }
  ]
  
  // Add background - either from Step 1b or user's custom background
  if (backgroundBuffer) {
    referenceImages.push({
      description: 'BACKGROUND REFERENCE - Use this image as the background. Composite the person from "BASE IMAGE" naturally into this scene. Do NOT modify the background content.',
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
  
  // Log reference images summary
  Logger.info('V3 Step 2: References', {
    count: referenceImages.length,
    types: referenceImages.map(img => img.description?.split(' ')[0] || 'unknown').join(', ')
  })
  
  // Generate with Gemini (track both success and failure for cost accounting)
  // Use low denoising strength (approx 0.25 to 0.35) to fix lighting spill and shadows
  let generationResult: Awaited<ReturnType<typeof generateWithGemini>>
  try {
    logPrompt('V3 Step 2', compositionPrompt, input.generationId)
    generationResult = await generateWithGemini(
      compositionPrompt,
      referenceImages,
      aspectRatio,
      resolution,
      {
        temperature: AI_CONFIG.REFINEMENT_TEMPERATURE, // Lower temperature for more consistent refinement
        stage: 'STEP_2_COMPOSITION',
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
          model: STAGE_MODEL.STEP_2_COMPOSITION,
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
  
  // Convert all images to PNG buffers (for debugging) - use first for pipeline
  const allPngBuffers = await Promise.all(
    generationResult.images.map(img => sharp(img).png().toBuffer())
  )
  const pngBuffer = allPngBuffers[0]
  const base64 = pngBuffer.toString('base64')
  
  logStepResult('V3 Step 2', {
    success: true,
    provider: generationResult.providerUsed,
    model: STAGE_MODEL.STEP_2_COMPOSITION,
    imageSize: pngBuffer.length,
    durationMs: generationResult.usage.durationMs,
    imagesReturned: allPngBuffers.length, // How many images the model returned
  })

  // Track generation cost
  if (input.onCostTracking) {
    try {
      await input.onCostTracking({
        stepName: 'step2-composition',
        reason: 'generation',
        result: 'success',
        model: STAGE_MODEL.STEP_2_COMPOSITION,
        provider: generationResult.providerUsed,  // Pass actual provider used
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
        durationMs: generationResult.usage.durationMs,
      })
      // Cost tracking logged at debug level only
    } catch (error) {
      Logger.error('V3 Step 2: Failed to track generation cost', {
        error: error instanceof Error ? error.message : String(error),
        generationId: input.generationId,
      })
    }
  }
  
  return {
    refinedBuffer: pngBuffer,
    refinedBase64: base64,
    allImageBuffers: allPngBuffers, // All images for debugging
  }
}
