import { NextRequest, NextResponse } from 'next/server'
import { S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'

// Expected env vars for Hetzner S3 compatibility
// HETZNER_S3_ENDPOINT=https://<region>.compat.objectstorage.eu-central-1.hetzner.com
// HETZNER_S3_BUCKET=<bucket>
// HETZNER_S3_ACCESS_KEY=<key>
// HETZNER_S3_SECRET_KEY=<secret>

const endpoint = Env.string('HETZNER_S3_ENDPOINT', '')
const bucket = Env.string('HETZNER_S3_BUCKET', '')
const accessKeyId = Env.string('HETZNER_S3_ACCESS_KEY', '')
const secretAccessKey = Env.string('HETZNER_S3_SECRET_KEY', '')

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  Logger.warn('[uploads/sign] Missing Hetzner S3 env vars')
}

const resolvedEndpoint = endpoint && (endpoint.startsWith('http://') || endpoint.startsWith('https://'))
  ? endpoint
  : endpoint
    ? `https://${endpoint}`
    : undefined

const region = Env.string('HETZNER_S3_REGION', 'us-east-1')

const s3 = new S3Client({
  region,
  endpoint: resolvedEndpoint,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || ''
  },
  // Switch to virtual-hosted style so the presigned URL is
  // https://<bucket>.<endpoint>/ and matches Hetzner validation
  forcePathStyle: false
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contentType, extension } = body || {}
    if (!contentType) {
      return NextResponse.json({ error: 'contentType required' }, { status: 400 })
    }

    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension.replace(/^\./, '')}` : ''}`

    // Use presigned POST instead of PUT to avoid CORS preflight
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: bucket!,
      Key: key,
      Fields: {
        'success_action_status': '201'
      },
      Expires: 60,
      Conditions: [
        ['content-length-range', 0, 25 * 1024 * 1024], // 25MB max
        ['eq', '$key', key]
      ]
    })

    return NextResponse.json({ url, fields, key })
  } catch (e) {
    Logger.error('[uploads/sign] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Failed to sign upload' }, { status: 500 })
  }
}


