import { writeFile as fsWriteFile } from 'node:fs/promises'

import sharp from 'sharp'
import path from 'path'

import { Logger } from '@/lib/logger'
import { PhotoStyleSettings } from '@/types/photo-style'
import { DownloadAssetFn, ReferenceImage } from '@/types/generation'
import { hasValue } from '@/domain/style/elements/base/element-types'

type SelfieBufferProvider = (selfieKey: string) => Promise<Buffer>

// Maximum dimension for each selfie in composite (prevents massive composites causing API timeouts)
const MAX_SELFIE_DIMENSION = 1024

/**
 * Process a selfie buffer: apply EXIF orientation and resize if needed
 */
async function processSelfieBuffer(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const selfieSharp = sharp(buffer)
  const metadata = await selfieSharp.metadata()

  // Apply EXIF orientation
  let orientedBuffer = buffer
  if (metadata.orientation && metadata.orientation > 1) {
    let rotationAngle = 0
    if (metadata.orientation === 3) rotationAngle = 180
    else if (metadata.orientation === 6) rotationAngle = -90
    else if (metadata.orientation === 8) rotationAngle = 90

    if (rotationAngle !== 0) {
      orientedBuffer = await selfieSharp
        .rotate(rotationAngle)
        .withMetadata({ orientation: 1 })
        .toBuffer()
    }
  }

  // Get dimensions after orientation
  const orientedMetadata = await sharp(orientedBuffer).metadata()
  let finalBuffer = orientedBuffer
  let width = orientedMetadata.width ?? 0
  let height = orientedMetadata.height ?? 0

  // Resize if larger than MAX_SELFIE_DIMENSION
  if (width > MAX_SELFIE_DIMENSION || height > MAX_SELFIE_DIMENSION) {
    finalBuffer = await sharp(orientedBuffer)
      .resize(MAX_SELFIE_DIMENSION, MAX_SELFIE_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()
    const resizedMetadata = await sharp(finalBuffer).metadata()
    width = resizedMetadata.width ?? 0
    height = resizedMetadata.height ?? 0
  }

  return { buffer: finalBuffer, width, height }
}

/**
 * Build a selfie composite image with title and labeled selfies
 */
export async function buildSelfieComposite({
  keys,
  getSelfieBuffer,
  generationId,
  title,
  labelPrefix,
  description
}: {
  keys: string[]
  getSelfieBuffer: SelfieBufferProvider
  generationId: string
  title: string
  labelPrefix: string
  description: string
}): Promise<ReferenceImage> {
  const margin = 20
  const selfieSpacing = 10

  const elements: Array<Record<string, unknown>> = []
  let currentY = margin

  // Create title
  const titleOverlay = await createTextOverlayDynamic(title, 32, '#000000', 12)
  const titleMetadata = await sharp(titleOverlay).metadata()
  const titleHeight = titleMetadata.height ?? 0
  const titleWidth = titleMetadata.width ?? 0

  type SelfieEntry = {
    selfieBuffer: Buffer
    selfieWidth: number
    selfieHeight: number
    labelOverlay: Buffer
    labelWidth: number
    labelHeight: number
  }
  const selfieEntries: SelfieEntry[] = []
  let maxContentWidth = titleWidth

  // Process each selfie
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    const selfieBuffer = await getSelfieBuffer(key)
    const processed = await processSelfieBuffer(selfieBuffer)

    const labelOverlay = await createTextOverlayDynamic(
      `${labelPrefix}${index + 1}`,
      24,
      '#000000',
      8
    )
    const labelMetadata = await sharp(labelOverlay).metadata()
    const labelWidth = labelMetadata.width ?? 0
    const labelHeight = labelMetadata.height ?? 0

    maxContentWidth = Math.max(maxContentWidth, processed.width, labelWidth)
    selfieEntries.push({
      selfieBuffer: processed.buffer,
      selfieWidth: processed.width,
      selfieHeight: processed.height,
      labelOverlay,
      labelWidth,
      labelHeight
    })
  }

  // Add title
  elements.push({
    input: titleOverlay,
    left: margin + Math.floor((maxContentWidth - titleWidth) / 2),
    top: currentY
  })
  currentY += titleHeight + selfieSpacing

  // Add selfies
  for (const entry of selfieEntries) {
    const imageLeft = margin + Math.floor((maxContentWidth - entry.selfieWidth) / 2)
    const labelLeft = margin + Math.floor((maxContentWidth - entry.labelWidth) / 2)

    elements.push(
      { input: entry.selfieBuffer, left: imageLeft, top: currentY },
      { input: entry.labelOverlay, left: labelLeft, top: currentY + entry.selfieHeight + 5 }
    )

    currentY += entry.selfieHeight + entry.labelHeight + selfieSpacing + 5
  }

  // Create canvas and composite
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

  // Save debug file
  try {
    const filename = `${labelPrefix.toLowerCase().replace(/-/g, '')}-composite-${generationId}.png`
    const tmpDir = path.join(process.cwd(), 'tmp', 'v3-debug')
    const filePath = path.join(tmpDir, filename)
    await fsWriteFile(filePath, compositeBuffer)
    Logger.debug('Wrote composite reference image', { filePath })
  } catch (error) {
    Logger.warn('Failed to write composite reference image', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  return {
    mimeType: 'image/png',
    base64: compositeBase64,
    description
  }
}

/**
 * Build split selfie composites: one for face (front_view, side_view) and one for body (partial_body, full_body)
 * This helps the AI model focus on different aspects of the subject during generation.
 */
export async function buildSplitSelfieComposites({
  selfieKeys,
  selfieTypeMap,
  getSelfieBuffer,
  generationId
}: {
  selfieKeys: string[]
  selfieTypeMap: Record<string, string>
  getSelfieBuffer: (key: string) => Promise<Buffer>
  generationId: string
}): Promise<{
  faceComposite: ReferenceImage | null
  bodyComposite: ReferenceImage | null
  combinedComposite: ReferenceImage // Fallback for when no types available
}> {
  // Categorize selfie keys by type
  const faceTypes = ['front_view', 'side_view']
  const bodyTypes = ['partial_body', 'full_body']

  const faceKeys: string[] = []
  const bodyKeys: string[] = []
  const unclassifiedKeys: string[] = []

  for (const key of selfieKeys) {
    const selfieType = selfieTypeMap[key]
    if (selfieType && faceTypes.includes(selfieType)) {
      faceKeys.push(key)
    } else if (selfieType && bodyTypes.includes(selfieType)) {
      bodyKeys.push(key)
    } else {
      unclassifiedKeys.push(key)
    }
  }

  Logger.debug('Split selfie composites: categorized selfies', {
    generationId,
    faceKeysCount: faceKeys.length,
    bodyKeysCount: bodyKeys.length,
    unclassifiedKeysCount: unclassifiedKeys.length,
    faceTypes: faceKeys.map(k => selfieTypeMap[k]),
    bodyTypes: bodyKeys.map(k => selfieTypeMap[k])
  })

  // Build composites based on available types
  let faceComposite: ReferenceImage | null = null
  let bodyComposite: ReferenceImage | null = null

  // Build face composite if we have face selfies
  if (faceKeys.length > 0) {
    faceComposite = await buildSelfieComposite({
      keys: faceKeys,
      getSelfieBuffer,
      generationId,
      title: 'FACE REFERENCE',
      labelPrefix: 'FACE-SELFIE',
      description: 'FACE REFERENCE - These selfies show the subject\'s face from different angles. Use them to accurately recreate facial features, skin texture, eyes, nose, mouth, and facial structure.'
    })
  }

  // Build body composite if we have body selfies
  if (bodyKeys.length > 0) {
    bodyComposite = await buildSelfieComposite({
      keys: bodyKeys,
      getSelfieBuffer,
      generationId,
      title: 'BODY REFERENCE',
      labelPrefix: 'BODY-SELFIE',
      description: 'BODY REFERENCE - These selfies show the subject\'s body. Use them to understand body proportions, posture, and build.'
    })
  }

  // Build combined composite only when NO split composites exist (fallback for unclassified selfies)
  let combinedComposite: ReferenceImage

  const hasAnySplitComposite = faceComposite !== null || bodyComposite !== null

  if (hasAnySplitComposite) {
    Logger.debug('Split selfie composites: Split composite exists, skipping combined composite build', {
      generationId,
      hasFaceComposite: faceComposite !== null,
      hasBodyComposite: bodyComposite !== null
    })
    // Use face or body as placeholder (won't actually be used since split composites exist)
    combinedComposite = faceComposite || bodyComposite!
  } else {
    Logger.debug('Split selfie composites: No split composites, building combined composite', {
      generationId,
      totalSelfies: selfieKeys.length
    })
    combinedComposite = await buildSelfieComposite({
      keys: selfieKeys,
      getSelfieBuffer,
      generationId,
      title: 'SUBJECT',
      labelPrefix: 'SELFIE',
      description: 'REFERENCE: Composite image containing vertically stacked subject selfies.'
    })
  }

  return {
    faceComposite,
    bodyComposite,
    combinedComposite
  }
}

export async function buildLogoReference(
  logoKey: string | undefined,
  downloadAsset: DownloadAssetFn
): Promise<ReferenceImage | null> {
  if (!logoKey) return null

  const asset = await downloadAsset(logoKey)
  if (!asset) return null

  const logoBuffer = Buffer.from(asset.base64, 'base64')
  const pngLogo = await sharp(logoBuffer).png().toBuffer()

  return {
    mimeType: 'image/png',
    base64: pngLogo.toString('base64'),
    description: 'REFERENCE IMAGE - LOGO (brand asset to apply as instructed).'
  }
}

export async function buildBackgroundReference(
  backgroundKey: string | undefined,
  downloadAsset: DownloadAssetFn
): Promise<ReferenceImage | null> {
  if (!backgroundKey) return null

  const asset = await downloadAsset(backgroundKey)
  if (!asset) return null

  const backgroundBuffer = Buffer.from(asset.base64, 'base64')
  const pngBackground = await sharp(backgroundBuffer).png().toBuffer()

  return {
    mimeType: 'image/png',
    base64: pngBackground.toString('base64'),
    description: 'REFERENCE IMAGE - BACKGROUND (custom backdrop to use when specified).'
  }
}

/**
 * Build a background composite containing custom background and/or logo
 * For V3 Step 1b usage
 */
export async function buildBackgroundComposite({
  customBackgroundReference,
  logoReference,
  generationId
}: {
  customBackgroundReference?: ReferenceImage
  logoReference?: ReferenceImage
  generationId: string
}): Promise<ReferenceImage> {
  const margin = 20
  const spacing = 10
  
  const additionalAssets: Array<{ label: string; buffer: Buffer }> = []
  
  // Add custom background
  if (customBackgroundReference) {
    const bgBuffer = Buffer.from(customBackgroundReference.base64, 'base64')
    additionalAssets.push({
      label: 'CUSTOM BACKGROUND',
      buffer: bgBuffer
    })
  }
  
  // Add logo
  if (logoReference) {
    const logoBuffer = Buffer.from(logoReference.base64, 'base64')
    additionalAssets.push({
      label: 'BRANDING LOGO',
      buffer: logoBuffer
    })
  }
  
  // Reuse the asset stacking logic
  // Since we don't have selfies here, we only stack assets
  const elements: Array<Record<string, unknown>> = []
  let currentY = margin
  let maxContentWidth = 0
  
  // Create title
  const titleOverlay = await createTextOverlayDynamic('Background References', 32, '#000000', 12)
  const titleMetadata = await sharp(titleOverlay).metadata()
  const titleHeight = titleMetadata.height ?? 0
  const titleWidth = titleMetadata.width ?? 0
  
  maxContentWidth = Math.max(maxContentWidth, titleWidth)
  
  // Process assets
  const assetEntries = []
  for (const asset of additionalAssets) {
    const pngBuffer = await sharp(asset.buffer).png().toBuffer()
    const metadata = await sharp(pngBuffer).metadata()
    const imageWidth = metadata.width ?? 0
    const imageHeight = metadata.height ?? 0

    const labelOverlay = await createTextOverlayDynamic(asset.label, 22, '#000000', 10)
    const labelMetadata = await sharp(labelOverlay).metadata()
    const labelWidth = labelMetadata.width ?? 0
    const labelHeight = labelMetadata.height ?? 0

    maxContentWidth = Math.max(maxContentWidth, imageWidth, labelWidth)
    assetEntries.push({
      imageBuffer: pngBuffer,
      imageWidth,
      imageHeight,
      labelOverlay,
      labelWidth,
      labelHeight
    })
  }
  
  // Add title to composite
  elements.push({
    input: titleOverlay,
    left: margin + Math.floor((maxContentWidth - titleWidth) / 2),
    top: currentY
  })
  currentY += titleHeight + spacing
  
  // Add assets to composite
  for (const entry of assetEntries) {
    const imageLeft = margin + Math.floor((maxContentWidth - entry.imageWidth) / 2)
    const labelLeft = margin + Math.floor((maxContentWidth - entry.labelWidth) / 2)

    elements.push(
      { input: entry.imageBuffer, left: imageLeft, top: currentY },
      { input: entry.labelOverlay, left: labelLeft, top: currentY + entry.imageHeight + 5 }
    )

    currentY += entry.imageHeight + entry.labelHeight + spacing + 5
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
  
  // Save debug file
  try {
    const filename = `bg-composite-${generationId}.png`
    const tmpDir = path.join(process.cwd(), 'tmp', 'v3-debug')
    const filePath = path.join(tmpDir, filename)

    await fsWriteFile(filePath, compositeBuffer)
    Logger.debug('Wrote background composite reference image to temporary directory', { filePath })
  } catch (error) {
    Logger.warn('Failed to write background composite reference image to temporary directory', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  return {
    mimeType: 'image/png',
    base64: compositeBase64,
    description: 'REFERENCE: Composite image containing background references (custom background and/or logo). Use the labeled assets to create the final scene.'
  }
}

export async function buildCollectiveReferenceImages(
  styleSettings: PhotoStyleSettings,
  selfieKeys: string[],
  getSelfieBuffer: SelfieBufferProvider,
  downloadAsset: DownloadAssetFn,
  workflowVersion?: 'v3'
): Promise<ReferenceImage[]> {
  const references: ReferenceImage[] = []

  for (let index = 0; index < selfieKeys.length; index += 1) {
    const key = selfieKeys[index]
    const selfieBuffer = await getSelfieBuffer(key)
    
    // Apply EXIF orientation to ensure correct display
    const selfieSharp = sharp(selfieBuffer)
    const selfieMetadata = await selfieSharp.metadata()
    
    // Rotate based on EXIF orientation if present
    // Orientation values: 1=normal, 3=180°, 6=90°CW, 8=90°CCW
    let orientedBuffer = selfieBuffer
    if (selfieMetadata.orientation && selfieMetadata.orientation > 1) {
      let rotationAngle = 0
      if (selfieMetadata.orientation === 3) {
        rotationAngle = 180
      } else if (selfieMetadata.orientation === 6) {
        rotationAngle = -90
      } else if (selfieMetadata.orientation === 8) {
        rotationAngle = 90
      }
      
      if (rotationAngle !== 0) {
        orientedBuffer = await selfieSharp
          .rotate(rotationAngle)
          .withMetadata({ orientation: 1 })
          .toBuffer()
      }
    }
    
    const pngSelfie = await sharp(orientedBuffer).png().toBuffer()
    references.push({
      mimeType: 'image/png',
      base64: pngSelfie.toString('base64'),
      description: `REFERENCE IMAGE - SUBJECT1-SELFIE${index + 1} (additional angle of the subject).`
    })
  }

  // Skip logo/background downloads for v3 workflow - handled by element preparation in step 0
  if (workflowVersion !== 'v3') {
    if (hasValue(styleSettings.branding) && styleSettings.branding.value.type !== 'exclude') {
      const logo = await buildLogoReference(styleSettings.branding.value.logoKey, downloadAsset)
      if (logo) references.push(logo)
    }

    if (styleSettings.background?.value?.type === 'custom') {
      const background = await buildBackgroundReference(styleSettings.background.value.key, downloadAsset)
      if (background) references.push(background)
    }
  }

  return references
}

/**
 * Build reference images for V3 workflow
 * For V3: Asset downloads (logos, backgrounds) are handled by element preparation (step 0)
 * This function only builds selfie composites and format references
 */
export async function buildDefaultReferencePayload({
  styleSettings,
  selfieKeys,
  getSelfieBuffer,
  downloadAsset,
  generationId,
  shotDescription,
  aspectRatioDescription,
  aspectRatioSize,
  workflowVersion // Maintained for backward compatibility, but v3 is now required
}: {
  styleSettings: PhotoStyleSettings
  selfieKeys: string[]
  getSelfieBuffer: SelfieBufferProvider
  downloadAsset: DownloadAssetFn
  generationId: string
  shotDescription: string
  aspectRatioDescription: string
  aspectRatioSize: { width: number; height: number }
  workflowVersion?: 'v3'
}): Promise<{ referenceImages: ReferenceImage[]; labelInstruction?: string }> {
  // V3 workflow is required
  if (workflowVersion && workflowVersion !== 'v3') {
    throw new Error(`buildDefaultReferencePayload: Only v3 workflow is supported (received: ${workflowVersion})`)
  }
  if (!selfieKeys.length) {
    throw new Error('At least one selfie key is required to build references')
  }

  const referenceImages: ReferenceImage[] = []

  // V3 builds its own prompt structure via element composition
  // labelInstruction is no longer generated (kept in return type for backward compatibility)
  // V3 always uses composite reference

  // V3: Asset downloads (logos, backgrounds) are handled by element preparation (step 0)
  // This only builds selfie composite

  const composite = await buildSelfieComposite({
    keys: selfieKeys,
    getSelfieBuffer,
    generationId,
    title: 'SUBJECT',
    labelPrefix: 'SELFIE',
    description: 'REFERENCE: Composite image containing vertically stacked subject selfies.'
  })

  referenceImages.push(composite)

  // V3: Custom backgrounds are handled by BackgroundElement.prepare() in step 0

  const formatReference = await buildAspectRatioFormatReference({
    width: aspectRatioSize.width,
    height: aspectRatioSize.height,
    aspectRatioDescription
  })
  referenceImages.push(formatReference)

  // V3: labelInstruction not generated - prompt structure built by element composition

  Logger.debug('Prepared composite reference payload', {
    referenceCount: referenceImages.length,
    referenceDescriptions: referenceImages.map(
      (reference) => reference.description ?? 'image reference'
    )
  })

  return {
    referenceImages,
    labelInstruction: undefined // Always undefined for v3
  }
}

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

async function createTextOverlayDynamic(
  text: string,
  fontSize: number,
  color: string,
  padX = 8
): Promise<Buffer> {
  const factor = 0.6
  const textWidth = Math.max(100, Math.ceil(text.length * fontSize * factor))
  const width = textWidth + padX * 2
  const height = Math.max(28, Math.ceil(fontSize + 16))
  const cx = Math.floor(width / 2)
  const cy = Math.floor(height / 2)

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="rgba(255,255,255,0.9)" stroke="${color}" stroke-width="2" rx="5"/>
      <text x="${cx}" y="${cy}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${color}" text-anchor="middle" dominant-baseline="middle">${text}</text>
    </svg>
  `
  return await sharp(Buffer.from(svg)).png().toBuffer()
}
