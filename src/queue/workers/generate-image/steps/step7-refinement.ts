import { Logger } from '@/lib/logger'
import { generateWithGemini } from '../gemini'
import { composeRefinementPrompt } from '../prompt-composers/refinement'
import sharp from 'sharp'
import type { Step7Input, Step7Output, RetryContext, ReferenceImage } from '@/types/generation'

/**
 * Create a composite image from selfie references only (no logo for refinement)
 */
async function buildSelfieCompositeFromReferences(
  selfieReferences: ReferenceImage[],
  generationId?: string
): Promise<ReferenceImage> {
  const margin = 20
  const selfieSpacing = 10

  const elements: Array<Record<string, unknown>> = []
  let currentY = margin

  const subjectTitle = await createTextOverlayDynamic('Subject', 32, '#000000', 12)
  const subjectTitleMetadata = await sharp(subjectTitle).metadata()
  const subjectTitleHeight = subjectTitleMetadata.height ?? 0
  const subjectTitleWidth = subjectTitleMetadata.width ?? 0

  type SelfieEntry = {
    selfieBuffer: Buffer
    selfieWidth: number
    selfieHeight: number
    labelOverlay: Buffer
    labelWidth: number
    labelHeight: number
  }
  const selfieEntries: SelfieEntry[] = []
  let maxContentWidth = subjectTitleWidth

  for (let index = 0; index < selfieReferences.length; index += 1) {
    const ref = selfieReferences[index]
    const selfieBuffer = Buffer.from(ref.base64, 'base64')

    const selfieSharp = sharp(selfieBuffer)
    const selfieMetadata = await selfieSharp.metadata()
    const selfieWidth = selfieMetadata.width ?? 0
    const selfieHeight = selfieMetadata.height ?? 0

    const labelOverlay = await createTextOverlayDynamic(
      `SUBJECT1-SELFIE${index + 1}`,
      24,
      '#000000',
      8
    )
    const labelMetadata = await sharp(labelOverlay).metadata()
    const labelWidth = labelMetadata.width ?? 0
    const labelHeight = labelMetadata.height ?? 0

    maxContentWidth = Math.max(maxContentWidth, selfieWidth, labelWidth)
    selfieEntries.push({
      selfieBuffer,
      selfieWidth,
      selfieHeight,
      labelOverlay,
      labelWidth,
      labelHeight
    })
  }

  elements.push({
    input: subjectTitle,
    left: margin + Math.floor((maxContentWidth - subjectTitleWidth) / 2),
    top: currentY
  })
  currentY += subjectTitleHeight + selfieSpacing

  for (const entry of selfieEntries) {
    const imageLeft = margin + Math.floor((maxContentWidth - entry.selfieWidth) / 2)
    const labelLeft = margin + Math.floor((maxContentWidth - entry.labelWidth) / 2)

    elements.push(
      { input: entry.selfieBuffer, left: imageLeft, top: currentY },
      { input: entry.labelOverlay, left: labelLeft, top: currentY + entry.selfieHeight + 5 }
    )

    currentY += entry.selfieHeight + entry.labelHeight + selfieSpacing + 5
  }

  const canvasWidth = margin * 2 + maxContentWidth
  const canvasHeight = currentY + margin

  const compositeBuffer = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .png()
    .composite(elements)
    .toBuffer()

  const compositeBase64 = compositeBuffer.toString('base64')

  Logger.debug('Created selfie composite reference image from references', {
    generationId,
    selfieCount: selfieReferences.length
  })

  return {
    mimeType: 'image/png',
    base64: compositeBase64,
    description: 'Composite image containing vertically stacked subject selfies with clear labels for face reference.'
  }
}

/**
 * Create text overlay for labels
 */
async function createTextOverlayDynamic(
  text: string,
  fontSize: number,
  color: string,
  margin: number
): Promise<Buffer> {
  const svgText = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="${fontSize + margin * 2}">
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
            font-family="Arial, sans-serif" font-size="${fontSize}" fill="${color}">${text}</text>
    </svg>
  `

  return await sharp(Buffer.from(svgText)).png().toBuffer()
}

/**
 * Step 7: Final face refinement pass
 * Refines face to match selfies while maintaining all scene specifications
 */
export async function executeStep7(
  input: Step7Input,
  retryContext?: RetryContext,
  debugMode = false
): Promise<Step7Output> {
  const {
    compositionBuffer,
    selfieReferences,
    aspectRatio,
    resolution
  } = input
  
  Logger.info('V2 Step 7: Refining face for selfie similarity', {
    attempt: retryContext?.attempt || 1,
    maxAttempts: retryContext?.maxAttempts || 2,
    hasPreviousFeedback: !!retryContext?.previousFeedback
  })
  
  // Compose minimal refinement prompt focused on face matching only
  let refinementPrompt = composeRefinementPrompt(selfieReferences.length)
  
  if (debugMode) {
    Logger.info('V2 DEBUG - Step 7 Image Generation Prompt:', {
      step: 7,
      attempt: retryContext?.attempt || 1,
      prompt: refinementPrompt.substring(0, 3000) + (refinementPrompt.length > 3000 ? '...(truncated)' : ''),
      promptLength: refinementPrompt.length,
      selfieCount: selfieReferences.length,
      hasAdjustments: !!retryContext?.previousFeedback?.suggestedAdjustments
    })
  }
  
  // If we have feedback from previous attempt, append adjustment suggestions
  if (retryContext?.previousFeedback?.suggestedAdjustments) {
    refinementPrompt += `\n\nADJUSTMENTS FROM PREVIOUS ATTEMPT:\n${retryContext.previousFeedback.suggestedAdjustments}`
  }
  
  // Create selfie composite for face reference
  const selfieComposite = await buildSelfieCompositeFromReferences(
    selfieReferences,
    `step7-${Date.now()}`
  )

  // Build reference images array
  const referenceImages = [
    {
      description: 'BASE IMAGE (Structure Reference) - Maintain this exact composition and background',
      base64: compositionBuffer.toString('base64'),
      mimeType: 'image/png'
    },
    selfieComposite
  ]
  
  Logger.debug('V2 Step 7: Sending to Gemini', {
    promptLength: refinementPrompt.length,
    referenceCount: referenceImages.length,
    selfieCount: selfieReferences.length
  })
  
  // Generate with Gemini (this is a refinement/adjustment pass)
  // Use moderate temperature (0.5) to balance instruction adherence with natural blending
  const generatedBuffers = await generateWithGemini(
    refinementPrompt,
    referenceImages,
    aspectRatio,
    resolution,
    {
      temperature: 0.4  // More deterministic for refinement adjustments
    }
  )
  
  if (!generatedBuffers.length) {
    throw new Error('Step 7: Gemini returned no images')
  }
  
  // Convert to PNG
  const pngBuffer = await sharp(generatedBuffers[0]).png().toBuffer()
  const base64 = pngBuffer.toString('base64')
  
  Logger.info('V2 Step 7: Face refinement completed', {
    bufferSize: pngBuffer.length,
    attempt: retryContext?.attempt || 1
  })
  
  return {
    refinedBuffer: pngBuffer,
    refinedBase64: base64
  }
}

