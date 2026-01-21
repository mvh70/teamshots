/**
 * Outfit Upload Endpoint
 *
 * Handles secure upload of outfit images for outfit transfer feature.
 * Implements all security recommendations from OUTFIT_TRANSFER_PLAN_REVIEW.md
 *
 * Supports both session-based auth and extension token auth (X-Extension-Token header)
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'
import { validateImageFileByHeader } from '@/lib/file-validation'
import { AssetService } from '@/domain/services/AssetService'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { SecurityLogger } from '@/lib/security-logger'
import { getExtensionAuthFromHeaders, EXTENSION_SCOPES } from '@/domain/extension'
import { handleCorsPreflightSync, addCorsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

/**
 * OPTIONS /api/outfit/upload
 * Handle CORS preflight requests for extension support
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const response = handleCorsPreflightSync(origin)
  return response || new NextResponse(null, { status: 204 })
}
const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()

// Security constants
const MAX_OUTFIT_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_DIMENSIONS = { width: 4096, height: 4096 }
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic']

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const origin = req.headers.get('origin')

  try {
    // 1. Rate limiting (5 uploads per 5 minutes per user)
    const identifier = await getRateLimitIdentifier(req, 'outfit_upload')
    const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.outfitUpload.limit, RATE_LIMITS.outfitUpload.window)

    if (!rateLimit.success) {
      await SecurityLogger.logRateLimitExceeded(identifier)
      Telemetry.increment('outfit.upload.rate_limited')

      return addCorsHeaders(
        NextResponse.json(
          { error: 'Too many outfit uploads. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }}
        ),
        origin
      )
    }

    // 2. Authenticate (support both session and extension token)
    let userId: string | null = null
    let authSource: 'session' | 'extension' = 'session'

    // Try extension token first (X-Extension-Token header)
    const extensionAuth = await getExtensionAuthFromHeaders(req.headers, EXTENSION_SCOPES.OUTFIT_UPLOAD)
    if (extensionAuth) {
      userId = extensionAuth.userId
      authSource = 'extension'
      Logger.debug('[OutfitUpload] Authenticated via extension token', {
        tokenId: extensionAuth.tokenId,
      })
    } else {
      // Fall back to session auth
      const session = await auth()
      if (session?.user?.id) {
        userId = session.user.id
      }
    }

    if (!userId) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        origin
      )
    }

    // 3. Get person
    const person = await prisma.person.findUnique({
      where: { userId },
      select: { id: true, teamId: true }
    })

    if (!person) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Person not found' }, { status: 404 }),
        origin
      )
    }

    // 4. Read file
    const contentType = req.headers.get('content-type') || 'application/octet-stream'
    const body = await req.arrayBuffer()

    // 5. Validate file size
    if (body.byteLength > MAX_OUTFIT_SIZE) {
      Telemetry.increment('outfit.upload.size_exceeded')
      return addCorsHeaders(
        NextResponse.json({
          error: `File too large. Maximum size is ${MAX_OUTFIT_SIZE / 1024 / 1024}MB`,
          code: 'FILE_TOO_LARGE'
        }, { status: 400 }),
        origin
      )
    }

    // 6. Validate MIME type
    const validation = validateImageFileByHeader(contentType, body.byteLength, MAX_OUTFIT_SIZE)
    if (!validation.valid) {
      Telemetry.increment('outfit.upload.invalid_type')
      return addCorsHeaders(validation.error!, origin)
    }

    // 7. Validate dimensions using sharp
    const imageBuffer = Buffer.from(body)
    const sharpModule = await import('sharp')
    const sharp = sharpModule.default ?? sharpModule
    const metadata = await sharp(imageBuffer).metadata()

    if (!metadata.width || !metadata.height) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Invalid image' }, { status: 400 }),
        origin
      )
    }

    if (metadata.width > MAX_DIMENSIONS.width || metadata.height > MAX_DIMENSIONS.height) {
      Telemetry.increment('outfit.upload.dimensions_exceeded')
      return addCorsHeaders(
        NextResponse.json({
          error: `Image dimensions too large. Maximum: ${MAX_DIMENSIONS.width}x${MAX_DIMENSIONS.height}`,
          code: 'IMAGE_TOO_LARGE'
        }, { status: 400 }),
        origin
      )
    }

    // 8. Validate actual MIME type matches content
    const detectedMime = `image/${metadata.format}`
    if (!ALLOWED_MIME_TYPES.includes(detectedMime)) {
      Telemetry.increment('outfit.upload.mime_mismatch')
      return addCorsHeaders(
        NextResponse.json({
          error: 'Invalid image format. Allowed: PNG, JPEG, WebP, HEIC',
          code: 'INVALID_FORMAT'
        }, { status: 400 }),
        origin
      )
    }

    // 9. Compute fingerprint for deduplication (using simple hash for outfits)
    const crypto = await import('crypto')
    const fingerprint = crypto.createHash('sha256').update(imageBuffer).digest('hex')

    // 10. Check for existing asset with same fingerprint
    const existingAsset = await AssetService.findReusableAsset(fingerprint, {
      personId: person.id,
      teamId: person.teamId ?? undefined
    })
    if (existingAsset && existingAsset.type === 'outfit') {
      Logger.info('Reusing existing outfit asset', { assetId: existingAsset.id })
      Telemetry.increment('outfit.upload.reused')

      return addCorsHeaders(
        NextResponse.json({
          s3Key: existingAsset.s3Key,
          assetId: existingAsset.id,
          url: `/api/files/get?key=${encodeURIComponent(existingAsset.s3Key)}`,
          reused: true
        }),
        origin
      )
    }

    // 11. Upload to S3
    // SECURITY: Use crypto.randomUUID for unpredictable filenames instead of Math.random
    const fileName = `${Date.now()}-${crypto.randomUUID()}.png`
    const relativeKey = `outfits/${person.id}/${fileName}`
    const s3Key = getS3Key(relativeKey)

    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: detectedMime,
        Metadata: {
          uploadedBy: userId,
          personId: person.id,
          uploadDate: new Date().toISOString(),
          authSource: authSource
        }
      }))
    } catch (s3Error) {
      Logger.error('S3 upload failed', {
        error: s3Error instanceof Error ? s3Error.message : String(s3Error),
        key: relativeKey
      })
      Telemetry.increment('outfit.upload.s3_error')

      return addCorsHeaders(
        NextResponse.json({
          error: 'Upload failed. Please try again.',
          code: 'UPLOAD_ERROR'
        }, { status: 500 }),
        origin
      )
    }

    // 12. Create asset record
    const asset = await AssetService.createAsset({
      type: 'outfit',
      s3Key: relativeKey,
      mimeType: detectedMime,
      ownerType: person.teamId ? 'team' : 'person',
      personId: person.id,
      teamId: person.teamId ?? undefined,
      styleFingerprint: fingerprint,
      sizeBytes: imageBuffer.length,
      width: metadata.width,
      height: metadata.height,
      styleContext: {
        uploadedAt: new Date().toISOString(),
        uploadedByUserId: userId,
        source: authSource === 'extension' ? 'extension_upload' : 'web_upload',
        format: metadata.format
      }
    })

    // 13. Log success
    const duration = Date.now() - startTime
    Logger.info('Outfit uploaded successfully', {
      assetId: asset.id,
      s3Key: relativeKey,
      sizeBytes: imageBuffer.length,
      dimensions: `${metadata.width}x${metadata.height}`,
      durationMs: duration,
      authSource
    })

    Telemetry.increment('outfit.upload.success')
    Telemetry.increment(`outfit.upload.success.${authSource}`)
    Telemetry.timing('outfit.upload.duration', duration)

    return addCorsHeaders(
      NextResponse.json({
        s3Key: relativeKey,
        assetId: asset.id,
        url: `/api/files/get?key=${encodeURIComponent(relativeKey)}`,
        dimensions: {
          width: metadata.width,
          height: metadata.height
        },
        reused: false
      }),
      origin
    )

  } catch (error) {
    Logger.error('Outfit upload failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    Telemetry.increment('outfit.upload.error')

    return addCorsHeaders(
      NextResponse.json({
        error: 'Upload failed',
        code: 'UPLOAD_ERROR'
      }, { status: 500 }),
      origin
    )
  }
}
