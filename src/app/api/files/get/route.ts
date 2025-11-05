import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

const s3 = createS3Client()
const bucket = getS3BucketName()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  try {
    // key from query param is relative (from database), add folder prefix if configured
    const s3Key = getS3Key(key)
    const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key })
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
    // Note: Cache-Control allows browser caching but we add cache-busting via query params
    // when files are missing (to allow retry after migration)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.ContentType || 'application/octet-stream',
        'Content-Length': response.ContentLength?.toString() || '',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    Logger.error('[files/get] error', { error, key })
    
    // Check if it's a "not found" error (file doesn't exist in Backblaze)
    if (error.includes('NotFound') || error.includes('NoSuchKey') || error.includes('404')) {
      return NextResponse.json({ 
        error: 'File not found',
        message: 'File may not have been migrated to Backblaze yet'
      }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate', // Don't cache 404s
        }
      })
    }
    
    return NextResponse.json({ error: 'Failed to get file' }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    })
  }
}


