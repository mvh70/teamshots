import { Logger } from '@/lib/logger'
import { generateWithGemini } from '../gemini'
import { composePersonPrompt } from '../prompt-composers/person'
import sharp from 'sharp'
import type { Step1Input, Step1Output, RetryContext, ReferenceImage } from '@/types/generation'

/**
 * Create a composite image from selfie references only (logo sent separately)
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
  const generatedBuffers = await generateWithGemini(
    personPrompt,
    referenceImages,
    aspectRatio,
    resolution,
    {
      temperature: 0.5  // Balanced creativity for initial person generation
    }
  )
  
  if (!generatedBuffers.length) {
    throw new Error('Step 1: Gemini returned no images')
  }
  
  // Convert to PNG
  const pngBuffer = await sharp(generatedBuffers[0]).png().toBuffer()
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

