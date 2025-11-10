import { PhotoStyleSettings } from '@/types/photo-style'
import { 
  removePersonFromBackground, 
  combinePreprocessedImages,
  MultiStepPreprocessingResult 
} from '@/lib/image-preprocessing'
import { Logger } from '@/lib/logger'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { httpFetch } from '@/lib/http'

/**
 * Free Package Image Preprocessor
 * 
 * Multi-step preprocessing pipeline:
 * 1. Remove person from background (if background contains person)
 * 2. Place logo on clothing (if branding position is clothing)
 * 3. Combine intermediate results
 */

export interface PreprocessorResult {
  processedBuffer: Buffer
  metadata?: Record<string, unknown>
  intermediateResults?: MultiStepPreprocessingResult['intermediateResults']
}

// S3 client for downloading assets (supports Backblaze B2, Hetzner, AWS S3, etc.)
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

const s3Client = createS3Client({ forcePathStyle: false })
const BUCKET_NAME = getS3BucketName()

// s3Key is the relative key from database (without folder prefix)
async function downloadAssetAsBuffer(s3Key: string): Promise<Buffer | null> {
  try {
    // Add folder prefix if configured
    const fullKey = getS3Key(s3Key)
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fullKey })
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 })
    const res = await httpFetch(url)
    if (!res.ok) return null
    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  } catch {
    return null
  }
}

export async function preprocessFreepackage(
  selfieBuffer: Buffer,
  styleSettings: PhotoStyleSettings,
  additionalContext?: {
    backgroundS3Key?: string
    logoS3Key?: string
    onStepProgress?: (stepName: string) => void
  }
): Promise<PreprocessorResult> {
  const steps: string[] = []
  const intermediateResults: MultiStepPreprocessingResult['intermediateResults'] = {}
  
  try {
    // Notify that preprocessing is starting
    additionalContext?.onStepProgress?.('starting-preprocessing')
    
    let processedSelfie = selfieBuffer
    let processedBackground: Buffer | undefined
    
    // Step 1: Process background - remove person if custom background contains one
    if (styleSettings.background?.type === 'custom' && styleSettings.background.key) {
      const backgroundKey = additionalContext?.backgroundS3Key || styleSettings.background.key
      const backgroundBuffer = await downloadAssetAsBuffer(backgroundKey)
      
      if (backgroundBuffer) {
        Logger.debug('Processing background: removing person if present')
        additionalContext?.onStepProgress?.('background-person-removed')
        const bgResult = await removePersonFromBackground(backgroundBuffer)
        
        if (bgResult.processed) {
          processedBackground = bgResult.processed
          intermediateResults.backgroundProcessed = bgResult.processed
          steps.push('background-person-removed')
          Logger.debug('Background processed: person removed')
        } else {
          processedBackground = backgroundBuffer
          Logger.debug('Background processing skipped (no person detected or removal failed)')
        }
      }
    }
    
    // Step 2 was previously placing a logo onto the clothing area of the selfie.
    // This functionality is intentionally disabled for now.
    
    // Step 3: Combine processed images if we have both background and selfie
    if (processedBackground && processedSelfie) {
      Logger.debug('Combining preprocessed images')
      additionalContext?.onStepProgress?.('images-combined')
      const combined = await combinePreprocessedImages(processedSelfie, processedBackground, intermediateResults)
      processedSelfie = combined
      steps.push('images-combined')
    }
    
    // Notify that preprocessing is complete
    if (steps.length > 0) {
      additionalContext?.onStepProgress?.('completed-preprocessing')
    }
    
    return {
      processedBuffer: processedSelfie,
      metadata: {
        preprocessor: 'freepackage',
        version: 1,
        applied: steps.length > 0,
        steps
      },
      intermediateResults: steps.length > 0 ? intermediateResults : undefined
    }
  } catch (error) {
    Logger.error('Freepackage preprocessing failed, using original', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      processedBuffer: selfieBuffer,
      metadata: {
        preprocessor: 'freepackage',
        version: 1,
        applied: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

