import { NextResponse } from 'next/server'
import { fileTypeFromBuffer } from 'file-type'

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean
  error?: NextResponse<{ error: string }>
  mimeType?: string
  extension?: string
}

/**
 * Allowed MIME types for image uploads
 */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'] as const

/**
 * Validate file buffer with MIME type detection
 * More secure than header-based validation as it checks actual file content
 * 
 * @param buffer - File buffer to validate
 * @param maxSizeBytes - Maximum file size in bytes
 * @returns Validation result with error response if invalid
 */
export async function validateImageFile(
  buffer: Buffer | Uint8Array,
  maxSizeBytes: number = 10 * 1024 * 1024 // Default 10MB
): Promise<FileValidationResult> {
  // Check file size
  if (buffer.length > maxSizeBytes) {
    const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024))
    return {
      valid: false,
      error: NextResponse.json(
        { error: `File too large (max ${maxSizeMB}MB)` },
        { status: buffer.length > 10 * 1024 * 1024 ? 413 : 400 }
      )
    }
  }

  // Validate file type by CONTENT not extension
  const detectedType = await fileTypeFromBuffer(buffer)
  
  if (!detectedType || !ALLOWED_IMAGE_MIME_TYPES.includes(detectedType.mime as typeof ALLOWED_IMAGE_MIME_TYPES[number])) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images allowed.' },
        { status: 400 }
      )
    }
  }

  return {
    valid: true,
    mimeType: detectedType.mime,
    extension: detectedType.ext
  }
}

/**
 * Validate file using content type header (less secure, but faster)
 * Use validateImageFile for better security when buffer is available
 * 
 * @param contentType - Content type from request header
 * @param sizeBytes - File size in bytes
 * @param maxSizeBytes - Maximum file size in bytes
 * @returns Validation result with error response if invalid
 */
export function validateImageFileByHeader(
  contentType: string | null,
  sizeBytes: number,
  maxSizeBytes: number = 10 * 1024 * 1024 // Default 10MB
): FileValidationResult {
  // Check content type
  if (!contentType || !contentType.startsWith('image/')) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Only image uploads are allowed' },
        { status: 400 }
      )
    }
  }

  // Check file size
  if (sizeBytes > maxSizeBytes) {
    const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024))
    return {
      valid: false,
      error: NextResponse.json(
        { error: `File too large (max ${maxSizeMB}MB)` },
        { status: sizeBytes > 10 * 1024 * 1024 ? 413 : 400 }
      )
    }
  }

  return {
    valid: true,
    mimeType: contentType
  }
}

