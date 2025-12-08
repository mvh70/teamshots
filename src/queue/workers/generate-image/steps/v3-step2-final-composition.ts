import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGemini } from '../gemini'
import sharp from 'sharp'
import type { Step7Output, ReferenceImage } from '@/types/generation'
import { logPrompt, logStepResult } from '../utils/logging'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import { buildAspectRatioFormatReference } from '../utils/reference-builder'
import { resolveAspectRatioConfig } from '@/domain/style/elements/aspect-ratio/config'
import type { CostTrackingHandler } from '../workflow-v3'

export interface V3Step2FinalInput {
  personBuffer: Buffer // Person on grey background from Step 1 (with clothing logo already applied if applicable)
  backgroundBuffer?: Buffer // Custom background if provided (from Step 1b OR user's custom background)
  styleSettings?: Record<string, unknown> // For user's background choice if Step 1b was skipped
  faceCompositeReference?: BaseReferenceImage // Face-focused composite from selfies for refinement
  logoReference?: BaseReferenceImage // Logo for background/environmental branding (not clothing)
  evaluatorComments?: string[] // Comments from Step 1a and Step 1b evaluations
  aspectRatio: string
  resolution?: '1K' | '2K' | '4K'
  originalPrompt: string // Original prompt with background/scene info
  generationId?: string // For cost tracking
  personId?: string // For cost tracking
  teamId?: string // For cost tracking
  onCostTracking?: CostTrackingHandler // For cost tracking
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
    faceCompositeReference,
    evaluatorComments,
    aspectRatio,
    resolution,
    originalPrompt
  } = input
  
  Logger.debug('V3 Step 2: Compositing background and refining', {
    hasBackgroundFromStep1b: !!backgroundBuffer,
    hasStyleSettings: !!styleSettings,
    hasFaceComposite: !!faceCompositeReference,
    hasEvaluatorComments: !!evaluatorComments && evaluatorComments.length > 0
  })
  
  // Get expected dimensions from aspect ratio
  const aspectRatioConfig = resolveAspectRatioConfig(aspectRatio)
  const expectedWidth = aspectRatioConfig.width
  const expectedHeight = aspectRatioConfig.height
  
  // Parse original prompt and extract scene/camera/lighting/rendering (exclude subject)
  const promptObj = JSON.parse(originalPrompt)

  // Create background composition prompt WITHOUT subject (person is already generated)
  const backgroundPrompt = {
    scene: promptObj.scene,
    camera: promptObj.camera,
    lighting: promptObj.lighting,
    rendering: promptObj.rendering,
    framing: promptObj.framing // Keep framing for context
    // Explicitly exclude: subject (person already generated in Step 1)
  }
  
  // Extract branding rules from scene.branding if present (background/elements branding only)
  // Clothing branding rules were already applied in Step 1
  const sceneBranding = promptObj.scene?.branding as Record<string, unknown> | undefined
  let brandingRules: string[] = []
  
  if (sceneBranding && sceneBranding.enabled === true) {
    // Scene branding is present (background or elements position)
    // Extract the rules that were stored in the branding object
    if (Array.isArray(sceneBranding.rules)) {
      brandingRules = sceneBranding.rules as string[]
      Logger.debug('V3 Step 2: Scene branding detected with rules', {
        position: sceneBranding.position,
        placement: sceneBranding.placement,
        ruleCount: brandingRules.length
      })
    }
    
    // Add specific positioning and depth rule for scene branding
    brandingRules.push(
      'The branding should be placed prominently behind the subject, ideally top half, and behind the subject. Ideally, the subject hides partially the branding to create visual depth and make the composition feel more natural and integrated. Do not place the branding in a corner.'
    )
    
    // Remove rules from branding object to avoid duplication in prompt
    // Rules will be added as clear text instructions separately
    delete sceneBranding.rules
  }
  
  // Compose background composition prompt with branding rules, evaluator comments, and face refinement
  const includeFaceRefinement = !!faceCompositeReference
  const jsonPrompt = JSON.stringify(backgroundPrompt, null, 2)
  
  // Extract subject for reference (helps AI understand intended framing/scale)
  const subjectReference = promptObj.subject ? JSON.stringify(promptObj.subject, null, 2) : null
    
  // Build the structured prompt for background composition
  const structuredPrompt = [
    // Section 1: Intro & Task
    'You are a world-class graphics professional specializing in photo realistic composition and integration. Your task is to take the person from the base image (currently on a grey background) and composite them naturally into the scene specified below, applying the camera, lighting, and rendering specifications.',
    'The person is the primary subject and the background is the secondary subject.',
    'The background can not be changed, it must be the same as the background specified in the scene specifications without alterations.',
    'The person can not be changed, the pose, expression,clothes and every detail must remain the same.',
    'Ensure cohesive lighting, color grading, and photorealistic integration between the person and the background.',
    'Refine the image with a low denoising strength (approx 0.25 to 0.35) to fix lighting spill and shadows, "baking" the person into the room.',

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
    '- The final image must respect the **${shotType}** framing (${shotDescription}). Ensure the person is scaled correctly for this shot type, satisfying the framing constraints mentioned in the json.',
    '- Do NOT shrink the person to make space for background elements or logos. The person is the primary subject and they must blend naturally with the background.',
    '- Match lighting, shadows, perspective, and scale.',
    `- **Output Dimensions (${aspectRatioConfig.id})**: Generate the image at exactly ${aspectRatioConfig.width}x${aspectRatioConfig.height} pixels. Fill the entire canvas edge-to-edge with the composition. Do NOT add any borders, frames, letterboxing, or black bars. The image content should extend to all edges.`,
    '',
    '**CRITICAL Depth and Spatial Composition:**',
    '- Position the person 6-8 feet in front of the background wall to create CLEAR SPATIAL SEPARATION.',
    '- Apply DEPTH OF FIELD based on the camera aperture (f/2.0) - the person should be TACK SHARP while the background is SLIGHTLY SOFTER (not blurred, just gentler focus).',
    '- Add NATURAL SHADOWS: The person should cast a very subtle, soft shadow on the background wall behind them - positioned appropriately based on the lighting direction.',
    '- Create ATMOSPHERIC PERSPECTIVE: The background should be slightly less saturated and have lower contrast than the sharp, vibrant subject in the foreground.',
    '- Ensure LIGHTING WRAP: The key light (45° from camera left) should illuminate the person brightly while creating natural falloff on the background.',
    '- The person should appear to STAND IN 3D SPACE, not pasted flat against the wall - there should be visible air/space between them and the background.',
    '- If there\'s a logo on the background, the person can naturally OCCLUDE parts of it, reinforcing that they\'re in front of the background plane.',
    '- Apply subtle EDGE LIGHTING or rim light on the person\'s shoulders/hair to separate them from the background and enhance three-dimensionality.',
    '- Think: "subject standing naturally in a studio" not "subject pasted onto a backdrop".',
    '',
    '**CRITICAL Body Framing Rules:**',
    '- NEVER crop the person at the waist or mid-torso. This looks unprofessional.',
    '- For medium-shot: Show from head to at least mid-thigh (3/4 body length).',
    '- For full-shot: Show the entire body from head to feet.',
    '- For close-up/headshot: Show from head to chest/shoulders.',
    '- When in doubt, show MORE of the body, not less. It is better to show full body than to cut off awkwardly.',
    '',
    '**CRITICAL Person Prominence Rules:**',
    '- The person must be the DOMINANT element in the frame - they should occupy 40-60% of the image height at minimum.',
    '- The person should be LARGER and more visually prominent than any background elements like banners, flags, signs, or logos.',
    '- Background elements (banners, flags, text, signs) must be VISUALLY SUBORDINATE. They should be less sharp, have lower contrast, or be partially obscured by the subject.',
    '- Do NOT make the person small to fit background elements. Instead, let the person overlap or partially cover background elements to establish depth and hierarchy.',
    '- The viewer\'s eye should immediately go to the person, not the background.',
    '- For element branding (flags/banners): Position them 6-8 feet BEHIND the subject with proper depth of field. The flag should be slightly softer in focus, have natural three-dimensional curvature (not flat), and show fabric physics with folds and shadows. The flag must be grounded on the floor, not floating.',
    '- Avoid placing the person directly adjacent to banner-like structures that could compete as a second subject. Maintain clear spatial separation and depth hierarchy.',
    '',
  ]
  
  // Add face refinement instructions if requested
  if (includeFaceRefinement) {
    structuredPrompt.push(
      '**Face Refinement**:',
      '- Do not alter the fundamental facial structure and do not any additional accesories like glasses. Use the provided face reference images to refine facial features.', 
      '- Match carefully:',
      '-- form of the eyes, nose, mouth, ears, eyebrows, cheeks, chin',
      '-- color of the eyes, skintone and hair color',
      '-- unique skin details like moles, scars, or freckles visible in the source selfies',
      '',
    )
  }
  
  // Add branding rules for background/elements branding (if provided)
  if (brandingRules && brandingRules.length > 0) {
    for (const rule of brandingRules) {
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
  
  // Add face composite for refinement if provided
  if (faceCompositeReference) {
    referenceImages.push({
      description: faceCompositeReference.description || 'FACE REFERENCES - Use these faces to refine facial features in the final image.',
      base64: faceCompositeReference.base64,
      mimeType: faceCompositeReference.mimeType
    })
  }
  
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
  
  // Add logo for background/environmental branding ONLY (clothing was done in Step 1)
  /* TEMPORARILY DISABLED to reduce image load on model
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
    hasFaceComposite: !!faceCompositeReference,
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
