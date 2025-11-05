import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()
const BASE_DIR = path.join(process.cwd(), 'storage', 'tmp')

export async function POST(req: NextRequest) {
  if (!bucket) return NextResponse.json({ error: 'Missing bucket' }, { status: 500 })
  try {
    const { tempKey } = await req.json()
    if (!tempKey || typeof tempKey !== 'string' || !tempKey.startsWith('temp:')) {
      return NextResponse.json({ error: 'Invalid temp key' }, { status: 400 })
    }
    const fileName = tempKey.slice('temp:'.length)
    const filePath = path.join(BASE_DIR, fileName)

    const file = await fs.readFile(filePath)

    // Basic content type guess from extension
    const ext = path.extname(fileName).replace(/^\./, '').toLowerCase()
    const contentType = ext ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'image/jpeg'

    // Simple relative key in selfies folder
    const relativeKey = `selfies/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ''}`
    const s3Key = getS3Key(relativeKey)

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: file,
      ContentType: contentType
    }))

    // Cleanup temp
    try { await fs.unlink(filePath) } catch {}

    return NextResponse.json({ key: relativeKey })
  } catch (e) {
    Logger.error('[uploads/promote] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Promote failed' }, { status: 500 })
  }
}
