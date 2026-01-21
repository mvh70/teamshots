/**
 * Multi-step Image Preprocessing Utilities
 * 
 * Supports pipeline steps like:
 * - Removing person from background
 * - Placing logo on clothing
 * - Combining intermediate results
 */

import sharp from 'sharp'
import { spawnAsync } from '@/lib/exec'
import { Logger } from '@/lib/logger'

export interface PreprocessingStepResult {
  processedBuffer: Buffer
  stepName: string
  metadata?: Record<string, unknown>
}

export interface MultiStepPreprocessingResult {
  finalBuffer: Buffer
  steps: PreprocessingStepResult[]
  intermediateResults?: {
    backgroundProcessed?: Buffer // Background with person removed
    selfieWithLogo?: Buffer // Selfie with logo on clothing
  }
}

/**
 * Step 1: Remove person from background if background contains a person
 */
export async function removePersonFromBackground(
  backgroundBuffer: Buffer
): Promise<{ processed: Buffer | null; error?: string }> {
  try {
    // Convert buffer to base64
    const base64 = backgroundBuffer.toString('base64')
    
    // SECURITY: Validate base64 input to prevent command injection
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('Invalid base64 data')
    }

    // Validate base64 format (only alphanumeric, +, /, and = padding)
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
      throw new Error('Invalid base64 format - potential command injection attempt')
    }

    // Validate reasonable size (max 10MB base64 = ~7.5MB image)
    if (base64.length > 10 * 1024 * 1024 * 1.4) {
      throw new Error('Base64 data too large')
    }

    // SECURITY: Use spawnAsync with argument array to prevent command injection
    // This separates command from arguments, preventing shell metacharacter interpretation
    const pythonPath = '/usr/bin/python3'
    const pythonScript = 'scripts/remove_background.py'

    const { stdout, exitCode } = await spawnAsync(pythonPath, [pythonScript, base64, 'u2net_human_seg'])

    if (exitCode !== 0) {
      throw new Error(`Python script exited with code ${exitCode}`)
    }
    const result = JSON.parse(stdout.trim())
    
    if (!result.success) {
      Logger.warn('Background person removal failed, using original', { error: result.error })
      return { processed: null, error: result.error }
    }
    
    const processedBuffer = Buffer.from(result.data, 'base64')
    Logger.debug('Background person removed successfully')
    
    return { processed: processedBuffer }
  } catch (error) {
    Logger.warn('Background person removal failed, using original', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return { processed: null, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Step 2: Place logo on clothing in selfie image
 */
export async function placeLogoOnClothing(
  selfieBuffer: Buffer,
  logoBuffer: Buffer,
  position: 'center' | 'left-chest' | 'right-chest' = 'center'
): Promise<{ processed: Buffer | null; error?: string }> {
  try {
    const selfieSharp = sharp(selfieBuffer)
    const selfieMetadata = await selfieSharp.metadata()
    const logoSharp = sharp(logoBuffer)
    const logoMetadata = await logoSharp.metadata()
    
    if (!selfieMetadata.width || !selfieMetadata.height || !logoMetadata.width || !logoMetadata.height) {
      throw new Error('Invalid image dimensions')
    }
    
    // Calculate logo size (scale to ~15% of selfie width)
    const targetLogoWidth = Math.round(selfieMetadata.width * 0.15)
    const targetLogoHeight = Math.round((logoMetadata.height / logoMetadata.width) * targetLogoWidth)
    
    // Resize logo
    const resizedLogo = await logoSharp
      .resize(targetLogoWidth, targetLogoHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer()
    
    // Calculate position based on placement preference
    let logoX: number
    
    // Position on upper chest area (approximately 30% from top, centered horizontally for 'center')
    const chestY = Math.round(selfieMetadata.height * 0.30)
    
    if (position === 'center') {
      logoX = Math.round((selfieMetadata.width - targetLogoWidth) / 2)
    } else if (position === 'left-chest') {
      logoX = Math.round(selfieMetadata.width * 0.25) // Left side of chest
    } else { // right-chest
      logoX = Math.round(selfieMetadata.width * 0.75 - targetLogoWidth) // Right side of chest
    }
    
    const logoY = chestY
    
    // Composite logo onto selfie
    const result = await selfieSharp
      .composite([
        {
          input: resizedLogo,
          left: logoX,
          top: logoY,
          blend: 'over' // Standard alpha blending
        }
      ])
      .png()
      .toBuffer()
    
    Logger.debug('Logo placed on clothing successfully', { position, logoX, logoY })
    
    return { processed: result }
  } catch (error) {
    Logger.warn('Failed to place logo on clothing, using original selfie', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return { processed: null, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Step 3: Combine processed images into final composite
 */
export async function combinePreprocessedImages(
  selfieBuffer: Buffer,
  backgroundBuffer?: Buffer,
  intermediateResults?: MultiStepPreprocessingResult['intermediateResults']
): Promise<Buffer> {
  try {
    // Use processed background if available, otherwise use original
    const backgroundToUse = intermediateResults?.backgroundProcessed || backgroundBuffer
    const selfieToUse = intermediateResults?.selfieWithLogo || selfieBuffer
    
    if (!backgroundToUse) {
      // No background to combine, return selfie as-is
      return selfieToUse
    }
    
    // Load metadata
    const selfieSharp = sharp(selfieToUse)
    const selfieMeta = await selfieSharp.metadata()
    const bgSharp = sharp(backgroundToUse)
    const bgMeta = await bgSharp.metadata()
    
    if (!selfieMeta.width || !selfieMeta.height || !bgMeta.width || !bgMeta.height) {
      throw new Error('Invalid image dimensions')
    }
    
    // Resize background to match selfie dimensions
    const resizedBg = await bgSharp
      .resize(selfieMeta.width, selfieMeta.height, {
        fit: 'cover'
      })
      .toBuffer()
    
    // Extract person from selfie (if it has transparency, use it; otherwise create mask)
    // For now, simple overlay - in production you might want more sophisticated person extraction
    const result = await sharp(resizedBg)
      .composite([
        {
          input: await selfieSharp.ensureAlpha().png().toBuffer(),
          blend: 'over'
        }
      ])
      .png()
      .toBuffer()
    
    Logger.debug('Preprocessed images combined successfully')
    
    return result
  } catch (error) {
    Logger.warn('Failed to combine preprocessed images, using selfie only', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return selfieBuffer
  }
}

