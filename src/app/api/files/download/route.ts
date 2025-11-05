import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

const s3 = createS3Client()
const bucket = getS3BucketName()

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

    // key from query param is relative (from database), add folder prefix if configured
    const s3Key = getS3Key(key)
    const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key })
    const url = await getSignedUrl(s3, command, { expiresIn: 60 })
    return NextResponse.json({ url })
  } catch (e) {
    Logger.error('[files/download] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Failed to sign download' }, { status: 500 })
  }
}


