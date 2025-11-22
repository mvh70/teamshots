import { Logger } from '@/lib/logger'
import { generateWithGemini } from '../gemini'
import { composeCompositionPrompt } from '../prompt-composers/composition'
import sharp from 'sharp'
import type { Step5Input, Step5Output, RetryContext, ReferenceImage } from '@/types/generation'

/**
 * Build aspect ratio format reference frame
 * This creates a visual guide showing the expected output dimensions
 */
async function buildAspectRatioFormatReference({
  width,
  height,
  aspectRatioDescription
}: {
  width: number
  height: number
  aspectRatioDescription: string
}): Promise<ReferenceImage> {
  const smallestSide = Math.min(width, height)
  const fontSize = Math.max(32, Math.round(smallestSide / 14))

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="rgba(255,255,255,0)" />
      <rect x="4" y="4" width="${width - 8}" height="${height - 8}" fill="rgba(255,255,255,0)" stroke="rgba(0,0,0,0.4)" stroke-width="4" />
      <rect x="32" y="32" width="${width - 64}" height="${height - 64}" fill="rgba(255,255,255,0)" stroke="rgba(0,0,0,0.18)" stroke-width="6" stroke-dasharray="28 18" />
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${fontSize}" fill="rgba(0,0,0,0.45)" text-anchor="middle" dominant-baseline="middle">FORMAT ${aspectRatioDescription}</text>
    </svg>
  `

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer()

  return {
    mimeType: 'image/png',
    base64: buffer.toString('base64'),
    description: `REFERENCE IMAGE - FORMAT ${aspectRatioDescription} (empty frame defining the final output boundaries).`
  }
}

/**
 * Step 5: Compose person + background
 * Combines person from step 1 with background, applying scene specifications
 */
export async function executeStep5(
  input: Step5Input,
  retryContext?: RetryContext,
  debugMode = false
): Promise<Step5Output> {
  const {
    personBuffer,
    backgroundBuffer,
    backgroundInstructions,
    logoBuffer,
    basePrompt,
    aspectRatio,
    aspectRatioDescription,
    expectedWidth,
    expectedHeight,
    resolution
  } = input
  
  Logger.info('V2 Step 5: Composing person + background', {
    attempt: retryContext?.attempt || 1,
    maxAttempts: retryContext?.maxAttempts || 3,
    hasCustomBackground: !!backgroundBuffer,
    hasBackgroundInstructions: !!backgroundInstructions,
    hasLogo: !!logoBuffer,
    hasPreviousFeedback: !!retryContext?.previousFeedback
  })
  
  // Compose composition prompt from package-built base prompt
  let compositionPrompt = composeCompositionPrompt(
    basePrompt,
    !!backgroundBuffer,
    aspectRatioDescription
  )
  
  // If we have feedback from previous attempt, append adjustment suggestions
  if (retryContext?.previousFeedback?.suggestedAdjustments) {
    compositionPrompt += `\n\nADJUSTMENTS FROM PREVIOUS ATTEMPT:\n${retryContext.previousFeedback.suggestedAdjustments}`
  }
  
  if (debugMode) {
    Logger.info('V2 DEBUG - Step 5 Image Generation Prompt:', {
      step: 5,
      attempt: retryContext?.attempt || 1,
      prompt: compositionPrompt.substring(0, 3000) + (compositionPrompt.length > 3000 ? '...(truncated)' : ''),
      promptLength: compositionPrompt.length,
      hasCustomBackground: !!backgroundBuffer,
      hasLogo: !!logoBuffer,
      hasAdjustments: !!retryContext?.previousFeedback?.suggestedAdjustments
    })
  }
  
  // Build reference images array
  const referenceImages: ReferenceImage[] = [
    {
      description: 'Person from Step 1 (white background)',
      base64: personBuffer.toString('base64'),
      mimeType: 'image/png'
    }
  ]
  
  // Add custom background if provided
  if (backgroundBuffer) {
    referenceImages.push({
      description: 'Background asset from Step 3',
      base64: backgroundBuffer.toString('base64'),
      mimeType: 'image/png'
    })
  }
  
  // Add logo if provided (send regardless of position for consistency)
  if (logoBuffer) {
    referenceImages.push({
      description: 'Logo asset from Step 3',
      base64: logoBuffer.toString('base64'),
      mimeType: 'image/png'
    })
  }
  
  // Add format reference frame to guide composition dimensions
  const formatReference = await buildAspectRatioFormatReference({
    width: expectedWidth,
    height: expectedHeight,
    aspectRatioDescription
  })
  referenceImages.push(formatReference)
  
  Logger.debug('V2 Step 5: Sending to Gemini', {
    promptLength: compositionPrompt.length,
    referenceCount: referenceImages.length,
    hasCustomBackground: !!backgroundBuffer,
    hasLogo: !!logoBuffer,
    formatDimensions: `${expectedWidth}x${expectedHeight}`
  })
  
  // Generate with Gemini
  const generatedBuffers = await generateWithGemini(
    compositionPrompt,
    referenceImages,
    aspectRatio,
    resolution,
    {
      temperature: 0.4  // Consistent, predictable generation results
    }
  )
  
  if (!generatedBuffers.length) {
    throw new Error('Step 5: Gemini returned no images')
  }
  
  // Convert to PNG
  const pngBuffer = await sharp(generatedBuffers[0]).png().toBuffer()
  const base64 = pngBuffer.toString('base64')
  
  Logger.info('V2 Step 5: Composition completed', {
    bufferSize: pngBuffer.length,
    attempt: retryContext?.attempt || 1
  })
  
  return {
    compositionBuffer: pngBuffer,
    compositionBase64: base64
  }
}

