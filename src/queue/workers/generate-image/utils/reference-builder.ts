import sharp from 'sharp'
import { Logger } from '@/lib/logger'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'

// Extended reference image with optional label
export interface ReferenceImage extends BaseReferenceImage {
  label?: string
}

interface CompositeConfig {
  margin: number
  spacing: number
  titleFontSize: number
  labelFontSize: number
}

const DEFAULT_CONFIG: CompositeConfig = {
  margin: 20,
  spacing: 10,
  titleFontSize: 32,
  labelFontSize: 24
}
const MAX_COMPOSITE_SMALLEST_SIDE_PX = 1536
const COMPOSITE_JPEG_QUALITY = 90

async function downscaleForCompositeIfNeeded(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const oriented = await sharp(buffer).rotate().toBuffer({ resolveWithObject: true })
  const width = oriented.info.width
  const height = oriented.info.height
  const smallestSide = Math.min(width, height)
  if (smallestSide <= MAX_COMPOSITE_SMALLEST_SIDE_PX) {
    return { buffer: oriented.data, width, height }
  }

  const scale = MAX_COMPOSITE_SMALLEST_SIDE_PX / smallestSide
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const resized = await sharp(oriented.data)
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: 'inside',
      withoutEnlargement: true
    })
    .toBuffer({ resolveWithObject: true })

  return {
    buffer: resized.data,
    width: resized.info.width,
    height: resized.info.height
  }
}

/**
 * Build a composite image from selfie buffers with labels
 * Core implementation for composite creation
 */
