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
import { classifySelfieType } from '@/domain/selfie/selfie-classifier'
import { classificationQueue } from '@/lib/classification-queue'

const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()
const BASE_DIR = path.join(process.cwd(), 'storage', 'tmp')

/**
 * Run classification asynchronously and update the selfie record.
 * This function is fire-and-forget - it doesn't block the upload response.
 */
async function runAsyncClassification(
  selfieId: string,
  imageBase64: string,
  mimeType: string
): Promise<void> {
  try {
    Logger.info('[uploads/promote] Starting async classification', { selfieId })

    const classification = await classifySelfieType({
      imageBase64,
      mimeType,
    })

    // Update selfie with classification results
    await prisma.selfie.update({
      where: { id: selfieId },
      data: {
        selfieType: classification.selfieType,
        selfieTypeConfidence: classification.confidence,
        personCount: classification.personCount,
        isProper: classification.isProper,
        improperReason: classification.improperReason,
        lightingQuality: classification.lightingQuality,
        lightingFeedback: classification.lightingFeedback,
        backgroundQuality: classification.backgroundQuality,
        backgroundFeedback: classification.backgroundFeedback,
        // If improper, deselect the selfie
        ...(classification.isProper === false && { selected: false }),
      },
    })

    Logger.info('[uploads/promote] Async classification complete', {
      selfieId,
      selfieType: classification.selfieType,
      isProper: classification.isProper,
      personCount: classification.personCount,
      lightingQuality: classification.lightingQuality,
      backgroundQuality: classification.backgroundQuality,
    })
  } catch (error) {
    Logger.error('[uploads/promote] Async classification failed', {
      selfieId,
      error: error instanceof Error ? error.message : String(error),
    })
    
    // Mark as null to allow retry or set to unknown if we want to prevent retry
    // Using null allows the polling mechanism to retry classification
    try {
      await prisma.selfie.update({
        where: { id: selfieId },
        data: {
          selfieType: null, // Use null instead of 'unknown' to allow retry
          selfieTypeConfidence: null,
          personCount: null,
          isProper: null,
          improperReason: null,
          lightingQuality: null,
          lightingFeedback: null,
          backgroundQuality: null,
          backgroundFeedback: null,
        },
      })
      Logger.info('[uploads/promote] Marked failed classification as null for retry', { selfieId })
    } catch (dbError) {
      Logger.error('[uploads/promote] Failed to update selfie after classification error', {
        selfieId,
        dbError: dbError instanceof Error ? dbError.message : String(dbError),
      })
    }
  }
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
    // Queue the classification to limit concurrent requests (max 3 at a time)
    if (!selfieType) {
      const selfieIdForClassification = selfie.id
      
      // Don't await - this runs in background via queue
      classificationQueue.enqueue(async () => {
        await runAsyncClassification(
          selfieIdForClassification,
          imageBase64ForClassification,
          mimeTypeForClassification
        )
      }).catch((error) => {
        Logger.error('[uploads/promote] Queue error', {
          selfieId: selfieIdForClassification,
          error: error instanceof Error ? error.message : String(error),
        })
      })
      
      // Log queue status for monitoring
      const queueStatus = classificationQueue.getStatus()
      Logger.info('[uploads/promote] Classification queued', {
        selfieId: selfieIdForClassification,
        queueStatus,
      })
    }

    return NextResponse.json({ key: relativeKey, selfieId: selfie.id })
  } catch (e) {
    Logger.error('[uploads/promote] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Promote failed' }, { status: 500 })
  }
}
