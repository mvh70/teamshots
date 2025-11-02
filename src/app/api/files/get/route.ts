import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'

const endpoint = Env.string('HETZNER_S3_ENDPOINT', '')
const bucket = Env.string('HETZNER_S3_BUCKET', '')
const accessKeyId = Env.string('HETZNER_S3_ACCESS_KEY', '')
const secretAccessKey = Env.string('HETZNER_S3_SECRET_KEY', '')
const region = Env.string('HETZNER_S3_REGION', 'eu-central-1')

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
    const response = await s3.send(command)
    
    if (!response.Body) {
      Logger.error('[files/get] empty body', { key })
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // Convert Body to buffer then to stream for Next.js
    const chunks: Uint8Array[] = []
    // @ts-expect-error - Body is iterable in AWS SDK v3
    for await (const chunk of response.Body) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)
    
    // Return the buffer as a response
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.ContentType || 'application/octet-stream',
        'Content-Length': response.ContentLength?.toString() || '',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    Logger.error('[files/get] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Failed to get file' }, { status: 500 })
  }
}


