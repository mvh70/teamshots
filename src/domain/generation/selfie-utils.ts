/**
 * Selfie Utilities
 * 
 * Centralized utilities for building and processing selfie references
 * across generation flows.
 */

import sharp from 'sharp'

export interface SelfieReference {
  label: string
  base64: string
  mimeType: string
}

/**
 * Builds selfie references from processed selfie buffers
 * 
 * @param selfieKeys - Array of S3 keys for selfies
 * @param preprocessFn - Function to preprocess each selfie (download + process)
 * @returns Array of selfie references ready for AI generation
 * 
 * @example
 * ```typescript
 * const references = await buildSelfieReferences(
 *   ['selfie1.jpg', 'selfie2.jpg'],
 *   async (key) => await preprocessSelfie({ selfieKey: key, ... })
 * )
 * // Returns: [{ label: 'SELFIE1', base64: '...', mimeType: 'image/png' }, ...]
 * ```
 */
export async function buildSelfieReferences(
  selfieKeys: string[],
  preprocessFn: (key: string) => Promise<Buffer>
): Promise<SelfieReference[]> {
  const references: SelfieReference[] = []
  
  for (let index = 0; index < selfieKeys.length; index += 1) {
    const key = selfieKeys[index]
    const processedBuffer = await preprocessFn(key)
    
    // Convert to PNG for consistent format
    const pngBuffer = await sharp(processedBuffer).png().toBuffer()
    
    references.push({
      label: `SELFIE${index + 1}`,
      base64: pngBuffer.toString('base64'),
      mimeType: 'image/png'
    })
  }
  
  return references
}

/**
 * Normalizes selfie rotation based on EXIF orientation
 * 
 * @param selfieReferences - Array of selfie references to normalize
 * @returns Normalized selfie references with correct orientation
 */
export async function normalizeSelfieRotation(
  selfieReferences: SelfieReference[]
): Promise<SelfieReference[]> {
  return Promise.all(selfieReferences.map(async (ref) => {
    try {
      const buffer = Buffer.from(ref.base64, 'base64')
      const normalizedBuffer = await sharp(buffer).rotate().toBuffer()
      
      return {
        ...ref,
        base64: normalizedBuffer.toString('base64')
      }
    } catch {
      // If normalization fails, return original
      return ref
    }
  }))
}

/**
 * Converts a buffer to a selfie reference
 * 
 * @param buffer - Image buffer
 * @param label - Label for the reference (e.g., 'SELFIE1')
 * @returns Selfie reference object
 */
export async function bufferToSelfieReference(
  buffer: Buffer,
  label: string
): Promise<SelfieReference> {
  const pngBuffer = await sharp(buffer).png().toBuffer()
  
  return {
    label,
    base64: pngBuffer.toString('base64'),
    mimeType: 'image/png'
  }
}

