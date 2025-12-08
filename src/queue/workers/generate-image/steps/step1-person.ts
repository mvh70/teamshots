import { Logger } from '@/lib/logger'
import { generateWithGemini } from '../gemini'
import { composePersonPrompt } from '../prompt-composers/person'
import sharp from 'sharp'
import type { Step1Input, Step1Output, RetryContext } from '@/types/generation'

// Import shared utilities
import { buildSelfieCompositeFromReferences } from '../utils/reference-builder'

/**
 * Step 1: Generate person on white background
 * Extracts person-related elements from package prompt and generates isolated person
 */
export async function executeStep1(
  input: Step1Input,
  retryContext?: RetryContext,
  debugMode = false
): Promise<Step1Output> {
  const { selfieReferences, basePrompt, styleSettings, logoReference, aspectRatio, resolution } = input
  
  Logger.info('V2 Step 1: Generating person on white background', {
    attempt: retryContext?.attempt || 1,
    maxAttempts: retryContext?.maxAttempts || 3,
    hasPreviousFeedback: !!retryContext?.previousFeedback
  })
  
  // Compose person prompt from package-built base prompt
  let personPrompt = composePersonPrompt(basePrompt)
  
  if (debugMode) {
    Logger.info('V2 DEBUG - Step 1 Image Generation Prompt:', {
      step: 1,
      attempt: retryContext?.attempt || 1,
      prompt: personPrompt.substring(0, 8000) + (personPrompt.length > 8000 ? '...(truncated)' : ''),
      promptLength: personPrompt.length,
      selfieCount: selfieReferences.length,
      hasLogo: !!logoReference
    })
  }
  
  // If we have feedback from previous attempt, append adjustment suggestions
  if (retryContext?.previousFeedback?.suggestedAdjustments) {
    personPrompt += `\n\nADJUSTMENTS FROM PREVIOUS ATTEMPT:\n${retryContext.previousFeedback.suggestedAdjustments}`
  }
  
  // Create selfie composite (logos sent separately)
  const selfieComposite = await buildSelfieCompositeFromReferences(
    selfieReferences,
    {},
    `step1-${Date.now()}`
  )

  const referenceImages = [selfieComposite]

  // Include logo as separate image if branding is on clothing
  if (styleSettings.branding?.type === 'include' &&
      styleSettings.branding.position === 'clothing' &&
      logoReference) {
    referenceImages.push({
      description: 'Company logo for clothing branding - apply according to branding rules',
      base64: logoReference.base64,
      mimeType: logoReference.mimeType
    })
  }
  
  Logger.debug('V2 Step 1: Sending to Gemini', {
    promptLength: personPrompt.length,
    referenceCount: referenceImages.length,
    hasClothingLogo: styleSettings.branding?.position === 'clothing'
  })
  
  // Generate with Gemini
  const generatedResult = await generateWithGemini(
    personPrompt,
    referenceImages,
    aspectRatio,
    resolution,
    {
      temperature: 0.5  // Balanced creativity for initial person generation
    }
  )
  
  if (!generatedResult.images.length) {
    throw new Error('Step 1: Gemini returned no images')
  }
  
  // Convert to PNG
  const pngBuffer = await sharp(generatedResult.images[0]).png().toBuffer()
  const base64 = pngBuffer.toString('base64')
  
  Logger.info('V2 Step 1: Person generation completed', {
    bufferSize: pngBuffer.length,
    attempt: retryContext?.attempt || 1
  })
  
  return {
    personBuffer: pngBuffer,
    personBase64: base64,
    personPrompt
  }
}

