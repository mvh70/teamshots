import { NextRequest, NextResponse } from 'next/server'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

// S3 configuration (supports Backblaze B2, Hetzner, AWS S3, etc.)
const s3 = createS3Client({ forcePathStyle: false })
const bucket = getS3BucketName()

if (!bucket) {
  Logger.warn('[uploads/sign] Missing S3 bucket configuration')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contentType, extension } = body || {}
    if (!contentType) {
      return NextResponse.json({ error: 'contentType required' }, { status: 400 })
    }

    // Construct relative key (without folder prefix) - this will be stored in database
    const relativeKey = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension.replace(/^\./, '')}` : ''}`
    // Add folder prefix if configured for S3 upload
    const s3Key = getS3Key(relativeKey)

    // Use presigned POST instead of PUT to avoid CORS preflight
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: bucket!,
      Key: s3Key,
      Fields: {
        'success_action_status': '201'
      },
      Expires: 60,
      Conditions: [
        ['content-length-range', 0, 50 * 1024 * 1024], // 50MB max
        ['eq', '$key', s3Key]
      ]
    })

    // Return relative key (without folder prefix) for database storage
    return NextResponse.json({ url, fields, key: relativeKey })
  } catch (e) {
    Logger.error('[uploads/sign] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Failed to sign upload' }, { status: 500 })
  }
}


