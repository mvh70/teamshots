import { Logger } from '@/lib/logger'
import { generateWithGemini } from '../gemini'
import sharp from 'sharp'
import type { ReferenceImage } from '@/types/generation'
import { AI_CONFIG } from '../config'

export interface V3Step1bInput {
  prompt: string // JSON string with scene and branding info
  brandingLogoReference: ReferenceImage
  customBackgroundReference?: ReferenceImage
  aspectRatio: string
  generationId: string
  debugMode: boolean
  backgroundComposite?: ReferenceImage
}

export interface V3Step1bOutput {
  backgroundBuffer: Buffer
  backgroundBase64: string
  backgroundLogoReference: ReferenceImage
  compositeReference?: ReferenceImage
}

/**
 * V3 Step 1b: Generate background with branding
 * ONLY executed if branding.position is 'background' or 'elements'
 * Generates raw background focusing on scene and branding placement
 * No camera/lighting/perspective - those are applied in Step 2
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
    backgroundComposite: cachedBackgroundComposite
  } = input

  Logger.info('V3 Step 1b: Generating background with branding', {
    generationId,
    aspectRatio
  })

  // Parse prompt to extract scene and branding info
  const promptObj = JSON.parse(prompt)
  
  // Extract branding rules from scene.branding if present (before modifying)
  const sceneBranding = promptObj.scene?.branding as Record<string, unknown> | undefined
  let brandingRules: string[] = []
  
  if (sceneBranding && sceneBranding.enabled === true) {
    if (Array.isArray(sceneBranding.rules)) {
      brandingRules = sceneBranding.rules as string[]
      Logger.info('V3 Step 1b: Scene branding detected', {
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
    scene: promptObj.scene
  }

  // Compose prompt for background generation
  const jsonPrompt = JSON.stringify(backgroundPrompt, null, 2)
  
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
    '- Create depth and realism in the scene.',
    '- Ensure the background is suitable for compositing a person into it later. The logo element should be placed off center, so that we can compose the person in the center later. It is ok if the person overlaps the logo element.',
    '- Leave space in the composition for a person to be added (center or appropriate position).',
    
  ]

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
    '- **Branding Logo:** Use the labeled "BRANDING LOGO" in the composite image to place branding elements exactly as specified in the Branding Requirements. Ensure the logo is integrated naturally into the scene.'
  )

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
  const generatedBuffers = await generateWithGemini(
    composedPrompt,
    referenceImages,
    undefined, // No aspect ratio constraint - preserve original format or let model decide
    '1K', // Fixed resolution for raw asset
    { temperature: AI_CONFIG.GENERATION_TEMPERATURE }
  )

  if (!generatedBuffers.length) {
    throw new Error('V3 Step 1b: Gemini returned no images')
  }

  const pngBuffer = await sharp(generatedBuffers[0]).png().toBuffer()
  
  Logger.info('V3 Step 1b: Background generation completed', {
    generationId,
    bufferSize: pngBuffer.length
  })

  return {
    backgroundBuffer: pngBuffer,
    backgroundBase64: pngBuffer.toString('base64'),
    backgroundLogoReference: brandingLogoReference,
    compositeReference: backgroundComposite
  }
}

