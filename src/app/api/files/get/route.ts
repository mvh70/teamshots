import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const endpoint = process.env.HETZNER_S3_ENDPOINT
const bucket = process.env.HETZNER_S3_BUCKET
const accessKeyId = process.env.HETZNER_S3_ACCESS_KEY_ID || process.env.HETZNER_S3_ACCESS_KEY
const secretAccessKey = process.env.HETZNER_S3_SECRET_ACCESS_KEY || process.env.HETZNER_S3_SECRET_KEY
const region = process.env.HETZNER_S3_REGION || 'eu-central'

const resolvedEndpoint = endpoint && (endpoint.startsWith('http://') || endpoint.startsWith('https://'))
  ? endpoint
  : endpoint
    ? `https://${endpoint}`
    : undefined

const s3 = new S3Client({
  region,
  endpoint: resolvedEndpoint,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || ''
  },
  forcePathStyle: false
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await getSignedUrl(s3, command, { expiresIn: 60 })
    // Redirect so the browser can fetch/stream directly
    return NextResponse.redirect(url)
  } catch (e) {
     
    console.error('[files/get] error', e)
    return NextResponse.json({ error: 'Failed to sign file' }, { status: 500 })
  }
}


