import { Logger } from '@/lib/logger'
import sharp from 'sharp'
import type { ReferenceImage } from '@/types/generation'

/**
 * Build a face-focused composite reference image from selfie references
 * This creates a clearer signal for face refinement in Step 2 by cropping
 * and emphasizing facial features rather than full-body selfies
 */
export async function buildFaceComposite(
  selfieReferences: ReferenceImage[],
  generationId?: string
): Promise<ReferenceImage> {
  Logger.info('Building face-focused composite', {
    generationId,
    selfieCount: selfieReferences.length
  })

  if (selfieReferences.length === 0) {
    throw new Error('Cannot build face composite: no selfie references provided')
  }

  // For single selfie, just return it with updated description
  if (selfieReferences.length === 1) {
    return {
      base64: selfieReferences[0].base64,
      mimeType: selfieReferences[0].mimeType,
      description: 'FACE REFERENCE - Use this face to refine facial features, skin texture, and likeness in the final image. Match eyes, nose, mouth, skin tone, and overall facial structure precisely.'
    }
  }

  // For multiple selfies, create a grid composite
  const faceImages: Buffer[] = []
  
  for (const ref of selfieReferences) {
    try {
      const buffer = Buffer.from(ref.base64, 'base64')
      
      // Get image metadata
      const metadata = await sharp(buffer).metadata()
      const width = metadata.width || 512
      const height = metadata.height || 512
      
      // Crop to center (face-focused) - take middle 70% to focus on face
      const cropSize = Math.min(width, height)
      const faceSize = Math.floor(cropSize * 0.7)
      const left = Math.floor((width - faceSize) / 2)
      const top = Math.floor((height - faceSize) / 2)
      
      const faceCropped = await sharp(buffer)
        .extract({ left, top, width: faceSize, height: faceSize })
        .resize(400, 400, { fit: 'cover', position: 'center' })
        .toBuffer()
      
      faceImages.push(faceCropped)
    } catch (error) {
      Logger.warn('Failed to process selfie for face composite', {
        error: error instanceof Error ? error.message : String(error),
        generationId
      })
      // Use original if cropping fails
      const buffer = Buffer.from(ref.base64, 'base64')
      const resized = await sharp(buffer)
        .resize(400, 400, { fit: 'cover', position: 'center' })
        .toBuffer()
      faceImages.push(resized)
    }
  }

  // Create grid layout
  const cols = Math.min(faceImages.length, 2) // Max 2 columns
  const rows = Math.ceil(faceImages.length / cols)
  const cellSize = 400
  const spacing = 20
  const margin = 30
  const labelHeight = 40
  
  const gridWidth = cols * cellSize + (cols - 1) * spacing + 2 * margin
  const gridHeight = rows * cellSize + (rows - 1) * spacing + 2 * margin + labelHeight

  // Create canvas
  const canvas = sharp({
    create: {
      width: gridWidth,
      height: gridHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })

  // Composite face images onto canvas
  const composites: Array<{ input: Buffer; top: number; left: number }> = []
  
  for (let i = 0; i < faceImages.length; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const left = margin + col * (cellSize + spacing)
    const top = margin + labelHeight + row * (cellSize + spacing)
    
    composites.push({
      input: faceImages[i],
      top,
      left
    })
  }

  // Add title text using SVG
  const titleSvg = `
    <svg width="${gridWidth}" height="${labelHeight}">
      <text x="${gridWidth / 2}" y="${labelHeight / 2 + 5}" 
            font-family="Arial, sans-serif" 
            font-size="24" 
            font-weight="bold" 
            fill="#000000" 
            text-anchor="middle">
        FACE REFERENCES
      </text>
    </svg>
  `
  
  composites.push({
    input: Buffer.from(titleSvg),
    top: margin,
    left: 0
  })

  const compositeBuffer = await canvas.composite(composites).png().toBuffer()
  
  Logger.info('Face composite created', {
    generationId,
    width: gridWidth,
    height: gridHeight,
    faceCount: faceImages.length
  })

  return {
    base64: compositeBuffer.toString('base64'),
    mimeType: 'image/png',
    description: 'FACE REFERENCES - Use these faces to refine facial features, skin texture, and likeness in the final image. Match eyes, nose, mouth, skin tone, and overall facial structure precisely from these reference faces.'
  }
}

