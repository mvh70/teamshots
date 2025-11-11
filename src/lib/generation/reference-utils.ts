import { writeFile as fsWriteFile } from 'node:fs/promises'

import sharp from 'sharp'

import { Logger } from '@/lib/logger'
import { PhotoStyleSettings } from '@/types/photo-style'
import { DownloadAssetFn, ReferenceImage } from '@/types/generation'

type SelfieBufferProvider = (selfieKey: string) => Promise<Buffer>

export async function buildVerticalSelfieComposite({
  selfieKeys,
  getSelfieBuffer,
  generationId,
  additionalAssets = []
}: {
  selfieKeys: string[]
  getSelfieBuffer: SelfieBufferProvider
  generationId: string
  additionalAssets?: Array<{
    label: string
    buffer: Buffer
  }>
}): Promise<{ mimeType: string; base64: string }> {
  Logger.debug('Creating selfie composite reference image', {
    selfieCount: selfieKeys.length,
    generationId,
    additionalAssetCount: additionalAssets.length
  })

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

  for (let index = 0; index < selfieKeys.length; index += 1) {
    const key = selfieKeys[index]
    const selfieBuffer = await getSelfieBuffer(key)

    const selfieMetadata = await sharp(selfieBuffer).metadata()
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

  type AssetEntry = {
    imageBuffer: Buffer
    imageWidth: number
    imageHeight: number
    labelOverlay: Buffer
    labelWidth: number
    labelHeight: number
  }
  const assetEntries: AssetEntry[] = []
  let assetsTitleOverlay: Buffer | null = null
  let assetsTitleWidth = 0
  let assetsTitleHeight = 0

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

  if (assetEntries.length > 0) {
    assetsTitleOverlay = await createTextOverlayDynamic('Additional References', 28, '#000000', 12)
    const assetsTitleMetadata = await sharp(assetsTitleOverlay).metadata()
    assetsTitleHeight = assetsTitleMetadata.height ?? 0
    assetsTitleWidth = assetsTitleMetadata.width ?? 0
    maxContentWidth = Math.max(maxContentWidth, assetsTitleWidth)
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

  if (assetEntries.length > 0 && assetsTitleOverlay) {
    elements.push({
      input: assetsTitleOverlay,
      left: margin + Math.floor((maxContentWidth - assetsTitleWidth) / 2),
      top: currentY
    })
    currentY += assetsTitleHeight + selfieSpacing

    for (const entry of assetEntries) {
      const imageLeft = margin + Math.floor((maxContentWidth - entry.imageWidth) / 2)
      const labelLeft = margin + Math.floor((maxContentWidth - entry.labelWidth) / 2)

      elements.push(
        { input: entry.imageBuffer, left: imageLeft, top: currentY },
        { input: entry.labelOverlay, left: labelLeft, top: currentY + entry.imageHeight + 5 }
      )

      currentY += entry.imageHeight + entry.labelHeight + selfieSpacing + 5
    }
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

  try {
    const compositePath = `/tmp/composite-${generationId}.png`
    await fsWriteFile(compositePath, compositeBuffer)
    Logger.debug('Wrote composite reference image to temporary directory', { compositePath })
  } catch (error) {
    Logger.warn('Failed to write composite reference image to temporary directory', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  return {
    mimeType: 'image/png',
    base64: compositeBase64
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

export async function buildCollectiveReferenceImages(
  styleSettings: PhotoStyleSettings,
  selfieKeys: string[],
  getSelfieBuffer: SelfieBufferProvider,
  downloadAsset: DownloadAssetFn
): Promise<ReferenceImage[]> {
  const references: ReferenceImage[] = []

  for (let index = 0; index < selfieKeys.length; index += 1) {
    const key = selfieKeys[index]
    const selfieBuffer = await getSelfieBuffer(key)
    const pngSelfie = await sharp(selfieBuffer).png().toBuffer()
    references.push({
      mimeType: 'image/png',
      base64: pngSelfie.toString('base64'),
      description: `REFERENCE IMAGE - SUBJECT1-SELFIE${index + 1} (additional angle of the subject).`
    })
  }

  if (styleSettings.branding?.type !== 'exclude') {
    const logo = await buildLogoReference(styleSettings.branding?.logoKey, downloadAsset)
    if (logo) references.push(logo)
  }

  if (styleSettings.background?.type === 'custom') {
    const background = await buildBackgroundReference(styleSettings.background.key, downloadAsset)
    if (background) references.push(background)
  }

  return references
}

export async function buildDefaultReferencePayload({
  styleSettings,
  selfieKeys,
  getSelfieBuffer,
  downloadAsset,
  useCompositeReference,
  generationId,
  shotDescription,
  aspectRatioDescription,
  aspectRatioSize
}: {
  styleSettings: PhotoStyleSettings
  selfieKeys: string[]
  getSelfieBuffer: SelfieBufferProvider
  downloadAsset: DownloadAssetFn
  useCompositeReference: boolean
  generationId: string
  shotDescription: string
  aspectRatioDescription: string
  aspectRatioSize: { width: number; height: number }
}): Promise<{ referenceImages: ReferenceImage[]; labelInstruction: string }> {
  if (!selfieKeys.length) {
    throw new Error('At least one selfie key is required to build references')
  }

  const referenceImages: ReferenceImage[] = []
  let labelInstruction = ''

  if (useCompositeReference) {
    const additionalAssets: Array<{ label: string; buffer: Buffer }> = []

    if (styleSettings.branding?.type !== 'exclude' && styleSettings.branding?.logoKey) {
      const logoAsset = await downloadAsset(styleSettings.branding.logoKey)
      if (logoAsset) {
        const logoBuffer = await sharp(Buffer.from(logoAsset.base64, 'base64')).png().toBuffer()
        additionalAssets.push({
          label: 'LOGO (apply according to branding rules)',
          buffer: logoBuffer
        })
      }
    }

    const composite = await buildVerticalSelfieComposite({
      selfieKeys,
      getSelfieBuffer,
      generationId,
      additionalAssets
    })

    referenceImages.push({
      mimeType: composite.mimeType,
      base64: composite.base64,
      description:
        'REFERENCE: Composite image containing vertically stacked subject selfies and labeled brand assets.'
    })

    if (styleSettings.background?.type === 'custom' && styleSettings.background.key) {
      const backgroundReference = await buildBackgroundReference(
        styleSettings.background.key,
        downloadAsset
      )
      if (backgroundReference) {
        referenceImages.push(backgroundReference)
      }
    }

    const formatReference = await buildAspectRatioFormatReference({
      width: aspectRatioSize.width,
      height: aspectRatioSize.height,
      aspectRatioDescription
    })
    referenceImages.push(formatReference)

    const instructionLines: string[] = [
      'Reference images are supplied with clear labels. Follow each resource precisely:',
      '- **Composite Selfies & Branding:** Inside the stacked selfie reference, choose the face that best matches the requested pose and lighting as the primary likeness. Use the remaining selfies to reinforce 3D facial structure, hair, glasses, and fine details. Stay as close as possible to the original selfies. Do not invent details, unless indicated specifically. Eg if the selfies do not show glasses, do not add glasses. Keep the hairstyle as much as possible as in the selfies. Apply the branded logo exactly as indicated—no extra placements—and do not show the original selfies in the final image.'
    ]

    if (styleSettings.background?.type === 'custom' && styleSettings.background.key) {
      instructionLines.push(
        '- **Custom Background:** Use the provided custom background image and match the background to the final aspect ratio determined by the FORMAT frame.'
      )
    }

    if (styleSettings.branding?.type !== 'exclude') {
      instructionLines.push(
        '- **Branding:** Place the logo exactly once following the BRANDING guidance from the reference assets. Recreate the placement faithfully and ensure the composite reference itself is not visible in the final image.'
      )
    }

    instructionLines.push(
      `- **Format Frame (${aspectRatioDescription}):** This empty frame defines the exact output bounds. Compose the final ${shotDescription.toLowerCase()} image so all important content stays inside this frame without cropping.`
    )

    instructionLines.push(
      `\nRespect the requested shot type (${shotDescription}) and match the ${aspectRatioDescription} aspect ratio exactly by following the FORMAT frame.`
    )

    labelInstruction = instructionLines.join('\n')

    Logger.debug('Prepared composite reference payload', {
      referenceCount: referenceImages.length,
      referenceDescriptions: referenceImages.map(
        (reference) => reference.description ?? 'image reference'
      )
    })
  } else {
    const references = await buildCollectiveReferenceImages(
      styleSettings,
      selfieKeys,
      getSelfieBuffer,
      downloadAsset
    )
    referenceImages.push(...references)

    const selfieLabels = selfieKeys.map((_, index) => `SUBJECT1-SELFIE${index + 1}`)
    
    const instructionLines: string[] = [
      `Reference selfies are provided individually and labeled (${selfieLabels.join(', ')}). Follow each resource precisely:`,
      `- **Subject Selfies:** Choose the face that best matches the requested pose and lighting as the primary likeness. Use the remaining selfies to reinforce 3D facial structure, hair, glasses, and fine details. Stay as close as possible to the original selfies. Do not invent details, unless indicated specifically. Eg if the selfies do not show glasses, do not add glasses. Keep the hairstyle as much as possible as in the selfies. Do not show the original selfies in the final image.`
    ]

    if (styleSettings.branding?.type !== 'exclude') {
      instructionLines.push(
        '- **Branding:** Place the logo exactly once following the BRANDING guidance from the reference assets.'
      )
    }

    instructionLines.push(
      `\n**CRITICAL ORIENTATION REQUIREMENT:** The final output image MUST be vertical (portrait orientation) with height significantly greater than width. Respect the requested shot type (${shotDescription}) and aspect ratio (${aspectRatioDescription}).`
    )

    labelInstruction = instructionLines.join('\n')
  }

  return {
    referenceImages,
    labelInstruction
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