export async function buildSelfieCompositeFromBuffers(
  selfieBuffers: Buffer[],
  config: Partial<CompositeConfig> = {},
  generationId?: string
): Promise<ReferenceImage> {
  // Validate input
  if (!selfieBuffers || selfieBuffers.length === 0) {
    Logger.error('buildSelfieCompositeFromBuffers: No selfie buffers provided!', {
      generationId,
      selfieCount: selfieBuffers?.length || 0
    })
    throw new Error('Cannot build selfie composite: no selfie buffers provided')
  }

  const { margin, spacing, titleFontSize, labelFontSize } = { ...DEFAULT_CONFIG, ...config }

  const elements: Array<Record<string, unknown>> = []
  let currentY = margin

  // Create subject title
  const subjectTitle = await createTextOverlayDynamic('Subject', titleFontSize, '#000000', 12)
  const subjectTitleMetadata = await sharp(subjectTitle).metadata()
  const subjectTitleHeight = subjectTitleMetadata.height ?? 0
  const subjectTitleWidth = subjectTitleMetadata.width ?? 0

  // Process all selfies
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

  Logger.debug('buildSelfieCompositeFromBuffers: Processing selfies', {
    generationId,
    selfieCount: selfieBuffers.length
  })

  for (let index = 0; index < selfieBuffers.length; index += 1) {
    const selfieBuffer = selfieBuffers[index]
    
    if (selfieBuffer.length === 0) {
       throw new Error(`Selfie buffer at index ${index} is empty`)
    }

    const processedSelfie = await downscaleForCompositeIfNeeded(selfieBuffer)
    const selfieWidth = processedSelfie.width
    const selfieHeight = processedSelfie.height

    const labelOverlay = await createTextOverlayDynamic(
      `SUBJECT1-SELFIE${index + 1}`,
      labelFontSize,
      '#000000',
      8
    )
    const labelMetadata = await sharp(labelOverlay).metadata()
    const labelWidth = labelMetadata.width ?? 0
    const labelHeight = labelMetadata.height ?? 0

    maxContentWidth = Math.max(maxContentWidth, selfieWidth, labelWidth)
    selfieEntries.push({
      selfieBuffer: processedSelfie.buffer,
      selfieWidth,
      selfieHeight,
      labelOverlay,
      labelWidth,
      labelHeight
    })
  }

  // Add title
  elements.push({
    input: subjectTitle,
    left: margin + Math.floor((maxContentWidth - subjectTitleWidth) / 2),
    top: currentY
  })
  currentY += subjectTitleHeight + spacing

  // Add selfies with labels
  for (const entry of selfieEntries) {
    const imageLeft = margin + Math.floor((maxContentWidth - entry.selfieWidth) / 2)
    const labelLeft = margin + Math.floor((maxContentWidth - entry.labelWidth) / 2)

    elements.push(
      { input: entry.selfieBuffer, left: imageLeft, top: currentY },
      { input: entry.labelOverlay, left: labelLeft, top: currentY + entry.selfieHeight + 5 }
    )

    currentY += entry.selfieHeight + entry.labelHeight + spacing + 5
  }

  // Create composite canvas
  const canvasWidth = margin * 2 + maxContentWidth
  const canvasHeight = currentY + margin

  const compositeBuffer = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite(elements)
    .jpeg({ quality: COMPOSITE_JPEG_QUALITY, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer()

  const compositeBase64 = compositeBuffer.toString('base64')

  if (!compositeBase64 || compositeBase64.length === 0) {
    Logger.error('buildSelfieCompositeFromBuffers: Generated composite has empty base64', {
      generationId,
      selfieCount: selfieBuffers.length,
      compositeBufferLength: compositeBuffer.length
    })
    throw new Error('Generated selfie composite has empty base64 data')
  }

  Logger.info('Created selfie composite reference image', {
    generationId,
    selfieCount: selfieBuffers.length,
    dimensions: `${canvasWidth}x${canvasHeight}`,
    compositeBase64Length: compositeBase64.length,
    compositeBufferSize: compositeBuffer.length
  })

  return {
    mimeType: 'image/jpeg',
    base64: compositeBase64,
    description: 'REFERENCE IMAGE - Subject Face: This composite shows labeled selfies (SUBJECT1-SELFIE1, SUBJECT1-SELFIE2, etc.) of the SAME person from different angles. You MUST preserve this person\'s exact facial features, identity, skin tone, and unique characteristics in the generated image. The face in the output must be recognizable as this same individual.'
  }
}

/**
 * Build a composite image from selfie references with labels
 * Consolidates duplicate implementations from workflow-v3.ts and step1-person.ts
 */
export async function buildSelfieCompositeFromReferences(
  selfieReferences: ReferenceImage[],
  config: Partial<CompositeConfig> = {},
  generationId?: string
): Promise<ReferenceImage> {
  // Validate input
  if (!selfieReferences || selfieReferences.length === 0) {
    Logger.error('buildSelfieCompositeFromReferences: No selfie references provided!', {
      generationId,
      selfieReferencesCount: selfieReferences?.length || 0
    })
    throw new Error('Cannot build selfie composite: no selfie references provided')
  }

  const selfieBuffers: Buffer[] = []
  
  // Validate each reference has required data and decode
  for (let i = 0; i < selfieReferences.length; i++) {
    const ref = selfieReferences[i]
    if (!ref.base64 || ref.base64.trim().length === 0) {
      Logger.error('buildSelfieCompositeFromReferences: Invalid selfie reference', {
        generationId,
        index: i,
        hasBase64: !!ref.base64,
        base64Length: ref.base64?.length || 0,
        label: ref.label || 'NO_LABEL'
      })
      throw new Error(`Selfie reference at index ${i} is missing base64 data`)
    }
    
    try {
      const buffer = Buffer.from(ref.base64, 'base64')
      if (buffer.length === 0) {
        throw new Error('Decoded buffer is empty')
      }
      selfieBuffers.push(buffer)
    } catch (error) {
      Logger.error('buildSelfieCompositeFromReferences: Failed to decode selfie base64', {
        generationId,
        index: i,
        label: ref.label || 'NO_LABEL',
        base64Length: ref.base64?.length || 0,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`Failed to decode selfie reference at index ${i}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return await buildSelfieCompositeFromBuffers(selfieBuffers, config, generationId)
}

/**
 * Create text overlay for labels
 * Consolidates duplicate implementations from workflow-v3.ts and step1-person.ts
 */
export async function createTextOverlayDynamic(
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
 * Build aspect ratio format reference frame
 * Extracted from workflow-v3.ts for reusability
 */
export async function buildAspectRatioFormatReference({
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

  // Use very light, nearly invisible borders - these are ONLY to show dimensions
  // The AI should NOT reproduce these borders in the output
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white" />
      <rect x="4" y="4" width="${width - 8}" height="${height - 8}" fill="none" stroke="rgba(200,200,200,0.3)" stroke-width="1" />
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${fontSize}" fill="rgba(150,150,150,0.5)" text-anchor="middle" dominant-baseline="middle">${width}x${height} (${aspectRatioDescription})</text>
    </svg>
  `

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer()

  return {
    mimeType: 'image/png',
    base64: buffer.toString('base64'),
    description: `FORMAT GUIDE - ${aspectRatioDescription} (${width}x${height}). This shows the target dimensions ONLY. Do NOT include any borders, frames, or letterboxing in the output. Generate the image to fill the entire canvas edge-to-edge.`
  }
}
