import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { SecurityLogger } from '@/lib/security-logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

const s3 = createS3Client()
const bucket = getS3BucketName()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    
    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 })
    }

    if (!bucket) {
      return NextResponse.json({ error: 'S3 not configured' }, { status: 500 })
    }

    // SECURITY: Verify user has access to this file
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the file or has team access
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, teamId: true }
    })

    if (!person) {
      return NextResponse.json({ error: 'User person record not found' }, { status: 404 })
    }

    // Extract personId from S3 key (format: folder/personId-firstName/filename)
    // Note: key from URL param is relative (from database), without folder prefix
    const keyParts = key.split('/')
    // Extract personId from format: personId-firstName (e.g., "clx123abc-john")
    const personIdWithName = keyParts[1]
    const filePersonId = personIdWithName?.split('-')[0] || keyParts[1] // Fallback to original if no hyphen

    if (person.id !== filePersonId) {
      // Check if same team
      const filePerson = await prisma.person.findUnique({
        where: { id: filePersonId },
        select: { teamId: true }
      })
      
      if (!person.teamId || person.teamId !== filePerson?.teamId) {
        await SecurityLogger.logSuspiciousActivity(
          session.user.id,
          'unauthorized_file_access_attempt',
          { fileKey: key, fileOwnerId: filePersonId }
        )
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Add folder prefix if configured
    const s3Key = getS3Key(key)
    const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key })
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) // 1 hour expiry
    
    // Redirect to the signed URL so the browser can fetch/stream directly
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
