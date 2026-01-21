import { NextRequest, NextResponse } from 'next/server'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import crypto from 'crypto'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

// S3 configuration (supports Backblaze B2, Hetzner, AWS S3, etc.)
const s3 = createS3Client({ forcePathStyle: false })
const bucket = getS3BucketName()

if (!bucket) {
  Logger.warn('[uploads/sign] Missing S3 bucket configuration')
}

// SECURITY: Allowed content types for presigned uploads
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contentType, extension } = body || {}
    if (!contentType) {
      return NextResponse.json({ error: 'contentType required' }, { status: 400 })
    }

    // SECURITY: Validate content type against allowlist
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid content type. Only images are allowed.' },
        { status: 400 }
      )
    }

    // SECURITY: Use crypto.randomUUID for unpredictable filenames instead of Math.random
    const relativeKey = `uploads/${Date.now()}-${crypto.randomUUID()}${extension ? `.${extension.replace(/^\./, '')}` : ''}`
    // Add folder prefix if configured for S3 upload
    const s3Key = getS3Key(relativeKey)

    // Use presigned POST instead of PUT to avoid CORS preflight
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: bucket!,
      Key: s3Key,
      Fields: {
        'success_action_status': '201',
        'Content-Type': contentType, // Include content type in fields
      },
      Expires: 60,
      Conditions: [
        ['content-length-range', 0, 50 * 1024 * 1024], // 50MB max
        ['eq', '$key', s3Key],
        ['eq', '$Content-Type', contentType], // SECURITY: Enforce content type at S3 level
      ]
    })

    // Return relative key (without folder prefix) for database storage
    return NextResponse.json({ url, fields, key: relativeKey })
  } catch (e) {
    Logger.error('[uploads/sign] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Failed to sign upload' }, { status: 500 })
  }
}


