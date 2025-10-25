import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const endpoint = process.env.HETZNER_S3_ENDPOINT
const bucket = process.env.HETZNER_S3_BUCKET
const accessKeyId = process.env.HETZNER_S3_ACCESS_KEY_ID
const secretAccessKey = process.env.HETZNER_S3_SECRET_ACCESS_KEY

const s3 = new S3Client({
  region: 'eu-central-1',
  endpoint,
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
    return NextResponse.json({ url })
  } catch (e) {
     
    console.error('[files/download] error', e)
    return NextResponse.json({ error: 'Failed to sign download' }, { status: 500 })
  }
}


