import { Logger } from '@/lib/logger'
import { generateWithGemini } from '../gemini'
import sharp from 'sharp'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { DownloadAssetFn } from '@/types/generation'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import { 
  type ReferenceImage
} from '../utils/reference-builder'
import { logDebugPrompt } from '../utils/debug-helpers'
import { AI_CONFIG } from '../config'

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
  debugMode: boolean
  evaluationFeedback?: { suggestedAdjustments?: string }
}

export interface V3Step1aOutput {
  imageBuffer: Buffer
  imageBase64: string
  clothingLogoReference?: BaseReferenceImage // Logo used in generation (for Step 2 evaluation)
  backgroundLogoReference?: BaseReferenceImage // Logo for background/elements (for Step 3 composition)
  backgroundBuffer?: Buffer
  selfieComposite: BaseReferenceImage
}

/**
 * Prepare all reference images for V3 Step 1a person generation (white background only)
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
  Logger.info('V3 Step 1a: Using provided selfie composite reference', {
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
  
  // 3. Assemble reference array - selfies and optional logo only
  // Format frame removed from Step 1a to avoid AI reproducing borders
  // Step 2 will handle final framing
  const referenceImages: BaseReferenceImage[] = [selfieComposite]
  
  if (logoReference) {
    referenceImages.push(logoReference)
  }
  
  Logger.info('V3 Step 1a: Prepared references for person generation (no format frame)', {
    generationId,
    totalReferences: referenceImages.length,
    hasLogo: !!logoReference
  })
  
  return { referenceImages, logoReference, selfieComposite }
}

/**
 * V3 Step 1a: Generate person on white background
 * Creates ONLY the person without any background complexity to let the model focus on the face
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
    evaluationFeedback
  } = input

  Logger.info('V3 Step 1a: Generating person on white background')

  // Parse prompt to extract shot type (no longer passed as separate arg)
  const promptObj = JSON.parse(prompt)
  const shotDescription = promptObj.framing?.shot_type || 'medium-shot'

  // Prepare references (selfies, optional logo for clothing branding, and format - no background yet)
  const { referenceImages, logoReference } = await prepareAllReferences({
    selfieReferences,
    selfieComposite,
    styleSettings,
    downloadAsset,
    generationId: `v3-step1-${Date.now()}`
  })

  // Create a simplified prompt object with ONLY subject and framing (no scene, camera, lighting, rendering)
  const personOnlyPrompt = {
    subject: promptObj.subject, // Keep subject details (clothing, pose, expression)
    framing: promptObj.framing, // Keep framing (shot type)
    scene: {
      background: {
        type: 'solid',
        color: '#FFFFFF',
        description: 'Pure white background (rgb(255,255,255))'
      }
    }
    // Explicitly omit: camera, lighting, rendering - these are for Step 2
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
    '- **White Background:** Generate the person on a PURE WHITE background (rgb(255,255,255)). No shadows, gradients, or other background elements. Use neutral, even lighting. Camera and lighting specifications will be applied in the next step.',
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
    logDebugPrompt('V3 Step 1a Person Generation (White BG)', 1, compositionPrompt)
  }



  // Generate with Gemini (fixed at 1K resolution for raw asset)
  const generatedBuffers = await generateWithGemini(
    compositionPrompt,
    referenceImages,
    aspectRatio,
    '1K', // Fixed resolution - model max
    { temperature: AI_CONFIG.GENERATION_TEMPERATURE }
  )

  if (!generatedBuffers.length) {
    throw new Error('V3 Step 1a: Gemini returned no images')
  }

  const pngBuffer = await sharp(generatedBuffers[0]).png().toBuffer()
  
  Logger.info('V3 Step 1a: Person generation completed (white background)', {
    bufferSize: pngBuffer.length,
    hadClothingLogo: !!logoReference
  })

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
    clothingLogoReference: clothingLogoRef, // For Step 2 evaluation
    backgroundLogoReference: backgroundLogoRef, // For Step 3 composition
    backgroundBuffer,
    selfieComposite
  }
}

