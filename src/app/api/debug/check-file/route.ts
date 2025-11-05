/**
 * Debug endpoint to check if a file exists in the current S3 bucket (Backblaze)
 * Usage: /api/debug/check-file?key=selfies/personId/selfieId.jpg
 */

import { NextRequest, NextResponse } from 'next/server'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'
import { auth } from '@/auth'

export async function GET(request: NextRequest) {
  // Only allow in development or for authenticated users
  const session = await auth()
  if (process.env.NODE_ENV === 'production' && !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  if (!key) {
    return NextResponse.json({ 
      error: 'Missing key parameter',
      usage: '/api/debug/check-file?key=selfies/personId/selfieId.jpg'
    }, { status: 400 })
  }

  const s3 = createS3Client()
  const bucket = getS3BucketName()

  try {
    // key from query param is relative (from database), add folder prefix if configured
    const s3Key = getS3Key(key)
    const command = new HeadObjectCommand({ Bucket: bucket, Key: s3Key })
    const response = await s3.send(command)
    
    return NextResponse.json({
      exists: true,
      key,
      bucket,
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      message: '✅ File exists in Backblaze B2'
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Check if it's a 404 (file not found)
    if (errorMessage.includes('NotFound') || errorMessage.includes('404')) {
      return NextResponse.json({
        exists: false,
        key,
        bucket,
        message: '❌ File NOT found in Backblaze B2. File may need to be migrated from Hetzner.',
        suggestion: 'If this is an old photo, you need to migrate it from Hetzner to Backblaze using the same key.'
      }, { status: 404 })
    }

    return NextResponse.json({
      exists: false,
      key,
      bucket,
      error: errorMessage,
      message: '❌ Error checking file'
    }, { status: 500 })
  }
}

