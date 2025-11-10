import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'


export const runtime = 'nodejs'
const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()

if (!bucket) {
  throw new Error('Missing S3 bucket configuration')
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key || key === 'undefined') {
      return NextResponse.json({ error: 'Missing or invalid key parameter' }, { status: 400 })
    }

    // Get person to verify ownership
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    })

    if (!person) {
      return NextResponse.json({ error: 'Person record not found' }, { status: 404 })
    }

    // Verify the selfie belongs to the user (if it exists in database)
    // If not in database, it might be a temporary upload that wasn't approved yet
    const selfie = await prisma.selfie.findFirst({
      where: {
        key: key,
        person: {
          userId: session.user.id,
        },
      },
    })

    if (!selfie) {
      // Verify key belongs to this user by checking if personId matches
      // Extract personId from key format: selfies/{personId}-{firstName}/filename
      const keyParts = key.split('/')
      const personIdWithName = keyParts[1]
      const filePersonId = personIdWithName?.split('-')[0] || keyParts[1]

      if (!filePersonId || filePersonId !== person.id) {
        return NextResponse.json({ error: 'Unauthorized - selfie does not belong to user' }, { status: 403 })
      }
    }

    // Delete from S3 (key is relative from database, add folder prefix if configured)
    try {
      const s3Key = getS3Key(key)
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: s3Key,
      })
      await s3.send(command)
      Logger.info('Deleted file from S3', { key, s3Key })
    } catch (s3Error) {
      Logger.error('Failed to delete from S3', { error: s3Error instanceof Error ? s3Error.message : String(s3Error), key })
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database only if it exists (for approved selfies)
    if (selfie) {
      await prisma.selfie.delete({
        where: {
          id: selfie.id,
        },
      })
      Logger.info('Deleted selfie from database', { selfieId: selfie.id })
    } else {
      // File was uploaded but never approved (no DB record)
      // S3 deletion already handled above
      Logger.info('Deleted temporary selfie file (no DB record)', { key })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    Logger.error('Delete selfie error', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Failed to delete selfie' },
      { status: 500 }
    )
  }
}
