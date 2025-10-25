import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

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
  credentials: { accessKeyId: accessKeyId || '', secretAccessKey: secretAccessKey || '' },
  forcePathStyle: true
})

export async function POST(req: NextRequest) {
  if (!bucket) return NextResponse.json({ error: 'Missing bucket' }, { status: 500 })
  try {
    const contentType = req.headers.get('x-file-content-type') || 'application/octet-stream'
    const extension = req.headers.get('x-file-extension') || ''
    const keyHeader = req.headers.get('x-upload-key')
    const fileType = req.headers.get('x-file-type') || 'selfie' // selfie, background, logo

    // Organize files by type
    let folder = 'uploads'
    if (fileType === 'background') {
      folder = 'backgrounds'
    } else if (fileType === 'logo') {
      folder = 'logos'
    } else if (fileType === 'selfie') {
      folder = 'selfies'
    }

    const key = keyHeader || `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension.replace(/^\./, '')}` : ''}`

    const body = await req.arrayBuffer()
    // Enforce limits: max 10MB and image/* types only
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 400 })
    }
    if (body.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 })
    }
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(body),
      ContentType: contentType
    })
    await s3.send(command)

    // Note: Database record creation is handled by /api/uploads/create endpoint
    // This keeps the proxy focused on S3 upload only
    return NextResponse.json({ key })
  } catch (e) {
     
    console.error('[uploads/proxy] error', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}


