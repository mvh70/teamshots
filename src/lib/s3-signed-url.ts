/**
 * S3 Signed URL Generation
 *
 * SECURITY: Generates time-limited signed URLs for S3 objects
 * This allows direct client access to S3 without proxying through the server,
 * improving performance and reducing server load while maintaining security
 */

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, getS3BucketName, getS3Key } from './s3-client'
import { Logger } from './logger'

const s3 = createS3Client()
const bucket = getS3BucketName()

export interface SignedUrlOptions {
  /** Expiration time in seconds (default: 3600 = 1 hour) */
  expiresIn?: number
  /** Content-Disposition header for download (e.g., 'attachment; filename="photo.jpg"') */
  contentDisposition?: string
  /** Content-Type header */
  contentType?: string
}

/**
 * Generate a signed URL for an S3 object
 *
 * @param key - S3 key (relative path from database)
 * @param options - Optional configuration for signed URL
 * @returns Signed URL that expires after specified time
 */
export async function generateSignedUrl(
  key: string,
  options: SignedUrlOptions = {}
): Promise<string> {
  const {
    expiresIn = 3600, // 1 hour default
    contentDisposition,
    contentType
  } = options

  try {
    const s3Key = getS3Key(key)

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ResponseContentDisposition: contentDisposition,
      ResponseContentType: contentType
    })

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn
    })

    return signedUrl
  } catch (error) {
    Logger.error('Failed to generate signed URL', {
      key,
      error: error instanceof Error ? error.message : String(error)
    })
    throw new Error(`Failed to generate signed URL for ${key}`)
  }
}

/**
 * Generate signed URLs for multiple S3 objects in parallel
 *
 * @param keys - Array of S3 keys
 * @param options - Optional configuration for signed URLs
 * @returns Array of signed URLs in the same order as input keys
 */
export async function generateSignedUrls(
  keys: string[],
  options: SignedUrlOptions = {}
): Promise<string[]> {
  const promises = keys.map(key => generateSignedUrl(key, options))
  return Promise.all(promises)
}

/**
 * SECURITY: Validate that a key is safe to generate a signed URL for
 * This prevents generating URLs for arbitrary paths
 *
 * @param key - S3 key to validate
 * @returns true if key is valid, false otherwise
 */
export function isValidS3Key(key: string): boolean {
  // Must not be empty
  if (!key || typeof key !== 'string') {
    return false
  }

  // Must not contain path traversal sequences
  if (key.includes('../') || key.includes('..\\')) {
    return false
  }

  // Must start with one of the allowed prefixes
  const allowedPrefixes = [
    'selfies/',
    'backgrounds/',
    'logos/',
    'generations/',
    'contexts/',
    'outfits/',
    'temp/'
  ]

  return allowedPrefixes.some(prefix => key.startsWith(prefix))
}
