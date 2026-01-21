import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { Logger } from '@/lib/logger'
import { SecurityLogger } from '@/lib/security-logger'
import { createS3Client, getS3BucketName, getS3Key, sanitizeNameForS3 } from '@/lib/s3-client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { fileTypeFromBuffer } from 'file-type'
import { queueClassification } from '@/domain/selfie/selfie-classifier'

const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()
const BASE_DIR = path.join(process.cwd(), 'storage', 'tmp')

/**
 * SECURITY: Validate temp filename to prevent path traversal attacks
 * - Rejects filenames with path separators or traversal sequences
 * - Validates resolved path is within BASE_DIR
 */
function validateTempFilename(fileName: string): { valid: boolean; error?: string } {
  // Check for path traversal patterns
  if (
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('..') ||
    fileName.includes('\0') ||
    fileName.includes('%2f') ||
    fileName.includes('%2F') ||
    fileName.includes('%5c') ||
    fileName.includes('%5C') ||
    fileName.includes('%2e%2e') ||
    fileName.includes('%00')
  ) {
    return { valid: false, error: 'Invalid filename: path traversal detected' }
  }

  // Validate the resolved path is within BASE_DIR
  const resolvedPath = path.resolve(BASE_DIR, fileName)
  if (!resolvedPath.startsWith(BASE_DIR + path.sep) && resolvedPath !== BASE_DIR) {
    return { valid: false, error: 'Invalid filename: path escape detected' }
  }

  return { valid: true }
}

export async function POST(req: NextRequest) {
  if (!bucket) return NextResponse.json({ error: 'Missing bucket' }, { status: 500 })

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { tempKey, selfieType, selfieTypeConfidence, personCount, isProper, improperReason, captureSource } = await req.json() as {
      tempKey?: string
      selfieType?: string
      selfieTypeConfidence?: number
      personCount?: number
      isProper?: boolean
      improperReason?: string
      captureSource?: 'laptop_camera' | 'mobile_camera' | 'file_upload'
    }
    if (!tempKey || typeof tempKey !== 'string' || !tempKey.startsWith('temp:')) {
      return NextResponse.json({ error: 'Invalid temp key' }, { status: 400 })
    }
    const fileName = tempKey.slice('temp:'.length)

    // SECURITY: Validate filename to prevent path traversal attacks
    const filenameValidation = validateTempFilename(fileName)
    if (!filenameValidation.valid) {
      await SecurityLogger.logSuspiciousActivity(
        session.user.id,
        'path_traversal_attempt',
        { endpoint: '/api/uploads/promote', fileName, tempKey }
      )
      return NextResponse.json({ error: filenameValidation.error }, { status: 400 })
    }

    const filePath = path.join(BASE_DIR, fileName)

    const file = await fs.readFile(filePath)

    // SECURITY: Validate file type using magic bytes (file signature)
    // This prevents users from uploading malicious files disguised as images
    const fileType = await fileTypeFromBuffer(file)

    // Whitelist of allowed image types
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

    if (!fileType || !ALLOWED_TYPES.includes(fileType.mime)) {
      await SecurityLogger.logSuspiciousActivity(
        session.user.id,
        'invalid_file_type_upload_attempt',
        {
          fileName,
          detectedType: fileType?.mime || 'unknown',
          claimedExtension: path.extname(fileName)
        }
      )

      // Clean up temp file
      try { await fs.unlink(filePath) } catch {}

      return NextResponse.json({
        error: 'Invalid file type. Only images are allowed.',
        details: {
          detected: fileType?.mime || 'unknown',
          allowed: ALLOWED_TYPES
        }
      }, { status: 400 })
    }

    // Use detected MIME type and extension from magic bytes
    const contentType = fileType.mime
    const ext = fileType.ext

    // Verify extension matches detected type
    const fileNameExt = path.extname(fileName).replace(/^\./, '').toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      await SecurityLogger.logSuspiciousActivity(
        session.user.id,
        'file_extension_mismatch',
        {
          fileName,
          detectedExtension: ext,
          claimedExtension: fileNameExt
        }
      )

      // Clean up temp file
      try { await fs.unlink(filePath) } catch {}

      return NextResponse.json({
        error: 'File extension mismatch with actual file type'
      }, { status: 400 })
    }

    // Get person record with firstName
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, firstName: true },
    })

    if (!person) {
      return NextResponse.json({ error: 'Person record not found' }, { status: 404 })
    }

    const firstName = sanitizeNameForS3(person.firstName || 'unknown')

    // Create selfie record immediately (classification runs async)
    // Selected defaults to true, will be updated if classification finds issues
    const selfie = await prisma.selfie.create({
      data: {
        personId: person.id,
        key: `temp-${Date.now()}`, // Temporary key, will be updated
        uploadedByUser: session.user.id,
        selected: true, // Default to selected, async classification will update if improper
        // Include classification if already provided (rare, for backwards compatibility)
        ...(selfieType && { selfieType }),
        ...(typeof selfieTypeConfidence === 'number' && { selfieTypeConfidence }),
        ...(typeof personCount === 'number' && { personCount }),
        ...(typeof isProper === 'boolean' && { isProper }),
        ...(improperReason && { improperReason }),
        // Track how the selfie was captured
        ...(captureSource && { captureSource }),
      },
    })

    // Store image base64 and content type for async classification
    const imageBase64ForClassification = file.toString('base64')
    const mimeTypeForClassification = contentType

    // Use selfie ID as filename (relative key, without folder prefix)
    // Format: selfies/{personId}-{firstName}/{selfieId}.{ext}
    const relativeKey = `selfies/${person.id}-${firstName}/${selfie.id}.${ext}`
    const s3Key = getS3Key(relativeKey)

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: file,
      ContentType: contentType,
      Metadata: {
        uploadedBy: session.user.id,
        personId: person.id,
        originalName: fileName.substring(0, 100),
      },
    }))

    // Update the selfie record with the correct relative key
    await prisma.selfie.update({
      where: { id: selfie.id },
      data: { key: relativeKey },
    })

    // Cleanup temp
    try { await fs.unlink(filePath) } catch {}

    // Run classification asynchronously (fire-and-forget)
    // Uses centralized queueClassification which handles rate limiting
    if (!selfieType) {
      queueClassification({
        selfieId: selfie.id,
        imageBase64: imageBase64ForClassification,
        mimeType: mimeTypeForClassification,
      }, 'promote')
    }

    return NextResponse.json({ key: relativeKey, selfieId: selfie.id })
  } catch (e) {
    Logger.error('[uploads/promote] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Promote failed' }, { status: 500 })
  }
}
