import { prisma } from '../prisma'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
import sharp from 'sharp'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Env } from '@/lib/env'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// S3 client configuration (same as worker)
const BUCKET_NAME = Env.string('HETZNER_S3_BUCKET', 'teamshots')
const endpoint = Env.string('HETZNER_S3_ENDPOINT', '')
const resolvedEndpoint =
  endpoint && (endpoint.startsWith('http://') || endpoint.startsWith('https://'))
    ? endpoint
    : endpoint
    ? `https://${endpoint}`
    : undefined

const s3Client = new S3Client({
  region: Env.string('HETZNER_S3_REGION', 'eu-central'),
  endpoint: resolvedEndpoint,
  credentials: {
    accessKeyId: Env.string('HETZNER_S3_ACCESS_KEY', ''),
    secretAccessKey: Env.string('HETZNER_S3_SECRET_KEY', ''),
  },
  forcePathStyle: false,
})

// S3 helper functions (same as worker)
async function downloadSelfieAsBase64(s3Key: string): Promise<{ mimeType: string; base64: string }> {
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key })
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 })
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch selfie: ${res.status}`)
    const arrayBuf = await res.arrayBuffer()
    const base64 = Buffer.from(arrayBuf).toString('base64')
    // naive mime detection from key; ideally store mime on upload
    const mimeType = s3Key.endsWith('.png') ? 'image/png' : 'image/jpeg'
    return { mimeType, base64 }
  } catch (e) {
    console.error('Failed to download selfie as base64:', e)
    throw new Error('Failed to access selfie image')
  }
}

async function uploadToS3(buffer: Buffer, key: string, contentType: string = 'image/png'): Promise<{ success: boolean; key?: string; error?: string }> {
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }))
    
    return { success: true, key }
  } catch (error) {
    console.error('Failed to upload to S3:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export interface ProcessedSelfieResult {
  success: boolean
  processedKey?: string
  error?: string
}

/**
 * Process a selfie to remove background and enhance quality
 * Uses Python script with rembg to:
 * 1) Remove the background with high precision
 * 2) Maintain original resolution and quality
 * 3) Create a transparent background
 * Falls back to quality enhancement only if background removal fails
 */
export async function processSelfieForBackgroundRemoval(
  selfieId: string,
  selfieS3Key: string
): Promise<ProcessedSelfieResult> {
  try {
    // Download the original selfie
    const selfieData = await downloadSelfieAsBase64(selfieS3Key)
    if (!selfieData) {
      return { success: false, error: 'Failed to download selfie' }
    }
    
    // Convert base64 to buffer
    const originalBuffer = Buffer.from(selfieData.base64, 'base64')
    // Debug logging removed for production security
    const pythonScript = 'scripts/remove_background.py'
    const pythonPath = '/usr/bin/python3'
    
    let enhancedBuffer: Buffer
    
    try {
      // SECURITY: Validate base64 input to prevent command injection
      if (!selfieData.base64 || typeof selfieData.base64 !== 'string') {
        throw new Error('Invalid base64 data')
      }

      // Validate base64 format (only alphanumeric, +, /, and = padding)
      if (!/^[A-Za-z0-9+/]+=*$/.test(selfieData.base64)) {
        throw new Error('Invalid base64 format - potential command injection attempt')
      }

      // Validate reasonable size (max 10MB base64 = ~7.5MB image)
      if (selfieData.base64.length > 10 * 1024 * 1024 * 1.4) {
        throw new Error('Base64 data too large')
      }

      const { stdout } = await execAsync(`${pythonPath} ${pythonScript} "${selfieData.base64}" u2net_human_seg`)
      const result = JSON.parse(stdout.trim())
      
      if (!result.success) {
        throw new Error(`Background removal failed: ${result.error}`)
      }
      
      // Convert the processed base64 back to buffer
      const processedBuffer = Buffer.from(result.data, 'base64')
      
      // Use the processed buffer directly without additional compression
      enhancedBuffer = processedBuffer
      
    } catch {
      // Fall back to just enhancing the original image
      enhancedBuffer = await sharp(originalBuffer)
        .png({ quality: 95, compressionLevel: 6 })
        .sharpen(1.0)
        .toBuffer()
      
      // Debug logging removed for production security
    }
    
    // Get selfie record to extract personId for the path
    const selfie = await prisma.selfie.findUnique({
      where: { id: selfieId },
      select: { personId: true, key: true }
    })
    
    if (!selfie) {
      return { success: false, error: 'Selfie not found' }
    }
    
    // Extract extension from original key
    const extension = selfie.key.split('.').pop() || 'png'
    
    // Generate new S3 key for processed selfie: selfies/{personId}/{selfieId}-processed.{ext}
    const processedKey = `selfies/${selfie.personId}/${selfieId}-processed.${extension}`
    
    // Upload processed selfie to S3
    const uploadResult = await uploadToS3(enhancedBuffer, processedKey, 'image/png')
    
    if (!uploadResult.success) {
      return { success: false, error: `Failed to upload processed selfie: ${uploadResult.error}` }
    }
    
    // Update the selfie record with the processed key
    await prisma.selfie.update({
      where: { id: selfieId },
      data: { processedKey }
    })
    
    // Successfully processed selfie
    
    return {
      success: true,
      processedKey
    }
    
  } catch (error) {
    console.error(`❌ Error processing selfie ${selfieId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get the best available selfie (processed if available, otherwise original)
 */
export async function getBestSelfieKey(selfieId: string): Promise<string | null> {
  try {
    const selfie = await prisma.selfie.findUnique({
      where: { id: selfieId },
      select: { key: true, processedKey: true }
    })
    
    if (!selfie) {
      return null
    }
    
    // Return processed key if available, otherwise original key
    return selfie.processedKey || selfie.key
  } catch (error) {
    console.error(`Error getting best selfie key for ${selfieId}:`, error)
    return null
  }
}

/**
 * Check if a selfie has been processed
 */
export async function isSelfieProcessed(selfieId: string): Promise<boolean> {
  try {
    const selfie = await prisma.selfie.findUnique({
      where: { id: selfieId },
      select: { processedKey: true }
    })
    
    return !!selfie?.processedKey
  } catch (error) {
    console.error(`Error checking if selfie ${selfieId} is processed:`, error)
    return false
  }
}
